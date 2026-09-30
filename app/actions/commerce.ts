"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agreement, Commerce, Lead, PaymentInstallment, PaymentType } from "@/lib/db/schema";
import { getAdminActor } from "@/lib/admin-auth";
import { logActivity } from "@/lib/audit";
import { isUniekeSchending } from "@/lib/db-errors";
import { logJourneyEvent, setStage } from "@/lib/journey";
import {
  abonnementNaOplevering,
  activateMandateAndSubscription,
  getCommerceForLead,
  mailAndLog,
  paidTotal,
  processPaymentByMollieId,
  setCommerceStatus,
} from "@/lib/commerce";
import {
  attachAttempt,
  ensureSchedule,
  feitenVan,
  laatstePogingen,
  scheduleForCommerce,
  setDeliveryDueDates,
} from "@/lib/payment-schedule";
import {
  datumLang,
  isBetaalbaar,
  normalizePlan,
  opentOp,
  regelingTitel,
  regelingZin,
} from "@/lib/payment-plan";
import { leesAfspraak } from "@/lib/betaalafspraak";
import {
  checkRegeling,
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
import {
  acceptProposalBySignature,
  agreementPricing,
  ensureAgreement,
  getCurrentAgreement,
  isSigned,
} from "@/lib/agreements";
import { isDirectJourney, opdrachtWoord, overeenkomstPoort } from "@/lib/journey-variant";
import { registerDocument } from "@/lib/documents";
import { notifyPartner } from "@/lib/partner-notify";
import {
  createMolliePayment,
  getMolliePayment,
  isMollieConfigured,
  mapMollieStatus,
} from "@/lib/mollie";
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
  if (isDirectJourney(ctx.lead.journeyVariant)) {
    return FOUT("Dit is een directe klant — daar hoort geen demo-akkoord bij.");
  }

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

  const startRule = normalizeStartRule(String(formData.get("startRule") ?? ""));
  const startAtRaw = String(formData.get("startAt") ?? "").trim();
  const veld = (k: string, anders = "") => {
    const v = formData.get(k);
    return v === null ? anders : String(v);
  };

  /*
   * Bedragen en betaalregeling via dezelfde lezer als de live preview in de
   * editor (lib/betaalafspraak.ts): wat de beheerder ziet vóór opslaan is
   * precies wat hier wordt opgeslagen. Alleen de KEUZE van de regeling komt
   * uit het formulier; bedragen per termijn rekent de server zelf uit.
   * Onbekende invoer wordt 50/50.
   */
  const { config, plan } = leesAfspraak(
    {
      project: veld("project"),
      setup: veld("setup"),
      discountType: veld("discountType", "none"),
      discountValue: veld("discountValue"),
      vat: veld("vat"),
      depositPercent: veld("depositPercent"),
      monthly: veld("monthly"),
      paymentPlan: veld("paymentPlan", ctx.commerce.paymentPlan),
      installmentCount: veld("installmentCount", String(ctx.commerce.installmentCount)),
      installmentStart: veld("installmentStart", ctx.commerce.installmentStart),
      installmentStartDate: veld("installmentStartDate"),
    },
    {
      freeMonths: intVal(formData.get("freeMonths")),
      introDiscountPercent: pctVal(formData.get("introPercent")),
      introDiscountMonths: intVal(formData.get("introMonths")),
    },
  );
  if (
    formData.get("installmentStart") === "datum" &&
    plan.soort === "termijnen" &&
    !plan.startDatum
  ) {
    return FOUT("Kies een geldige startdatum voor de eerste termijn.");
  }

  await db
    .update(schema.commerce)
    .set({
      projectCents: config.projectCents,
      setupCents: config.setupCents,
      discountType: config.discountType,
      discountValue: config.discountValue,
      vatPercent: config.vatPercent,
      depositPercent: config.depositPercent,
      monthlyCents: config.monthlyCents,
      freeMonths: config.freeMonths,
      introDiscountPercent: config.introDiscountPercent,
      introDiscountMonths: config.introDiscountMonths,
      subscriptionStartRule: startRule,
      subscriptionStartAt:
        startRule === "handmatig" && startAtRaw ? new Date(`${startAtRaw}T00:00:00`) : null,
      opmerkingen: String(formData.get("opmerkingen") ?? "").trim() || null,
      paymentPlan: plan.soort,
      // Bij 50/50 en "in één keer" blijft het laatst gekozen aantal staan, zodat
      // terugschakelen naar termijnen de eerdere keuze teruggeeft.
      installmentCount: plan.soort === "termijnen" ? plan.aantal : ctx.commerce.installmentCount,
      installmentStart: plan.start,
      installmentStartDate: plan.startDatum,
      updatedAt: new Date(),
    })
    .where(eq(schema.commerce.id, ctx.commerce.id));

  const vorige = normalizePlan({
    soort: ctx.commerce.paymentPlan,
    aantal: ctx.commerce.installmentCount,
    start: ctx.commerce.installmentStart,
    startDatum: ctx.commerce.installmentStartDate,
  });
  if (JSON.stringify(vorige) !== JSON.stringify(plan)) {
    await logActivity({
      actorUserId: ctx.actorId,
      action: "PAYMENT_PLAN_CHANGED",
      objectType: "lead",
      objectId: leadId,
      oldValue: vorige,
      newValue: plan,
    });
    await logJourneyEvent(
      leadId,
      "payment_plan_changed",
      `Betaalregeling in concept gewijzigd: ${regelingTitel(plan)}`,
      { actor: "admin", internal: true, plan },
    );
  }

  /*
   * Direct terugmelden als de regeling zo niet verstuurd kan worden (een
   * termijn van een paar cent), in plaats van pas bij het versturen.
   */
  const [bijgewerkt] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.id, ctx.commerce.id))
    .limit(1);
  const check = bijgewerkt ? checkRegeling(bijgewerkt) : { ok: true as const };
  refresh(leadId);
  if (!check.ok && bijgewerkt && bijgewerkt.projectCents + bijgewerkt.setupCents > 0) {
    return FOUT(`Opgeslagen, maar zo kan het niet de deur uit: ${check.reden}`);
  }
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

  const w = opdrachtWoord(ctx.lead.journeyVariant);
  const draft = await createOrGetDraft(ctx.commerce, ctx.lead, ctx.actorId);
  if (!draft) return FOUT(`Kon geen ${w.naam} aanmaken.`);
  if (draft.version === 1) {
    await setStage(leadId, "offerte", { actor: "admin", reden: `${w.naam} aangemaakt` });
    await logJourneyEvent(leadId, "proposal_created", `${w.Naam} concept aangemaakt (versie 1)`, {
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
          ? `${opdrachtWoord(ctx.lead.journeyVariant).Naam === "Voorstel" ? "Dit voorstel" : "Deze opdrachtbevestiging"} is al verstuurd en kan niet meer worden gewijzigd. Maak een nieuwe versie.`
          : "Opslaan lukte niet.",
    };
  }
  return { ok: true };
}

