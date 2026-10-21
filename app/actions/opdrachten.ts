"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-auth";
import { requestFingerprint, resolvePortal } from "@/lib/portal-access";
import { ensureCommerce } from "@/lib/proposals";
import { sendCommerceProof } from "@/lib/email/send";
import { euroFromCents } from "@/lib/money";
import {
  accepteerOpdracht,
  bevriesInhoud,
  bewaarConcept,
  bewaarInterneNotitie,
  leverOpdrachtOp,
  maakConcept,
  maandZin,
  opdrachtUrl,
  pasOpdrachtAan,
  rondOpdrachtAf,
  startBouw,
  startOpdrachtBetaling,
  stuurHerinnering,
  trekOpdrachtIn,
  verlengOpdracht,
  verstuurOpdracht,
  type BetaalSoort,
  type ConceptInvoer,
  type Uitkomst,
} from "@/lib/opdrachten/service";

/**
 * Server actions voor aanvullende opdrachten.
 *
 * Beheer: elke actie controleert zelf de beheerderssessie (actions zijn ook
 * via een directe POST bereikbaar) én dat de opdracht bij déze klant hoort.
 * Klant: alleen via de sleutel van de eigen klantomgeving; de opdracht moet
 * bij dat dossier horen, anders bestaat hij niet.
 */

export type OpdrachtState = {
  status: "idle" | "success" | "error";
  message?: string;
  checkoutUrl?: string;
  id?: string;
};

const naarState = (u: { ok: true } | { ok: false; melding: string }, gelukt?: string): OpdrachtState =>
  u.ok ? { status: "success", message: gelukt } : { status: "error", message: u.melding };

function refresh(leadId: string, orderId?: string) {
  revalidatePath(`/admin/leads/${leadId}`);
  if (orderId) revalidatePath(`/admin/leads/${leadId}/opdrachten/${orderId}`);
}

async function beheerder(): Promise<string | null> {
  return (await getAdminActor())?.id ?? null;
}

/* ------------------------------------------------------------------ admin -- */

export async function nieuweOpdracht(leadId: string): Promise<OpdrachtState> {
  const actor = await beheerder();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const r = await maakConcept(leadId, actor);
  if (!r.ok) return { status: "error", message: r.melding };
  refresh(leadId);
  return { status: "success", id: r.data.id };
}

/** Automatisch opslaan van het concept. */
export async function bewaarOpdracht(
  leadId: string,
  orderId: string,
  invoer: ConceptInvoer,
): Promise<OpdrachtState> {
  if (!(await beheerder())) return { status: "error", message: "Geen toegang." };
  const commerce = await ensureCommerce(leadId);
  if (!commerce) return { status: "error", message: "Klant niet gevonden." };
  return naarState(await bewaarConcept(orderId, commerce.id, invoer));
}

export async function bewaarOpdrachtNotitie(
  leadId: string,
  orderId: string,
  notitie: string,
): Promise<OpdrachtState> {
  if (!(await beheerder())) return { status: "error", message: "Geen toegang." };
  const commerce = await ensureCommerce(leadId);
  if (!commerce) return { status: "error", message: "Klant niet gevonden." };
  return naarState(await bewaarInterneNotitie(orderId, commerce.id, notitie), "Notitie bewaard.");
}

export type OpdrachtActie =
  | "versturen"
  | "aanpassen"
  | "herinneren"
  | "start-bouw"
  | "opleveren"
  | "afronden";

/** Eén ingang voor de statusknoppen; elke stap bewaakt zelf zijn voorwaarden. */
export async function opdrachtActie(
  leadId: string,
  orderId: string,
  actie: OpdrachtActie,
): Promise<OpdrachtState> {
  const actor = await beheerder();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const stappen: Record<OpdrachtActie, [() => Promise<Uitkomst>, string]> = {
    versturen: [() => verstuurOpdracht(orderId, leadId, actor), "Verstuurd naar de klant."],
    aanpassen: [() => pasOpdrachtAan(orderId, leadId, actor), "De opdracht is weer concept. Pas aan en verstuur opnieuw."],
    herinneren: [() => stuurHerinnering(orderId, leadId, actor), "Herinnering verstuurd."],
    "start-bouw": [() => startBouw(orderId, leadId, actor), "Bouw gestart. De klant is gemaild."],
    opleveren: [() => leverOpdrachtOp(orderId, leadId, actor), "Opgeleverd. Het betaalverzoek voor de eindbetaling is verstuurd."],
    afronden: [() => rondOpdrachtAf(orderId, leadId, actor), "Afgerond."],
  };
  // Eigen sleutels alleen: een actie als "constructor" mag niet bij Object.prototype uitkomen.
  if (!Object.hasOwn(stappen, actie)) return { status: "error", message: "Onbekende actie." };
  const stap = stappen[actie];
  const r = await stap[0]();
  refresh(leadId, orderId);
  return naarState(r, stap[1]);
}

