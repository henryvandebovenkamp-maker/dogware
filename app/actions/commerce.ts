"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agreement, Commerce, Lead } from "@/lib/db/schema";
import { getAdminActor } from "@/lib/admin-auth";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent, setStage } from "@/lib/journey";
import {
  activateMandateAndSubscription,
  getCommerceForLead,
  mailAndLog,
  paidTotal,
  setCommerceStatus,
} from "@/lib/commerce";
import {
  createOrGetDraft,
  ensureCommerce,
  freezePricing,
  getActiveProposal,
  getDraftProposal,
  isExpired,
  markProposalSent,
  pricingLabels,
  readPricing,
  saveDraftContent,
  toConfig,
} from "@/lib/proposals";
import { agreementPricing, ensureAgreement, getCurrentAgreement, isSigned } from "@/lib/agreements";
import { registerDocument } from "@/lib/documents";
import { createMolliePayment, isMollieConfigured } from "@/lib/mollie";
import { computeOutstanding, euroFromCents } from "@/lib/money";
import { newPortalToken, portalUrl, requestFingerprint, resolvePortal } from "@/lib/portal-access";

export type CommerceState = {
  status: "idle" | "success" | "error";
  message?: string;
  checkoutUrl?: string;
};

const OK = (message?: string): CommerceState => ({ status: "success", message });
const FOUT = (message: string): CommerceState => ({ status: "error", message });

/* =========================================================================
 * Admin — commerciële beslissingen blijven bewust handmatig
 * ========================================================================= */

async function adminContext(
  leadId: string,
): Promise<{ lead: Lead; commerce: Commerce; actorId: string } | null> {
  const actor = await getAdminActor();
  if (!actor) return null;
  const db = getDb();
  if (!db) return null;
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!lead) return null;
  const commerce = await ensureCommerce(leadId);
  if (!commerce) return null;
  return { lead, commerce, actorId: actor.id };
}

