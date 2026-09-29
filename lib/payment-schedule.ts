import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agreement, Payment, PaymentInstallment } from "@/lib/db/schema";
import { logJourneyEvent } from "@/lib/journey";
import { euroFromCents } from "@/lib/money";
import type { PricingSnapshot } from "@/lib/proposals";
import {
  TERMIJN_STATUS_LABEL,
  ankerVoor,
  datumLang,
  isBetaalbaar,
  kalenderdagVan,
  opentOp,
  termijnStatus,
  vervaldata,
  voortgang,
  type BetaalRegeling,
  type TermijnStatus,
  type Voortgang,
} from "@/lib/payment-plan";

/**
 * Het betaalschema: de termijnen van de eenmalige investering, per getekende
 * overeenkomst.
 *
 * Eén keer aangemaakt uit de BEVROREN regeling in de overeenkomst — het is
 * precies wat de klant heeft getekend, en wordt daarna nooit herberekend.
 * Betalingen (payments.installmentId), facturen (documentId) en de tijdlijn
 * hangen hieraan. Geen tweede administratie: dit is de lijst waar de
 * bestaande betalingen en facturen aan gekoppeld worden.
 *
 * Een overeenkomst zonder bevroren regeling (getekend vóór de
 * betaalregelingen) krijgt géén schema en loopt ongewijzigd via de bestaande
 * aanbetaling en restbetaling.
 */

/** De bevroren regeling van een overeenkomst, of null bij een historische. */
export function regelingVan(agreement: Pick<Agreement, "pricing">): BetaalRegeling | null {
  const snap = agreement.pricing as unknown as PricingSnapshot | undefined;
  const r = snap?.betaalregeling;
  return r && Array.isArray(r.termijnen) && r.termijnen.length > 0 ? r : null;
}

/**
 * Zorgt dat het schema van een getekende overeenkomst bestaat.
 *
 * Idempotent: de unieke index op (overeenkomst, volgnummer) maakt dat een
 * tweede aanroep — een herhaalde ondertekening, een gelijktijdige
 * betaalpoging — niets dubbel aanmaakt. Geeft null bij een historische
 * overeenkomst of een die nog niet getekend is.
 */
export async function ensureSchedule(agreement: Agreement): Promise<PaymentInstallment[] | null> {
  const db = getDb();
  if (!db) return null;
  if (agreement.status !== "SIGNED" || !agreement.signedAt) return null;
  const regeling = regelingVan(agreement);
  if (!regeling) return null;

  const bestaand = await scheduleForAgreement(agreement.id);
  if (bestaand.length === regeling.termijnen.length) return bestaand;

  const data = vervaldata(regeling, ankerVoor(regeling, agreement.signedAt));
  await db
    .insert(schema.paymentInstallments)
    .values(
      regeling.termijnen.map((t, i) => ({
        commerceId: agreement.commerceId,
        leadId: agreement.leadId,
        agreementId: agreement.id,
        proposalId: agreement.proposalId,
        plan: regeling.soort,
        volgnummer: t.volgnummer,
        aantal: regeling.termijnen.length,
        moment: t.moment,
        dueAt: data[i],
        amountExVatCents: t.exVatCents,
        vatCents: t.vatCents,
        amountInclVatCents: t.inclVatCents,
        vatPercent: regeling.vatPercent,
      })),
    )
    .onConflictDoNothing();

  const rijen = await scheduleForAgreement(agreement.id);
  if (bestaand.length === 0 && rijen.length > 0) {
    await logJourneyEvent(
      agreement.leadId,
      "payment_schedule_created",
      `Betaalschema vastgelegd: ${rijen.length === 1 ? "1 betaling" : `${rijen.length} termijnen`} (${euroFromCents(regeling.totaalExVatCents)} excl. btw)`,
      { actor: "systeem", agreementId: agreement.id, plan: regeling.soort },
    );
  }
  return rijen;
}

export async function scheduleForAgreement(agreementId: string): Promise<PaymentInstallment[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.paymentInstallments)
    .where(eq(schema.paymentInstallments.agreementId, agreementId))
    .orderBy(asc(schema.paymentInstallments.volgnummer));
}

/**
 * Het geldende schema van een dossier: dat van de getekende overeenkomst.
 * Leeg bij een historische overeenkomst of als er nog niet getekend is.
 */
export async function scheduleForCommerce(commerceId: string): Promise<PaymentInstallment[]> {
  const db = getDb();
  if (!db) return [];
  const [getekend] = await db
    .select({ id: schema.agreements.id })
    .from(schema.agreements)
    .where(and(eq(schema.agreements.commerceId, commerceId), eq(schema.agreements.status, "SIGNED")))
    .orderBy(desc(schema.agreements.signedAt))
    .limit(1);
  return getekend ? scheduleForAgreement(getekend.id) : [];
}

/**
 * Oplevering bekend: een termijn die "bij oplevering" verschuldigd is krijgt
 * nu zijn vervaldatum. Alleen als hij er nog geen had — nooit overschrijven.
 */