export async function verlengOpdrachtActie(
  leadId: string,
  orderId: string,
  datum: string,
): Promise<OpdrachtState> {
  const actor = await beheerder();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const r = await verlengOpdracht(orderId, leadId, actor, datum);
  refresh(leadId, orderId);
  return naarState(r, "Geldigheid aangepast.");
}

export async function trekOpdrachtInActie(
  leadId: string,
  orderId: string,
  reden: string,
): Promise<OpdrachtState> {
  const actor = await beheerder();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const r = await trekOpdrachtIn(orderId, leadId, actor, reden);
  refresh(leadId, orderId);
  return naarState(r, "Ingetrokken.");
}

/**
 * Een proef van de voorstelmail, naar de vaste proefontvanger — nooit naar de
 * klant. Leest het bewaarde concept, met dezelfde berekening als versturen.
 */
export async function stuurOpdrachtProef(leadId: string, orderId: string): Promise<OpdrachtState> {
  if (!(await beheerder())) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };
  const [rij] = await db
    .select({ order: schema.extraOrders, lead: schema.leads, commerce: schema.commerce })
    .from(schema.extraOrders)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.extraOrders.leadId))
    .innerJoin(schema.commerce, eq(schema.commerce.id, schema.extraOrders.commerceId))
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.leadId, leadId)))
    .limit(1);
  if (!rij?.commerce.portalToken) return { status: "error", message: "Opdracht niet gevonden." };
  const inhoud = bevriesInhoud(rij.order, rij.commerce, rij.order.version + 1);
  const res = await sendCommerceProof(
    "opdracht-sent",
    { naam: rij.lead.naam, email: rij.lead.email },
    {
      titel: inhoud.titel || "(nog zonder titel)",
      amount: `${euroFromCents(inhoud.bedragen.exVatCents)} excl. btw`,
      extra: maandZin(inhoud) ?? undefined,
    },
    opdrachtUrl(rij.commerce.portalToken, orderId),
  );
  return res.ok
    ? { status: "success", message: `Proef verstuurd naar ${res.naar}.` }
    : { status: "error", message: res.error.message };
}

/* ------------------------------------------------------------------ klant -- */

export async function accepteerOpdrachtActie(
  token: string,
  orderId: string,
  invoer: { versie: number; naam: string; agreesOpdracht: boolean; agreesMaandbedrag: boolean },
): Promise<OpdrachtState> {
  const ctx = await resolvePortal(token);
  if (!ctx) return { status: "error", message: "Deze link is niet (meer) geldig." };
  const fp = await requestFingerprint();
  const r = await accepteerOpdracht(ctx.lead, ctx.commerce, orderId, {
    versie: Number(invoer.versie),
    naam: String(invoer.naam ?? ""),
    agreesOpdracht: invoer.agreesOpdracht === true,
    agreesMaandbedrag: invoer.agreesMaandbedrag === true,
    ipHash: fp.ipHash,
    userAgent: fp.userAgent,
  });
  revalidatePath(`/traject/${token}`);
  revalidatePath(`/traject/${token}/opdracht/${orderId}`);
  refresh(ctx.lead.id, orderId);
  return naarState(r);
}

export async function betaalOpdrachtActie(
  token: string,
  orderId: string,
  soort: BetaalSoort,
): Promise<OpdrachtState> {
  const ctx = await resolvePortal(token);
  if (!ctx) return { status: "error", message: "Deze link is niet (meer) geldig." };
  const r = await startOpdrachtBetaling(ctx.lead, ctx.commerce, orderId, soort, "klant");
  if (!r.ok) return { status: "error", message: r.melding };
  return { status: "success", checkoutUrl: r.data.checkoutUrl };
}