/**
 * Verstuurt het concept definitief. Vanaf hier is de versie onveranderlijk.
 *
 * Twee routes, één actie:
 *  - demo:   het voorstel gaat naar de klant, die er apart akkoord op geeft;
 *  - direct: de versie wordt als opdrachtbevestiging bevroren en de
 *            overeenkomst staat meteen klaar om te tekenen. Er wordt géén
 *            akkoord verondersteld — dat ontstaat pas bij de handtekening.
 */
export async function sendProposal(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  const { lead, commerce } = ctx;
  const direct = isDirectJourney(lead.journeyVariant);
  const w = opdrachtWoord(lead.journeyVariant);

  const draft = await getDraftProposal(commerce.id);
  if (!draft) return FOUT(`Er is geen concept om te versturen. Maak eerst ${direct ? "een opdrachtbevestiging" : "een voorstel"}.`);

  const cfg = toConfig(commerce);
  if (cfg.projectCents + cfg.setupCents <= 0) {
    return FOUT(`Vul eerst de eenmalige investering in — ${direct ? "een opdrachtbevestiging" : "een voorstel"} van € 0,00 versturen we niet.`);
  }
  if (!draft.titel.trim()) return FOUT(`Geef ${w.deNaam} een titel.`);
  const regelingCheck = checkRegeling(commerce);
  if (!regelingCheck.ok) return FOUT(regelingCheck.reden);

  /*
   * Is er al getekend, dan ligt de opdracht juridisch vast. Een nieuwe versie
   * zou naast een getekende overeenkomst komen te staan waar de klant nooit
   * mee instemde — dat hoort via een nieuw gesprek, niet via deze knop.
   */
  if (direct && isSigned(await getCurrentAgreement(commerce.id))) {
    return FOUT("De overeenkomst is al getekend. Een nieuwe versie versturen kan niet meer.");
  }

  const sent = await markProposalSent(draft, commerce);
  // Geen rij terug: een gelijktijdige klik was ons voor. Niets dubbel versturen.
  if (!sent) return FOUT(`Deze versie is al verstuurd. Ververs de pagina.`);

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
    titel: `${w.Naam} versie ${sent.version} — ${sent.titel}`,
    proposalId: sent.id,
    snapshot: { versie: sent.version, pricing: sent.pricing },
  });

  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;

  if (direct) {
    // De overeenkomst hoort bij precies deze bevroren versie.
    const agreement = await ensureAgreement(commerce, lead, sent);
    if (!agreement || agreement.proposalId !== sent.id) {
      return FOUT("De opdrachtbevestiging is vastgelegd, maar de overeenkomst kon niet worden klaargezet.");
    }

    await logJourneyEvent(leadId, "proposal_sent", `Opdrachtbevestiging versie ${sent.version} verstuurd`, {
      actor: "admin",
      version: sent.version,
    });
    await setStage(leadId, "overeenkomst", {
      actor: "admin",
      reden: `opdrachtbevestiging versie ${sent.version}`,
    });
    await logJourneyEvent(
      leadId,
      "agreement_ready",
      `Overeenkomst klaargezet bij opdrachtbevestiging versie ${sent.version}`,
      { actor: "admin", voorwaardenVersie: agreement.voorwaardenVersie, version: sent.version },
    );

    const regeling = readPricing(sent, commerce).betaalregeling;
    const gelukt = await mailAndLog(
      lead,
      "agreement-ready",
      regeling && regeling.soort !== "50-50" ? { regeling: regelingZin(regeling) } : {},
      link ? `${link}/overeenkomst` : undefined,
    );
    await notifyPartner(leadId, "voorstel-verstuurd");
    await logActivity({
      actorUserId: ctx.actorId,
      action: "ASSIGNMENT_SENT",
      objectType: "lead",
      objectId: leadId,
      newValue: { version: sent.version, agreementId: agreement.id },
    });
    refresh(leadId);
    return gelukt
      ? OK(`Opdrachtbevestiging versie ${sent.version} klaargezet ter ondertekening en verstuurd naar ${lead.email}.`)
      : OK("Opdrachtbevestiging en overeenkomst staan klaar, maar de mail kon niet worden verzonden. Probeer 'herinnering sturen'.");
  }

  await setStage(leadId, "voorstel-verstuurd", { actor: "admin", reden: `versie ${sent.version}` });
  await logJourneyEvent(leadId, "proposal_sent", `Voorstel versie ${sent.version} verstuurd`, {
    actor: "admin",
    version: sent.version,
  });

  const gelukt = await mailAndLog(lead, "proposal-sent", {}, link);

  // Aangebracht door een partner? Die hoort te weten dat zijn aanbreng vordert.
  await notifyPartner(leadId, "voorstel-verstuurd");

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

  /*
   * Bij een betaalschema komt het bedrag van de eerste betaling uit de
   * getekende termijn — niet uit "totaal × aanbetalingspercentage", want bij
   * termijnen of "in één keer" is dat een ander bedrag.
   */
  const rijen = await scheduleForCommerce(commerce.id);
  const plan = rijen[0]?.plan ?? null;
  const eersteBedrag = rijen[0] ? euroFromCents(rijen[0].amountInclVatCents) : L.deposit;
  const volgendeTermijn = rijen.find((r) => r.status === "GEPLAND" && r.volgnummer > 1 && r.dueAt);

  const map: Record<string, { type: Parameters<typeof mailAndLog>[1]; vars: Parameters<typeof mailAndLog>[2] }> = {
    demo: { type: "demo-reminder", vars: {} },
    voorstel: { type: "proposal-reminder", vars: {} },
    overeenkomst: { type: "agreement-reminder", vars: {} },
    aanbetaling: { type: "deposit-reminder", vars: { amount: eersteBedrag } },
    restbetaling: { type: "final-reminder", vars: { amount: euroFromCents(outstanding) } },
    ...(volgendeTermijn
      ? {
          termijn: {
            type: "installment-reminder" as const,
            vars: {
              amount: euroFromCents(volgendeTermijn.amountInclVatCents),
              extra: `Termijn ${volgendeTermijn.volgnummer} van ${volgendeTermijn.aantal} (vervaldatum ${datumLang(volgendeTermijn.dueAt!)})`,
            },
          },
        }
      : {}),
  };
  const keuze = map[soort];
  if (!keuze) {
    return FOUT(soort === "termijn" ? "Er staat geen volgende termijn open." : "Onbekende herinnering.");
  }
  if (soort === "restbetaling" && plan && plan !== "50-50") {
    return FOUT("Bij deze betaalregeling is er geen slotbetaling bij oplevering.");
  }
  // Een directe klant heeft geen demo en geen los voorstel om aan te herinneren.
  if (isDirectJourney(lead.journeyVariant) && (soort === "demo" || soort === "voorstel")) {
    return FOUT("Dit is een directe klant — stuur een herinnering voor de opdrachtbevestiging.");
  }

  // Waar de knop in de mail heen wijst. Bij een demo-herinnering is dat het
  // voorbeeld zelf — daar gaat de vraag over. Zonder demolink valt hij terug
  // op het portaal, want een mail zonder bestemming heeft geen zin.
  const bestemming =
    soort === "demo"
      ? (lead.demoDomain?.trim() || lead.demoPortalUrl?.trim() || link)
      : soort === "overeenkomst"
        ? link
          ? `${link}/overeenkomst`
          : undefined
        : link;

  const gelukt = await mailAndLog(lead, keuze.type, keuze.vars, bestemming);
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

  // Een termijn "bij oplevering" (50/50 met schema) krijgt nu zijn datum.
  await setDeliveryDueDates(commerce.id, commerce.deliveryReadyAt ?? new Date());

  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;

  /*
   * In één keer of in termijnen: er is geen slotbetaling die de oplevering
   * afrondt. De klant krijgt te horen dat het klaar is en hoe zijn termijnen
   * doorlopen; het abonnement wordt nu ingepland (als het mandaat er is).
   */
  const rijen = await scheduleForCommerce(commerce.id);
  const plan = rijen[0]?.plan;
  if (plan && plan !== "50-50") {
    const open = rijen.filter((r) => r.status === "GEPLAND");
    const volgende = open[0];
    const extra =
      open.length === 0
        ? "De eenmalige investering is helemaal voldaan — er staat niets meer voor je open."
        : `Je termijnen lopen gewoon door volgens je betaalafspraak: nog ${euroFromCents(open.reduce((s2, r) => s2 + r.amountExVatCents, 0))} excl. btw in ${open.length === 1 ? "1 termijn" : `${open.length} termijnen`}${volgende?.dueAt ? `, de volgende op ${datumLang(volgende.dueAt)}` : ""}.`;
    const gelukt = await mailAndLog(lead, "delivery-ready-plan", { extra }, link);
    await abonnementNaOplevering(commerce.id);
    refresh(leadId);
    return gelukt
      ? OK("Oplevering klaargezet en de klant is geïnformeerd.")
      : OK("Oplevering klaargezet, maar de mail kon niet worden verzonden.");
  }

  const outstanding = computeOutstanding(snap.config, betaald);
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
  const rijen = await scheduleForCommerce(commerce.id);
  const plan = rijen[0]?.plan;
  if (plan && plan !== "50-50") {
    /*
     * Bij termijnen gaat de website live terwijl er nog termijnen lopen — dat
     * is precies de afspraak. Wat niet mag: live gaan terwijl een termijn die
     * al verschuldigd IS, nog openstaat.
     */
    const nu = new Date();
    const achterstallig = rijen.find(
      (r) => r.status === "GEPLAND" && r.dueAt && r.dueAt.getTime() <= nu.getTime(),
    );
    if (achterstallig || rijen[0].status !== "BETAALD") {
      const t = achterstallig ?? rijen[0];
      return FOUT(
        `Termijn ${t.volgnummer} van ${t.aantal} (${euroFromCents(t.amountInclVatCents)}) is verschuldigd en nog niet betaald — live zetten kan pas als de verschuldigde termijnen binnen zijn.`,
      );
    }
  } else {
    const openstaand = computeOutstanding(snap.config, await paidTotal(commerce.id));
    if (openstaand > 0) {
      return FOUT(`Er staat nog ${euroFromCents(openstaand)} open — live zetten kan pas na de laatste termijn.`);
    }
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

/**
 * Nieuwe taak bij een aanvraag.
 *
 * De deadline is optioneel: niet elke taak heeft er een, en een verzonnen datum
 * is erger dan geen datum — dan gaat de kleur "te laat" niets meer betekenen.
 *
 * De taak komt op naam van wie hem aanmaakt. Met één beheerder is dat weinig
 * spannend, maar het staat vast op het moment dat het gebeurt in plaats van
 * achteraf gereconstrueerd te moeten worden.
 */
export async function addTask(
  _prev: CommerceState,
  formData: FormData,
): Promise<CommerceState> {
  const leadId = String(formData.get("leadId") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 200);
  const deadline = String(formData.get("dueAt") ?? "").trim();

  const ctx = await adminContext(leadId);
  if (!ctx) return FOUT("Geen toegang.");
  if (!label) return FOUT("Geef de taak een omschrijving.");

  // Een datum uit een date-input is lokale tijd zonder tijd erbij; eind van de
  // dag is wat iemand bedoelt met "af op 3 september".
  let dueAt: Date | null = null;
  if (deadline) {
    const d = new Date(`${deadline}T23:59:59`);
    if (Number.isNaN(d.getTime())) return FOUT("Die datum begrijp ik niet.");
    dueAt = d;
  }

  const db = getDb()!;
  await db.insert(schema.journeyTasks).values({
    leadId,
    label,
    dueAt,
    assigneeUserId: ctx.actorId,
  });
  refresh(leadId);
  return OK("Taak toegevoegd.");
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

  /*
   * Een directe klant geeft geen los akkoord: de handtekening onder de
   * overeenkomst is het akkoord. Deze route blijft voor hem dicht, zodat er
   * nooit een tweede, los vastgelegde instemming naast de handtekening ontstaat.
   */
  if (isDirectJourney(lead.journeyVariant)) {
    return FOUT("Je geeft akkoord door de opdrachtbevestiging digitaal te ondertekenen.");
  }

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
  await notifyPartner(lead.id, "voorstel-akkoord");
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

  const direct = isDirectJourney(lead.journeyVariant);
  const proposal = await getActiveProposal(commerce.id);

  /*
   * Demo: alleen na een apart akkoord op het voorstel (ongewijzigd).
   * Direct: de handtekening ís het akkoord; er moet een definitief verstuurde
   * opdrachtbevestiging liggen. Zie overeenkomstPoort.
   */
  const poort = overeenkomstPoort(lead.journeyVariant, proposal);
  if (!poort.ok || !proposal) return FOUT(poort.ok ? "Er staat geen overeenkomst klaar." : poort.reden);

  const agreement = await ensureAgreement(commerce, lead, proposal);
  if (!agreement) return FOUT("Er staat geen overeenkomst klaar.");
  if (agreement.status === "SIGNED") {
    // Idempotent. Bij een directe klant herstellen we zo ook een eerste poging
    // die tussen handtekening en vastlegging van het akkoord werd onderbroken.
    if (direct && agreement.proposalId === proposal.id) {
      await acceptProposalBySignature(agreement, proposal);
    }
    return OK();
  }

  /*
   * De overeenkomst moet horen bij het voorstel waar de klant akkoord op gaf.
   * Is het voorstel intussen vervangen, dan tekent de klant iets anders dan
   * wat hij ziet — dat mag niet gebeuren.
   */
  if (agreement.proposalId !== proposal.id) {
    return FOUT(
      `${direct ? "De opdrachtbevestiging" : "Het voorstel"} is intussen gewijzigd. Ververs de pagina en lees de nieuwe versie.`,
    );
  }
  if (direct) {
    const bijOvereenkomst = overeenkomstPoort(lead.journeyVariant, proposal, agreement);
    if (!bijOvereenkomst.ok) return FOUT(bijOvereenkomst.reden);
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

  /*
   * Geen rij terug? Dan heeft een gelijktijdige tweede poging al getekend. Die
   * poging handelt de gevolgen (document, mail, stage) af — wij stoppen hier,
   * anders krijgt de klant alles twee keer.
   */
  if (!signed) {
    const opnieuw = await getCurrentAgreement(commerce.id);
    if (opnieuw?.status === "SIGNED") {
      if (direct && opnieuw.proposalId === proposal.id) {
        await acceptProposalBySignature(opnieuw, proposal);
      }
      return OK();
    }
    return FOUT("Ondertekenen lukte niet. Probeer het opnieuw.");
  }
  const definitief = signed;

  /*
   * Directe klant: pas nú — met de echte handtekening — wordt de
   * opdrachtbevestiging als geaccepteerd vastgelegd. Zelfde moment, zelfde
   * ondertekenaar, zelfde vingerafdruk. Vóór de stap naar de aanbetaling,
   * want de betaling vraagt om een geaccepteerde versie.
   */
  if (direct && (await acceptProposalBySignature(definitief, proposal))) {
    await logJourneyEvent(
      lead.id,
      "proposal_accepted",
      `Opdrachtbevestiging versie ${proposal.version} geaccepteerd door ondertekening (${definitief.signerName})`,
      { actor: "klant", version: proposal.version, agreementId: definitief.id, ipHash: fp.ipHash },
    );
  }

  /*
   * Het betaalschema ontstaat hier, uit de bevroren regeling in precies deze
   * getekende overeenkomst. Idempotent; bij een historische overeenkomst
   * (zonder regeling) gebeurt er niets en loopt alles zoals altijd.
   */
  const termijnen = await ensureSchedule(definitief);
  const regeling = agreementPricing(definitief).betaalregeling;

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
    titel: direct
      ? `Opdrachtbevestiging en samenwerkingsovereenkomst ${definitief.voorwaardenVersie}`
      : `Samenwerkingsovereenkomst ${definitief.voorwaardenVersie}`,
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

  /*
   * Het akkoord op de betaalregeling, apart en herleidbaar vastgelegd: welke
   * regeling, welke versie, welke bedragen. De juridische bron blijft de
   * getekende overeenkomst zelf (bevroren prijzen + het aangevinkte akkoord op
   * de termijnen); dit is de leesbare regel op de tijdlijn.
   */
  if (regeling) {
    await logJourneyEvent(
      lead.id,
      "payment_plan_agreed",
      `Akkoord op betaalregeling: ${regelingTitel(regeling, agreementPricing(definitief).computed.depositPercent)} (${direct ? "opdrachtbevestiging" : "voorstel"} versie ${definitief.proposalVersion})`,
      {
        actor: "klant",
        agreementId: definitief.id,
        proposalVersion: definitief.proposalVersion,
        plan: regeling.soort,
        termijnen: regeling.termijnen.map((t) => t.inclVatCents),
      },
    );
  }

  const L = pricingLabels(agreementPricing(definitief));
  const eerste = termijnen?.[0];
  await mailAndLog(
    lead,
    "agreement-signed",
    {
      amount: eerste ? euroFromCents(eerste.amountInclVatCents) : L.deposit,
      regeling: regeling && regeling.soort !== "50-50" ? regelingZin(regeling) : undefined,
    },
    portalUrl(token),
  );
  await notifyPartner(lead.id, "overeenkomst-getekend");

  revalidatePath(`/traject/${token}`);
  refresh(lead.id);
  return OK();
}

/**
 * Wat de browser mag vragen: wélke betaling, nooit welk bedrag.
 *
 *   deposit — de eerste betaling (aanbetaling, of termijn 1, of alles ineens);
 *   final   — het restant bij oplevering (alleen 50/50);
 *   termijn — de eerstvolgende termijn van een termijnregeling. Wélke termijn
 *             dat is, bepaalt de server: een termijn-id uit de browser wordt
 *             nergens geaccepteerd, dus er valt niets te raden.
 */
export type BetaalSoort = "deposit" | "final" | "termijn";

/**
 * Start een betaling. Het bedrag wordt UITSLUITEND hier server-side bepaald;
 * de browser geeft alleen door wélke termijn het betreft.
 */
export async function startPayment(
  token: string,
  kind: BetaalSoort,
): Promise<CommerceState> {
  const ctx = await klantContext(token);
  if (!ctx) return FOUT("Deze link is niet (meer) geldig.");
  if (!["deposit", "final", "termijn"].includes(kind)) return FOUT("Onbekende betaling.");
  return startPaymentInternal(ctx.lead, ctx.commerce, kind, "klant", token);
}

/** Dezelfde betaalstap vanuit de admin (bijv. om de link te controleren). */
export async function startPaymentAsAdmin(
  leadId: string,
  kind: BetaalSoort,
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
  kind: BetaalSoort,
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

  /*
   * Het betaalschema van deze overeenkomst (null bij een historische, van
   * vóór de betaalregelingen: die loopt precies zoals altijd). Idempotent —
   * ontbrak het door een onderbroken ondertekening, dan ontstaat het nu.
   */
  const rijen = await ensureSchedule(agreement);
  const plan = rijen?.[0]?.plan ?? null;
  const nu = new Date();

  let type: PaymentType;
  let amountCents: number;
  let termijn: PaymentInstallment | null = null;

  if (kind === "termijn") {
    if (plan !== "termijnen" || !rijen) return FOUT("Er is geen termijnregeling afgesproken.");
    const volgende = rijen.find((r) => r.status === "GEPLAND");
    if (!volgende) return FOUT("Alle termijnen zijn al betaald. Dank je wel!");
    // De eerste termijn is de start van de opdracht; die loopt via de aanbetaling.
    if (volgende.volgnummer === 1) return startPaymentInternal(lead, commerce, "deposit", actor, token);
    const pogingen = await laatstePogingen(rijen);
    const feiten = rijen.map((r) => feitenVan(r, pogingen.get(r.id)));
    if (!isBetaalbaar(feitenVan(volgende, pogingen.get(volgende.id)), feiten, nu)) {
      return FOUT(
        volgende.dueAt
          ? `Termijn ${volgende.volgnummer} kun je betalen vanaf ${datumLang(opentOp(volgende.dueAt))}.`
          : `Termijn ${volgende.volgnummer} is nog niet aan de beurt.`,
      );
    }
    termijn = volgende;
    type = "INSTALLMENT";
    amountCents = volgende.amountInclVatCents;
  } else if (kind === "deposit") {
    if (betaald > 0) return FOUT("De eerste termijn is al voldaan.");
    type = "DEPOSIT";
    if (rijen) {
      termijn = rijen[0];
      if (termijn.status === "BETAALD") return FOUT("De eerste termijn is al voldaan.");
      // Een termijnschema met een latere startdatum: niet vóór het venster.
      if (plan === "termijnen" && termijn.dueAt && nu.getTime() < opentOp(termijn.dueAt).getTime()) {
        return FOUT(`De eerste termijn kun je betalen vanaf ${datumLang(opentOp(termijn.dueAt))}.`);
      }
      amountCents = termijn.amountInclVatCents;
    } else {
      amountCents = snap.computed.depositCents;
    }
  } else {
    if (plan && plan !== "50-50") {
      return FOUT("Bij deze betaalregeling is er geen slotbetaling bij oplevering.");
    }
    if (!commerce.deliveryReadyAt) {
      return FOUT("De laatste termijn komt beschikbaar zodra het project wordt opgeleverd.");
    }
    type = "FINAL_PAYMENT";
    amountCents = computeOutstanding(snap.config, betaald);
    termijn = rijen?.find((r) => r.moment === "oplevering" && r.status === "GEPLAND") ?? null;
  }
  if (amountCents <= 0) return FOUT("Er staat op dit moment niets open.");

  // De journey klopt; nu pas is de betaaldienst zelf aan de beurt.
  if (!isMollieConfigured()) return FOUT("Betalen is nog niet geconfigureerd.");

  /*
   * Dubbelklik en dubbele betaling. Bestaat er al een openstaande betaling
   * voor deze termijn, dan sturen we de klant naar diezelfde Mollie-checkout
   * in plaats van een tweede aan te maken. Bij het betaalschema wordt op de
   * termijn zelf gezocht; bij historische betalingen, zoals altijd, op type.
   */
  const [bestaand] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.commerceId, commerce.id),
        termijn && type === "INSTALLMENT"
          ? eq(schema.payments.installmentId, termijn.id)
          : eq(schema.payments.type, type),
        inArray(schema.payments.status, ["CREATED", "OPEN", "PENDING", "PAID"]),
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);

  if (bestaand?.status === "PAID") return FOUT("Deze termijn is al betaald.");
  if (bestaand?.status === "CREATED" && termijn) {
    return FOUT("Er wordt al een betaling voor deze termijn gestart. Een moment geduld.");
  }
  if (bestaand?.molliePaymentId && ["OPEN", "PENDING"].includes(bestaand.status)) {
    const live = await getMolliePayment(bestaand.molliePaymentId);
    const url = live?.getCheckoutUrl?.();
    if (url) return { status: "success", checkoutUrl: url };

    if (termijn && live) {
      /*
       * Geen checkout meer. Dan eerst de echte stand bij Mollie volgen: is er
       * intussen betaald, dan verwerken we dat en starten we beslist geen
       * tweede betaling. Is hij verlopen of afgebroken, dan leggen we dat vast
       * (daarmee komt de termijn vrij) en maken we een nieuwe aan.
       */
      const echt = mapMollieStatus(live.status);
      if (echt === "PAID") {
        await processPaymentByMollieId(bestaand.molliePaymentId);
        return FOUT("Deze termijn is zojuist betaald. Ververs de pagina.");
      }
      if (echt === "OPEN" || echt === "PENDING") {
        return FOUT("Je vorige betaling wordt nog verwerkt. Probeer het over een paar minuten opnieuw.");
      }
      await db
        .update(schema.payments)
        .set({ status: echt })
        .where(and(eq(schema.payments.id, bestaand.id), inArray(schema.payments.status, ["OPEN", "PENDING"])));
    }
  }

  const soortLabel =
    type === "INSTALLMENT" && termijn
      ? `TERMIJN${termijn.volgnummer}`
      : type;
  const referentie = `DW-${lead.bedrijfsnaam.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}-${soortLabel}-${Date.now().toString(36)}`;

  /*
   * Het SEPA-mandaat voor het maandabonnement.
   *
   * 50/50 (en historisch): bij de laatste termijn, precies zoals altijd — de
   * klant ging bij het tekenen al akkoord met het maandbedrag; dit is de
   * technische activatie. Bij de eerste termijn bewust NIET.
   *
   * In één keer / in termijnen: er is geen slotbetaling. Het mandaat wordt
   * daarom gevestigd bij de eerste betaling onder de regeling (zo staat het
   * ook in artikel 6.3), en bij elke volgende zolang er nog geen is. Een
   * mandaat is geen incasso: er wordt pas geïncasseerd vanaf het afgesproken
   * startmoment van het abonnement.
   */
  let mollieCustomerId = commerce.mollieCustomerId;
  const heeftMandaat =
    Boolean(commerce.mandateActivatedAt) ||
    (
      await db
        .select({ id: schema.payments.id })
        .from(schema.payments)
        .where(
          and(
            eq(schema.payments.commerceId, commerce.id),
            eq(schema.payments.status, "PAID"),
            isNotNull(schema.payments.mollieMandateId),
          ),
        )
        .limit(1)
    ).length > 0;
  const wilMandaat =
    commerce.monthlyCents > 0 &&
    (kind === "final" || (plan !== null && plan !== "50-50" && !heeftMandaat));
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

  /*
   * De unieke index `payments_installment_active_idx` laat per termijn maar
   * één lopende betaling toe. Twee gelijktijdige kliks die allebei langs de
   * controle hierboven kwamen, stranden hier — de tweede krijgt een nette
   * melding in plaats van een tweede checkout.
   */
  let record: typeof schema.payments.$inferSelect;
  try {
    [record] = await db
      .insert(schema.payments)
      .values({
        commerceId: commerce.id,
        type,
        amountCents,
        status: "CREATED",
        proposalId: proposal.id,
        agreementId: agreement.id,
        installmentId: termijn?.id ?? null,
        referentie,
        sequenceType: wilMandaat ? "first" : "oneoff",
        mollieCustomerId: wilMandaat ? mollieCustomerId : null,
      })
      .returning();
  } catch (err) {
    if (isUniekeSchending(err, "payments_installment_active_idx")) {
      return FOUT("Er loopt al een betaling voor deze termijn. Ververs de pagina.");
    }
    throw err;
  }

  const omschrijving =
    type === "INSTALLMENT" && termijn
      ? `termijn ${termijn.volgnummer} van ${termijn.aantal}`
      : plan === "volledig"
        ? "eenmalige investering"
        : plan === "termijnen" && termijn
          ? `termijn 1 van ${termijn.aantal}`
          : kind === "deposit"
            ? "eerste termijn"
            : "laatste termijn";

  const result = await createMolliePayment({
    amountCents,
    description: `DogWare ${omschrijving} — ${lead.bedrijfsnaam}`.slice(0, 255),
    redirectUrl: portalUrl(token, "/betaald"),
    metadata: {
      paymentId: record.id,
      leadId: lead.id,
      commerceId: commerce.id,
      type,
      ...(termijn ? { installmentId: termijn.id } : {}),
    },
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
  if (termijn) await attachAttempt(termijn.id, { id: record.id, molliePaymentId: result.molliePaymentId });

  // Een latere termijn zet de commerciële status nooit terug.
  if (type !== "INSTALLMENT") {
    await setCommerceStatus(
      commerce.id,
      kind === "deposit" ? "DEPOSIT_PENDING" : "FINAL_PAYMENT_PENDING",
    );
  }
  await logJourneyEvent(
    lead.id,
    "payment_created",
    `${omschrijving.charAt(0).toUpperCase()}${omschrijving.slice(1)} gestart (${euroFromCents(amountCents)})`,
    { actor, referentie, molliePaymentId: result.molliePaymentId, installmentId: termijn?.id },
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
  /*
   * In één keer / in termijnen: het abonnement hoort pas na oplevering te
   * lopen. Deze knop mag dat moment niet naar voren halen.
   */
  const plan = (await scheduleForCommerce(ctx.commerce.id))[0]?.plan;
  if (plan && plan !== "50-50") {
    if (!ctx.commerce.deliveryReadyAt) {
      return FOUT("Het abonnement wordt pas na oplevering ingepland — het mandaat volgt vanzelf bij een termijnbetaling.");
    }
    await abonnementNaOplevering(ctx.commerce.id);
  } else {
    await activateMandateAndSubscription(ctx.commerce.id);
  }
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