function refresh(leadId: string) {
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}/voorstel`);
}

const euroToCents = (v: FormDataEntryValue | null) =>
  Math.max(0, Math.round(Number(String(v ?? "0").replace(",", ".")) * 100)) || 0;
const intVal = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(v ?? 0))) || 0;
const pctVal = (v: FormDataEntryValue | null) => Math.min(100, intVal(v));

const START_RULES = [
  "na-oplevering",
  "na-laatste-betaling",
  "eerste-volgende-maand",
  "handmatig",
] as const;
function normalizeStartRule(v: string): (typeof START_RULES)[number] {
  return (START_RULES as readonly string[]).includes(v)
    ? (v as (typeof START_RULES)[number])
    : "na-oplevering";
}

/** "De klant wil doorgaan" — de handmatige start van de commerciële journey. */
export async function markDemoAccepted(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");

  await setStage(leadId, "demo-akkoord", { force: true, actor: "admin", reden: "klant wil doorgaan" });
  await logJourneyEvent(leadId, "demo_accepted", "Klant wil doorgaan met DogWare", { actor: "admin" });
  await logActivity({
    actorUserId: ctx.actorId,
    action: "DEMO_ACCEPTED",
    objectType: "lead",
    objectId: leadId,
  });
  refresh(leadId);
  return OK("Genoteerd. Volgende stap: het voorstel maken.");
}

/** Slaat de financiële afspraak op. Raakt een verstuurd voorstel nooit aan. */
export async function saveCommerceConfig(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const db = getDb()!;

  const dt = String(formData.get("discountType") ?? "none");
  const startRule = normalizeStartRule(String(formData.get("startRule") ?? ""));
  const startAtRaw = String(formData.get("startAt") ?? "").trim();

  await db
    .update(schema.commerce)
    .set({
      projectCents: euroToCents(formData.get("project")),
      setupCents: euroToCents(formData.get("setup")),
      discountType: dt === "amount" || dt === "percent" ? dt : "none",
      discountValue:
        dt === "percent"
          ? pctVal(formData.get("discountValue"))
          : euroToCents(formData.get("discountValue")),
      vatPercent: Math.min(100, intVal(formData.get("vat")) || 21),
      depositPercent: pctVal(formData.get("depositPercent")) || 50,
      monthlyCents: euroToCents(formData.get("monthly")),
      freeMonths: intVal(formData.get("freeMonths")),
      introDiscountPercent: pctVal(formData.get("introPercent")),
      introDiscountMonths: intVal(formData.get("introMonths")),
      subscriptionStartRule: startRule,
      subscriptionStartAt:
        startRule === "handmatig" && startAtRaw ? new Date(`${startAtRaw}T00:00:00`) : null,
      opmerkingen: String(formData.get("opmerkingen") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.commerce.id, ctx.commerce.id));

  refresh(leadId);
  return OK("Afspraak opgeslagen.");
}

/** Maakt (of opent) het concept-voorstel. */
export async function createProposalDraft(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");

  const draft = await createOrGetDraft(ctx.commerce, ctx.lead, ctx.actorId);
  if (!draft) return FOUT("Kon geen voorstel aanmaken.");
  if (draft.version === 1) {
    await setStage(leadId, "offerte", { actor: "admin", reden: "voorstel aangemaakt" });
    await logJourneyEvent(leadId, "proposal_created", "Voorstel aangemaakt (versie 1)", {
      actor: "admin",
    });
  }
  refresh(leadId);
  return OK();
}

/**
 * Autosave van de conceptinhoud. Bewust tolerant: dit draait tijdens het
 * typen en mag nooit een foutmelding in het gezicht van de beheerder duwen.
 */
export async function saveProposalDraft(
  leadId: string,
  content: {
    titel?: string;
    intro?: string;
    omschrijving?: string;
    werkzaamheden?: string[];
    modules?: string[];
    bijzonderheden?: string;
    geldigTot?: string | null;
  },
): Promise<{ ok: boolean; message?: string }> {
  const ctx = await adminContext(leadId);
  if (!ctx) return { ok: false, message: "Geen toegang." };
  const draft = await getDraftProposal(ctx.commerce.id);
  if (!draft) return { ok: false, message: "Geen concept gevonden." };

  const res = await saveDraftContent(draft.id, {
    ...(content.titel !== undefined ? { titel: content.titel.slice(0, 200) } : {}),
    ...(content.intro !== undefined ? { intro: content.intro.slice(0, 4000) || null } : {}),
    ...(content.omschrijving !== undefined
      ? { omschrijving: content.omschrijving.slice(0, 8000) || null }
      : {}),
    ...(content.werkzaamheden !== undefined
      ? { werkzaamheden: content.werkzaamheden.map((r) => r.slice(0, 300)).filter(Boolean).slice(0, 50) }
      : {}),
    ...(content.modules !== undefined
      ? { modules: content.modules.map((r) => r.slice(0, 120)).filter(Boolean).slice(0, 50) }
      : {}),
    ...(content.bijzonderheden !== undefined
      ? { bijzonderheden: content.bijzonderheden.slice(0, 4000) || null }
      : {}),
    ...(content.geldigTot !== undefined
      ? { geldigTot: content.geldigTot ? new Date(`${content.geldigTot}T23:59:59`) : null }
      : {}),
  });
  if (!res.ok) {
    return {
      ok: false,
      message:
        res.reason === "NOT_DRAFT"
          ? "Dit voorstel is al verstuurd en kan niet meer worden gewijzigd. Maak een nieuwe versie."
          : "Opslaan lukte niet.",
    };
  }
  return { ok: true };
}

/** Verstuurt het concept definitief. Vanaf hier is de versie onveranderlijk. */
export async function sendProposal(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const { lead, commerce } = ctx;

  const draft = await getDraftProposal(commerce.id);
  if (!draft) return FOUT("Er is geen concept om te versturen. Maak eerst een voorstel.");

  const cfg = toConfig(commerce);
  if (cfg.projectCents + cfg.setupCents <= 0) {
    return FOUT("Vul eerst de eenmalige investering in — een voorstel van € 0,00 versturen we niet.");
  }
  if (!draft.titel.trim()) return FOUT("Geef het voorstel een titel.");

  const sent = await markProposalSent(draft, commerce);
  if (!sent) return FOUT("Versturen mislukte.");

  await getDb()!
    .update(schema.commerce)
    .set({
      status: "PROPOSAL_SENT",
      proposalVersion: sent.version,
      proposalSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.commerce.id, commerce.id));

  await registerDocument({
    leadId,
    commerceId: commerce.id,
    type: "PROPOSAL",
    titel: `Voorstel versie ${sent.version} — ${sent.titel}`,
    proposalId: sent.id,
    snapshot: { versie: sent.version, pricing: sent.pricing },
  });

  await setStage(leadId, "voorstel-verstuurd", { actor: "admin", reden: `versie ${sent.version}` });
  await logJourneyEvent(leadId, "proposal_sent", `Voorstel versie ${sent.version} verstuurd`, {
    actor: "admin",
    version: sent.version,
  });

  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;
  const gelukt = await mailAndLog(lead, "proposal-sent", {}, link);

  await logActivity({
    actorUserId: ctx.actorId,
    action: "PROPOSAL_SENT",
    objectType: "lead",
    objectId: leadId,
    newValue: { version: sent.version },
  });
  refresh(leadId);
  return gelukt
    ? OK(`Voorstel versie ${sent.version} verstuurd naar ${lead.email}.`)
    : OK(`Voorstel vastgelegd, maar de mail kon niet worden verzonden. Probeer 'herinnering sturen'.`);
}

/** Eén generieke herinneringsactie — welke mail hangt af van waar we staan. */
export async function sendReminder(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const soort = String(formData.get("soort") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const { lead, commerce } = ctx;
  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;

  const proposal = await getActiveProposal(commerce.id);
  const snap = proposal ? readPricing(proposal, commerce) : freezePricing(commerce);
  const L = pricingLabels(snap);
  const outstanding = computeOutstanding(snap.config, await paidTotal(commerce.id));

  const map: Record<string, { type: Parameters<typeof mailAndLog>[1]; vars: { amount?: string } }> = {
    voorstel: { type: "proposal-reminder", vars: {} },
    overeenkomst: { type: "agreement-reminder", vars: {} },
    aanbetaling: { type: "deposit-reminder", vars: { amount: L.deposit } },
    restbetaling: { type: "final-reminder", vars: { amount: euroFromCents(outstanding) } },
  };
  const keuze = map[soort];
  if (!keuze) return FOUT("Onbekende herinnering.");

  const gelukt = await mailAndLog(
    lead,
    keuze.type,
    keuze.vars,
    soort === "overeenkomst" ? (link ? `${link}/overeenkomst` : undefined) : link,
  );
  refresh(leadId);
  return gelukt ? OK("Herinnering verstuurd.") : FOUT("De mail kon niet worden verzonden.");
}

/** Oplevering klaarzetten — de admin geeft de laatste commerciële stap vrij. */
export async function markDeliveryReady(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const { lead, commerce } = ctx;

  const betaald = await paidTotal(commerce.id);
  const proposal = await getActiveProposal(commerce.id);
  const snap = proposal ? readPricing(proposal, commerce) : freezePricing(commerce);
  if (betaald <= 0) {
    return FOUT("De eerste termijn is nog niet ontvangen — oplevering vrijgeven kan nog niet.");
  }

  await getDb()!
    .update(schema.commerce)
    .set({
      status: "DELIVERY_READY",
      deliveryReadyAt: commerce.deliveryReadyAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.commerce.id, commerce.id));

  await setStage(leadId, "oplevering", { actor: "admin", reden: "oplevering klaargezet" });
  await logJourneyEvent(leadId, "delivery_ready", "Oplevering klaargezet", { actor: "admin" });

  const outstanding = computeOutstanding(snap.config, betaald);
  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;
  const gelukt = await mailAndLog(
    lead,
    "delivery-ready",
    { amount: euroFromCents(outstanding) },
    link,
  );
  refresh(leadId);
  return gelukt
    ? OK("Oplevering klaargezet en de klant is geïnformeerd.")
    : OK("Oplevering klaargezet, maar de mail kon niet worden verzonden.");
}

/** Website live zetten — mag pas als alles betaald en geregeld is. */
export async function markWebsiteLive(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const { lead, commerce } = ctx;
  const db = getDb()!;

  const proposal = await getActiveProposal(commerce.id);
  const snap = proposal ? readPricing(proposal, commerce) : freezePricing(commerce);
  const openstaand = computeOutstanding(snap.config, await paidTotal(commerce.id));
  if (openstaand > 0) {
    return FOUT(`Er staat nog ${euroFromCents(openstaand)} open — live zetten kan pas na de laatste termijn.`);
  }
  if (commerce.monthlyCents > 0 && !commerce.mandateActivatedAt) {
    return FOUT("Er is nog geen actief incassomandaat. Regel dat eerst, anders kan het abonnement niet lopen.");
  }
  /*
   * Een geldig mandaat is niet hetzelfde als een lopend abonnement. Zonder deze
   * controle kun je live gaan met een klant bij wie nooit geïncasseerd wordt —
   * en dat merk je pas maanden later.
   */
  if (commerce.monthlyCents > 0 && !commerce.mollieSubscriptionId) {
    return FOUT(
      "Het mandaat is actief, maar het maandabonnement is nog niet ingepland. Klik eerst op 'Mandaat opnieuw proberen'.",
    );
  }

  const nu = new Date();
  await db
    .update(schema.commerce)
    .set({
      status: "ACTIVE_CUSTOMER",
      liveAt: commerce.liveAt ?? nu,
      activeCustomerAt: commerce.activeCustomerAt ?? nu,
      updatedAt: nu,
    })
    .where(eq(schema.commerce.id, commerce.id));

  await setStage(leadId, "live", { actor: "admin", reden: "website live" });
  await logJourneyEvent(leadId, "website_live", "Website live gezet", { actor: "admin" });
  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;
  await mailAndLog(lead, "website-live", {}, link);

  await setStage(leadId, "actief", { actor: "admin", reden: "klant actief" });
  await logJourneyEvent(leadId, "customer_active", "Klant is nu actieve DogWare-klant", {
    actor: "admin",
  });
  await db
    .update(schema.leads)
    .set({ status: "klant geworden" })
    .where(eq(schema.leads.id, leadId));
  await mailAndLog(
    lead,
    "welcome-customer",
    {
      extra:
        commerce.monthlyCents > 0
          ? `Je abonnement van ${euroFromCents(commerce.monthlyCents)} excl. btw per maand loopt vanaf nu automatisch.`
          : undefined,
    },
    link,
  );

  await logActivity({
    actorUserId: ctx.actorId,
    action: "WEBSITE_LIVE",
    objectType: "lead",
    objectId: leadId,
  });
  refresh(leadId);
  return OK("De website staat live en de klant is actief.");
}

/** Interne notitie op de tijdlijn. Nooit zichtbaar voor de klant. */
export async function addInternalNote(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const tekst = String(formData.get("notitie") ?? "").trim();
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  if (!tekst) return FOUT("Lege notitie.");

  await logJourneyEvent(leadId, "internal_note", tekst.slice(0, 2000), {
    actor: "admin",
    internal: true,
  });
  refresh(leadId);
  return OK("Notitie opgeslagen.");
}

/** Taak afvinken of terugzetten. */
export async function toggleTask(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const db = getDb()!;

  const [task] = await db
    .select()
    .from(schema.journeyTasks)
    .where(and(eq(schema.journeyTasks.id, taskId), eq(schema.journeyTasks.leadId, leadId)))
    .limit(1);
  if (!task) return FOUT("Taak niet gevonden.");

  await db
    .update(schema.journeyTasks)
    .set({ done: !task.done, doneAt: task.done ? null : new Date() })
    .where(eq(schema.journeyTasks.id, taskId));
  refresh(leadId);
  return OK();
}

/** Nieuwe klantlink genereren — maakt de oude link definitief ongeldig. */
export async function rotatePortalToken(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");

  await getDb()!
    .update(schema.commerce)
    .set({ portalToken: newPortalToken(), updatedAt: new Date() })
    .where(eq(schema.commerce.id, ctx.commerce.id));
  await logJourneyEvent(leadId, "portal_token_rotated", "Nieuwe klantlink gegenereerd", {
    actor: "admin",
    internal: true,
  });
  await logActivity({
    actorUserId: ctx.actorId,
    action: "PORTAL_TOKEN_ROTATED",
    objectType: "lead",
    objectId: leadId,
  });
  refresh(leadId);
  return OK("Nieuwe link gemaakt. De oude link werkt niet meer.");
}

/* =========================================================================
 * Klant — via de beveiligde link, zonder verplichte login
 * ========================================================================= */

type KlantContext = { lead: Lead; commerce: Commerce };

async function klantContext(token: string): Promise<KlantContext | null> {
  return resolvePortal(token);
}

/** Voorstel accepteren. Audittechnisch vastgelegd en idempotent. */
export async function acceptProposal(
  token: string,
  naam: string,
): Promise<CommerceState> {
  const ctx = await klantContext(token);
  if (!ctx) return FOUT("Deze link is niet (meer) geldig.");
  const db = getDb();
  if (!db) return FOUT("Tijdelijk niet beschikbaar.");
  const { lead, commerce } = ctx;

  const proposal = await getActiveProposal(commerce.id);
  if (!proposal) return FOUT("Er staat geen voorstel klaar.");
  if (proposal.acceptedAt) return OK(); // al akkoord — idempotent
  if (isExpired(proposal)) {
    return FOUT("Dit voorstel is verlopen. Neem even contact op, dan maken we een nieuwe versie.");
  }
  const schoon = naam.trim();
  if (schoon.length < 2) return FOUT("Vul je naam in om akkoord te geven.");

  const fp = await requestFingerprint();
  const nu = new Date();

  await db
    .update(schema.proposals)
    .set({
      status: "ACCEPTED",
      acceptedAt: nu,
      acceptedName: schoon.slice(0, 160),
      acceptedIpHash: fp.ipHash,
      acceptedUserAgent: fp.userAgent,
    })
    .where(eq(schema.proposals.id, proposal.id));

  await db
    .update(schema.commerce)
    .set({
      status: "PROPOSAL_ACCEPTED",
      acceptedAt: commerce.acceptedAt ?? nu,
      acceptedIpHash: fp.ipHash,
      acceptedSnapshot: proposal.pricing,
      updatedAt: nu,
    })
    .where(eq(schema.commerce.id, commerce.id));

  await setStage(lead.id, "akkoord", { actor: "klant", reden: `voorstel v${proposal.version}` });
  await logJourneyEvent(
    lead.id,
    "proposal_accepted",
    `Voorstel versie ${proposal.version} geaccepteerd door ${schoon}`,
    { actor: "klant", version: proposal.version, ipHash: fp.ipHash },
  );

  // Meteen de overeenkomst klaarzetten: dat is de eerstvolgende stap.
  const agreement = await ensureAgreement(commerce, lead, { ...proposal, acceptedAt: nu });
  if (agreement) {
    await setStage(lead.id, "overeenkomst", { actor: "systeem" });
    await logJourneyEvent(lead.id, "agreement_ready", "Overeenkomst klaargezet", {
      actor: "systeem",
      voorwaardenVersie: agreement.voorwaardenVersie,
    });
  }

  await mailAndLog(lead, "proposal-accepted", {}, `${portalUrl(token)}/overeenkomst`);
  revalidatePath(`/traject/${token}`);
  refresh(lead.id);
  return OK();
}

export type SignInput = {
  naam: string;
  functie: string;
  email: string;
  telefoon: string;
  bedrijfsnaam: string;
  adres: string;
  postcode: string;
  plaats: string;
  kvk: string;
  btw?: string;
  agreesOpdracht: boolean;
  agreesInvestering: boolean;
  agreesTermijnen: boolean;
  agreesMaandbedrag: boolean;
  agreesVoorwaarden: boolean;
  agreesBevoegd: boolean;
};

/** Overeenkomst digitaal ondertekenen. Poortwachter vóór elke betaling. */
export async function signAgreement(token: string, input: SignInput): Promise<CommerceState> {
  const ctx = await klantContext(token);
  if (!ctx) return FOUT("Deze link is niet (meer) geldig.");
  const db = getDb();
  if (!db) return FOUT("Tijdelijk niet beschikbaar.");
  const { lead, commerce } = ctx;

  const proposal = await getActiveProposal(commerce.id);
  if (!proposal?.acceptedAt) return FOUT("Ga eerst akkoord met het voorstel.");

  const agreement = await ensureAgreement(commerce, lead, proposal);
  if (!agreement) return FOUT("Er staat geen overeenkomst klaar.");
  if (agreement.status === "SIGNED") return OK(); // idempotent

  /*
   * De overeenkomst moet horen bij het voorstel waar de klant akkoord op gaf.
   * Is het voorstel intussen vervangen, dan tekent de klant iets anders dan
   * wat hij ziet — dat mag niet gebeuren.
   */
  if (agreement.proposalId !== proposal.id) {
    return FOUT("Het voorstel is intussen gewijzigd. Ververs de pagina en lees de nieuwe versie.");
  }

  const verplicht: [string, string][] = [
    ["naam", input.naam],
    ["functie", input.functie],
    ["e-mailadres", input.email],
    ["telefoonnummer", input.telefoon],
    ["bedrijfsnaam", input.bedrijfsnaam],
    ["adres", input.adres],
    ["postcode", input.postcode],
    ["plaats", input.plaats],
    ["KvK-nummer", input.kvk],
  ];
  const ontbreekt = verplicht.filter(([, v]) => !v?.trim()).map(([k]) => k);
  if (ontbreekt.length) return FOUT(`Vul nog in: ${ontbreekt.join(", ")}.`);

  const akkoorden = [
    input.agreesOpdracht,
    input.agreesInvestering,
    input.agreesTermijnen,
    input.agreesMaandbedrag,
    input.agreesVoorwaarden,
    input.agreesBevoegd,
  ];
  if (akkoorden.some((a) => !a)) {
    return FOUT("Vink alle punten aan om de overeenkomst te kunnen tekenen.");
  }

  const fp = await requestFingerprint();
  const nu = new Date();
  const t = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max) || null;

  const [signed] = await db
    .update(schema.agreements)
    .set({
      status: "SIGNED",
      signedAt: nu,
      signerName: t(input.naam, 160),
      signerRole: t(input.functie, 160),
      signerEmail: t(input.email, 320),
      signerPhone: t(input.telefoon, 60),
      signerCompany: t(input.bedrijfsnaam, 255),
      signerAddress: t(input.adres, 255),
      signerPostcode: t(input.postcode, 16),
      signerCity: t(input.plaats, 120),
      signerKvk: t(input.kvk, 40),
      signerVat: t(input.btw, 40),
      agreesOpdracht: true,
      agreesInvestering: true,
      agreesTermijnen: true,
      agreesMaandbedrag: true,
      agreesVoorwaarden: true,
      agreesBevoegd: true,
      signedIpHash: fp.ipHash,
      signedUserAgent: fp.userAgent,
    })
    /*
     * Elke nog-niet-getekende status mag ondertekend worden. Alleen op "SENT"
     * filteren gaat mis: het openen van de contractpagina zet de status al op
     * "VIEWED", en je moet een contract nu eenmaal openen om het te kunnen
     * tekenen. De voorwaarde blijft wél staan — hij houdt een tweede,
     * gelijktijdige poging tegen en voorkomt dat een SIGNED of SUPERSEDED
     * overeenkomst opnieuw wordt overschreven.
     */
    .where(
      and(
        eq(schema.agreements.id, agreement.id),
        inArray(schema.agreements.status, ["DRAFT", "SENT", "VIEWED"]),
      ),
    )
    .returning();

  // Geen rij terug? Dan heeft een gelijktijdige tweede poging al getekend.
  const definitief = signed ?? (await getCurrentAgreement(commerce.id));
  if (!definitief || definitief.status !== "SIGNED") {
    const opnieuw = await getCurrentAgreement(commerce.id);
    if (opnieuw?.status === "SIGNED") return OK();
    return FOUT("Ondertekenen lukte niet. Probeer het opnieuw.");
  }

  await setCommerceStatus(commerce.id, "DEPOSIT_PENDING");
  await setStage(lead.id, "aanbetaling", { actor: "klant", reden: "overeenkomst getekend" });
  await logJourneyEvent(
    lead.id,
    "agreement_signed",
    `Overeenkomst getekend door ${definitief.signerName} (${definitief.voorwaardenVersie})`,
    {
      actor: "klant",
      agreementId: definitief.id,
      proposalVersion: definitief.proposalVersion,
      ipHash: fp.ipHash,
    },
  );

  await registerDocument({
    leadId: lead.id,
    commerceId: commerce.id,
    type: "AGREEMENT",
    titel: `Samenwerkingsovereenkomst ${definitief.voorwaardenVersie}`,
    proposalId: definitief.proposalId,
    agreementId: definitief.id,
    snapshot: {
      voorwaardenVersie: definitief.voorwaardenVersie,
      getekendOp: nu.toISOString(),
      ondertekenaar: definitief.signerName,
      functie: definitief.signerRole,
      bedrijf: definitief.signerCompany,
      kvk: definitief.signerKvk,
      pricing: definitief.pricing,
    },
  });

  const L = pricingLabels(agreementPricing(definitief));
  await mailAndLog(lead, "agreement-signed", { amount: L.deposit }, portalUrl(token));

  revalidatePath(`/traject/${token}`);
  refresh(lead.id);
  return OK();
}

/**
 * Start een betaling. Het bedrag wordt UITSLUITEND hier server-side bepaald;
 * de browser geeft alleen door wélke termijn het betreft.
 */
export async function startPayment(
  token: string,
  kind: "deposit" | "final",
): Promise<CommerceState> {
  const ctx = await klantContext(token);
  if (!ctx) return FOUT("Deze link is niet (meer) geldig.");
  return startPaymentInternal(ctx.lead, ctx.commerce, kind, "klant", token);
}

/** Dezelfde betaalstap vanuit de admin (bijv. om de link te controleren). */
export async function startPaymentAsAdmin(
  leadId: string,
  kind: "deposit" | "final",
): Promise<CommerceState> {
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  return startPaymentInternal(
    ctx.lead,
    ctx.commerce,
    kind,
    "admin",
    ctx.commerce.portalToken ?? "",
  );
}

async function startPaymentInternal(
  lead: Lead,
  commerce: Commerce,
  kind: "deposit" | "final",
  actor: "klant" | "admin",
  token: string,
): Promise<CommerceState> {
  const db = getDb();
  if (!db) return FOUT("Tijdelijk niet beschikbaar.");

  /*
   * Eerst de inhoudelijke poortwachters, pas daarna de vraag of de
   * betaaldienst beschikbaar is. Andersom zou de klant "betalen is nog niet
   * geconfigureerd" te zien krijgen terwijl het echte antwoord is dat de
   * overeenkomst nog niet getekend is — een misleidende melding, en een die
   * verbergt dat de volgorde van de journey wordt bewaakt.
   */
  const proposal = await getActiveProposal(commerce.id);
  if (!proposal?.acceptedAt) return FOUT("Er is nog geen geaccepteerd voorstel.");

  const agreement = await getCurrentAgreement(commerce.id);
  if (!isSigned(agreement)) {
    return FOUT("De overeenkomst moet eerst ondertekend worden voordat je kunt betalen.");
  }
  if (agreement.proposalId !== proposal.id) {
    return FOUT("De overeenkomst hoort bij een ander voorstel. Neem even contact met ons op.");
  }

  // De bedragen komen uit de BEVROREN overeenkomst — niet uit de actuele
  // afspraak. Anders zou een prijswijziging na tekenen doorwerken.
  const snap = agreementPricing(agreement);
  const betaald = await paidTotal(commerce.id);
  const type = kind === "deposit" ? "DEPOSIT" : "FINAL_PAYMENT";

  let amountCents: number;
  if (kind === "deposit") {
    if (betaald > 0) return FOUT("De eerste termijn is al voldaan.");
    amountCents = snap.computed.depositCents;
  } else {
    if (!commerce.deliveryReadyAt) {
      return FOUT("De laatste termijn komt beschikbaar zodra het project wordt opgeleverd.");
    }
    amountCents = computeOutstanding(snap.config, betaald);
  }
  if (amountCents <= 0) return FOUT("Er staat op dit moment niets open.");

  // De journey klopt; nu pas is de betaaldienst zelf aan de beurt.
  if (!isMollieConfigured()) return FOUT("Betalen is nog niet geconfigureerd.");

  /*
   * Dubbelklik en dubbele betaling. Bestaat er al een openstaande betaling van
   * dit type, dan sturen we de klant naar diezelfde Mollie-checkout in plaats
   * van een tweede aan te maken.
   */
  const [bestaand] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.commerceId, commerce.id),
        eq(schema.payments.type, type),
        inArray(schema.payments.status, ["CREATED", "OPEN", "PENDING", "PAID"]),
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);

  if (bestaand?.status === "PAID") return FOUT("Deze termijn is al betaald.");
  if (bestaand?.molliePaymentId && ["OPEN", "PENDING"].includes(bestaand.status)) {
    const { getMolliePayment } = await import("@/lib/mollie");
    const live = await getMolliePayment(bestaand.molliePaymentId);
    const url = live?.getCheckoutUrl?.();
    if (url) return { status: "success", checkoutUrl: url };
  }

  const referentie = `DW-${lead.bedrijfsnaam.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}-${type}-${Date.now().toString(36)}`;

  /*
   * Bij de laatste termijn vestigen we tegelijk het SEPA-mandaat: de klant
   * ging bij het tekenen al akkoord met het maandbedrag; dit is de technische
   * activatie. Bij de eerste termijn bewust NIET — daar is nog geen
   * abonnement in zicht.
   */
  let mollieCustomerId = commerce.mollieCustomerId;
  const wilMandaat = kind === "final" && commerce.monthlyCents > 0;
  if (wilMandaat) {
    const { ensureMollieCustomer } = await import("@/lib/mollie");
    mollieCustomerId = await ensureMollieCustomer({
      existingId: commerce.mollieCustomerId,
      name: lead.bedrijfsnaam || lead.naam,
      email: lead.email,
    });
    if (mollieCustomerId && mollieCustomerId !== commerce.mollieCustomerId) {
      await db
        .update(schema.commerce)
        .set({ mollieCustomerId, updatedAt: new Date() })
        .where(eq(schema.commerce.id, commerce.id));
    }
  }

  const [record] = await db
    .insert(schema.payments)
    .values({
      commerceId: commerce.id,
      type,
      amountCents,
      status: "CREATED",
      proposalId: proposal.id,
      agreementId: agreement.id,
      referentie,
      sequenceType: wilMandaat ? "first" : "oneoff",
      mollieCustomerId: wilMandaat ? mollieCustomerId : null,
    })
    .returning();

  const result = await createMolliePayment({
    amountCents,
    description: `DogWare ${kind === "deposit" ? "eerste termijn" : "laatste termijn"} — ${lead.bedrijfsnaam}`.slice(0, 255),
    redirectUrl: portalUrl(token, "/betaald"),
    metadata: { paymentId: record.id, leadId: lead.id, commerceId: commerce.id, type },
    reference: referentie,
    sequenceType: wilMandaat ? "first" : "oneoff",
    mollieCustomerId: wilMandaat ? mollieCustomerId : null,
  });

  if (!result.ok) {
    await db
      .update(schema.payments)
      .set({ status: "FAILED", failureReason: result.message })
      .where(eq(schema.payments.id, record.id));
    return FOUT(result.message);
  }

  await db
    .update(schema.payments)
    .set({
      molliePaymentId: result.molliePaymentId,
      status: "OPEN",
      sequenceType: result.usedSequence,
    })
    .where(eq(schema.payments.id, record.id));

  await setCommerceStatus(
    commerce.id,
    kind === "deposit" ? "DEPOSIT_PENDING" : "FINAL_PAYMENT_PENDING",
  );
  await logJourneyEvent(
    lead.id,
    "payment_created",
    `${kind === "deposit" ? "Eerste" : "Laatste"} termijn gestart (${euroFromCents(amountCents)})`,
    { actor, referentie, molliePaymentId: result.molliePaymentId },
  );

  return { status: "success", checkoutUrl: result.checkoutUrl };
}

/**
 * Handmatig het mandaat/abonnement (opnieuw) proberen te activeren. Nodig
 * wanneer de klant met een methode zonder machtiging heeft betaald.
 */
export async function retryMandate(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  await activateMandateAndSubscription(ctx.commerce.id);
  const bijgewerkt = await getCommerceForLead(leadId);
  refresh(leadId);
  return bijgewerkt?.mandateActivatedAt
    ? OK("Mandaat actief en abonnement ingepland.")
    : FOUT("Er is nog geen geldig mandaat gevonden bij Mollie.");
}

/** Kleine hulp voor de UI: is er iets dat de admin moet weten? */
export async function currentAgreementFor(leadId: string): Promise<Agreement | null> {
  if (!(await getAdminActor())) return null;
  const commerce = await getCommerceForLead(leadId);
  return commerce ? getCurrentAgreement(commerce.id) : null;
}