export async function setDeliveryDueDates(commerceId: string, oplevering: Date): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(schema.paymentInstallments)
    .set({ dueAt: kalenderdagVan(oplevering), updatedAt: new Date() })
    .where(
      and(
        eq(schema.paymentInstallments.commerceId, commerceId),
        eq(schema.paymentInstallments.moment, "oplevering"),
        isNull(schema.paymentInstallments.dueAt),
      ),
    );
}

/** Koppelt een (nieuwe) betaalpoging aan de termijn, zolang die niet betaald is. */
export async function attachAttempt(installmentId: string, payment: Pick<Payment, "id" | "molliePaymentId">) {
  const db = getDb();
  if (!db) return;
  await db
    .update(schema.paymentInstallments)
    .set({ paymentId: payment.id, molliePaymentId: payment.molliePaymentId, updatedAt: new Date() })
    .where(
      and(
        eq(schema.paymentInstallments.id, installmentId),
        eq(schema.paymentInstallments.status, "GEPLAND"),
      ),
    );
}

/**
 * Zet de termijn van een betaalde betaling op BETAALD.
 *
 * Idempotent en veilig bij gelijktijdigheid: alleen een termijn die nog op
 * GEPLAND staat wordt bijgewerkt, dus van twee webhooks krijgt er precies één
 * een rij terug. Is de termijn al door een ÁNDERE betaling voldaan, dan is dat
 * een dubbele betaling — die wordt zichtbaar gemaakt, nooit stil verwerkt.
 */
export async function markInstallmentPaid(
  payment: Payment,
  documentId: string | null,
): Promise<{ termijn: PaymentInstallment; eersteKeer: boolean } | null> {
  const db = getDb();
  if (!db || !payment.installmentId) return null;

  const [bijgewerkt] = await db
    .update(schema.paymentInstallments)
    .set({
      status: "BETAALD",
      paidAt: payment.paidAt ?? new Date(),
      paymentId: payment.id,
      molliePaymentId: payment.molliePaymentId,
      documentId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.paymentInstallments.id, payment.installmentId),
        eq(schema.paymentInstallments.commerceId, payment.commerceId),
        eq(schema.paymentInstallments.status, "GEPLAND"),
      ),
    )
    .returning();
  if (bijgewerkt) return { termijn: bijgewerkt, eersteKeer: true };

  const [huidig] = await db
    .select()
    .from(schema.paymentInstallments)
    .where(eq(schema.paymentInstallments.id, payment.installmentId))
    .limit(1);
  if (!huidig) return null;

  if (huidig.status === "BETAALD" && huidig.paymentId && huidig.paymentId !== payment.id) {
    console.error(
      JSON.stringify({
        evt: "installment.double_payment",
        at: new Date().toISOString(),
        installmentId: huidig.id,
        paymentId: payment.id,
      }),
    );
    await logJourneyEvent(
      huidig.leadId,
      "installment_double_payment",
      `Let op: termijn ${huidig.volgnummer} van ${huidig.aantal} is twee keer betaald (${euroFromCents(payment.amountCents)}). Controleer in Mollie en crediteer of stort terug.`,
      { actor: "systeem", internal: true, installmentId: huidig.id, molliePaymentId: payment.molliePaymentId },
    );
  }
  if (documentId && !huidig.documentId && huidig.paymentId === payment.id) {
    await db
      .update(schema.paymentInstallments)
      .set({ documentId, updatedAt: new Date() })
      .where(eq(schema.paymentInstallments.id, huidig.id));
  }
  return { termijn: huidig, eersteKeer: false };
}

/* =========================================================================
 * Weergave
 * ========================================================================= */

/** De status van de laatste betaalpoging per termijn (voor "Mislukt"). */
export async function laatstePogingen(
  rijen: readonly PaymentInstallment[],
): Promise<Map<string, Payment>> {
  const db = getDb();
  const map = new Map<string, Payment>();
  if (!db || rijen.length === 0) return map;
  const betalingen = await db
    .select()
    .from(schema.payments)
    .where(inArray(schema.payments.installmentId, rijen.map((r) => r.id)))
    .orderBy(desc(schema.payments.createdAt));
  for (const b of betalingen) {
    if (b.installmentId && !map.has(b.installmentId)) map.set(b.installmentId, b);
  }
  return map;
}

/** Eén regel in het termijnschema, klaar voor weergave (serialiseerbaar). */
export type TermijnRij = {
  id: string;
  volgnummer: number;
  aantal: number;
  exVat: string;
  vat: string;
  inclVat: string;
  vervaldatum: string | null;
  wanneer: string;
  status: TermijnStatus;
  statusLabel: string;
  betaalbaar: boolean;
  betaaldOp: string | null;
  /** Factuurnummer, als de termijn een factuur heeft. */
  factuur: string | null;
  /** Alleen voor de admin: Mollie-status van de laatste poging. */
  mollieStatus: string | null;
};

export type SchemaWeergave = {
  plan: BetaalRegeling["soort"];
  rijen: TermijnRij[];
  voortgang: {
    aantal: number;
    betaaldAantal: number;
    betaaldEx: string;
    betaaldIncl: string;
    openEx: string;
    openIncl: string;
    teLaatAantal: number;
    volledigBetaald: boolean;
    volgende: {
      volgnummer: number;
      exVat: string;
      inclVat: string;
      wanneer: string;
      status: TermijnStatus;
      betaalbaar: boolean;
    } | null;
  };
};

export function feitenVan(r: PaymentInstallment, poging?: Payment) {
  return {
    volgnummer: r.volgnummer,
    aantal: r.aantal,
    status: r.status,
    dueAt: r.dueAt,
    laatstePoging: poging?.status ?? null,
    exVatCents: r.amountExVatCents,
    vatCents: r.vatCents,
    inclVatCents: r.amountInclVatCents,
  };
}

export function schemaVoortgang(
  rijen: readonly PaymentInstallment[],
  pogingen: Map<string, Payment>,
  nu: Date = new Date(),
): Voortgang {
  return voortgang(rijen.map((r) => feitenVan(r, pogingen.get(r.id))), nu);
}

/**
 * Bouwt de weergave van het schema. De bedragen komen uit de rijen zelf —
 * dus uit wat getekend is — nooit uit een herberekening.
 */
export function schemaWeergave(
  rijen: readonly PaymentInstallment[],
  pogingen: Map<string, Payment>,
  facturen: Map<string, string>,
  nu: Date = new Date(),
): SchemaWeergave | null {
  if (rijen.length === 0) return null;
  const feiten = rijen.map((r) => feitenVan(r, pogingen.get(r.id)));
  const v = voortgang(feiten, nu);

  const wanneer = (r: PaymentInstallment) => {
    if (r.status === "BETAALD" && r.paidAt) return `Betaald op ${datumLang(r.paidAt)}`;
    if (!r.dueAt) return "Bij oplevering";
    const status = termijnStatus(feitenVan(r, pogingen.get(r.id)), nu);
    if (status === "gepland") return `${datumLang(r.dueAt)} · te betalen vanaf ${datumLang(opentOp(r.dueAt))}`;
    return datumLang(r.dueAt);
  };

  const volgendeRij = v.volgende ? rijen.find((r) => r.volgnummer === v.volgende!.volgnummer) : null;

  return {
    plan: rijen[0].plan,
    rijen: rijen.map((r, i) => {
      const f = feiten[i];
      const status = termijnStatus(f, nu);
      const poging = pogingen.get(r.id);
      return {
        id: r.id,
        volgnummer: r.volgnummer,
        aantal: r.aantal,
        exVat: euroFromCents(r.amountExVatCents),
        vat: euroFromCents(r.vatCents),
        inclVat: euroFromCents(r.amountInclVatCents),
        vervaldatum: r.dueAt?.toISOString() ?? null,
        wanneer: wanneer(r),
        status,
        statusLabel: TERMIJN_STATUS_LABEL[status],
        betaalbaar: isBetaalbaar(f, feiten, nu),
        betaaldOp: r.paidAt?.toISOString() ?? null,
        factuur: r.documentId ? (facturen.get(r.documentId) ?? null) : null,
        mollieStatus: poging?.status ?? null,
      };
    }),
    voortgang: {
      aantal: v.aantal,
      betaaldAantal: v.betaaldAantal,
      betaaldEx: euroFromCents(v.betaaldExCents),
      betaaldIncl: euroFromCents(v.betaaldInclCents),
      openEx: euroFromCents(v.openExCents),
      openIncl: euroFromCents(v.openInclCents),
      teLaatAantal: v.teLaatAantal,
      volledigBetaald: v.volledigBetaald,
      volgende:
        v.volgende && volgendeRij
          ? {
              volgnummer: v.volgende.volgnummer,
              exVat: euroFromCents(v.volgende.exVatCents),
              inclVat: euroFromCents(v.volgende.inclVatCents),
              wanneer: volgendeRij.dueAt ? datumLang(volgendeRij.dueAt) : "Bij oplevering",
              status: v.volgendeStatus ?? "gepland",
              betaalbaar: v.volgendeBetaalbaar,
            }
          : null,
    },
  };
}

/** Alles wat een scherm nodig heeft, in één aanroep. */
export async function loadSchemaWeergave(
  commerceId: string,
  facturen: { id: string; nummer: string }[],
  nu: Date = new Date(),
): Promise<{ rijen: PaymentInstallment[]; weergave: SchemaWeergave | null; voortgang: Voortgang | null }> {
  const rijen = await scheduleForCommerce(commerceId);
  if (rijen.length === 0) return { rijen, weergave: null, voortgang: null };
  const pogingen = await laatstePogingen(rijen);
  const nummers = new Map(facturen.map((f) => [f.id, f.nummer]));
  return {
    rijen,
    weergave: schemaWeergave(rijen, pogingen, nummers, nu),
    voortgang: schemaVoortgang(rijen, pogingen, nu),
  };
}
