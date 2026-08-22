import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Agreement, Commerce, Lead, Proposal } from "@/lib/db/schema";
import {
  ACTIVE_CONTRACT_VERSION,
  buildAgreement,
  consentLabels,
  resolveContractVersion,
  type AgreementContext,
  type Chapter,
} from "@/lib/agreement";
import { pricingLabels, readPricing, type PricingSnapshot } from "@/lib/proposals";

/**
 * Overeenkomsten: aanmaken, uitlezen en ondertekenen.
 *
 * Een overeenkomst hangt altijd aan precies één voorstelversie. Verandert het
 * voorstel daarna, dan hoort daar een nieuwe overeenkomst bij — de getekende
 * blijft onaangeroerd bewaard. Daarom staan de prijzen en de voorwaardenversie
 * bevroren in de rij zelf en worden ze nooit opnieuw uit `commerce` gelezen.
 */

/** De geldende overeenkomst: de getekende, anders de meest recente. */
export async function getCurrentAgreement(commerceId: string): Promise<Agreement | null> {
  const db = getDb();
  if (!db) return null;
  const [signed] = await db
    .select()
    .from(schema.agreements)
    .where(
      and(eq(schema.agreements.commerceId, commerceId), eq(schema.agreements.status, "SIGNED")),
    )
    .orderBy(desc(schema.agreements.signedAt))
    .limit(1);
  if (signed) return signed;

  const [laatste] = await db
    .select()
    .from(schema.agreements)
    .where(eq(schema.agreements.commerceId, commerceId))
    .orderBy(desc(schema.agreements.createdAt))
    .limit(1);
  return laatste ?? null;
}

/**
 * Zorgt dat er een overeenkomst klaarligt bij het geaccepteerde voorstel.
 *
 * Idempotent: bestaat er al een (nog niet getekende) overeenkomst bij deze
 * voorstelversie, dan komt die terug. Hoort de bestaande bij een ÓUDERE
 * voorstelversie, dan wordt die SUPERSEDED en komt er een nieuwe — anders zou
 * de klant een contract tekenen bij prijzen die niet meer gelden.
 */
export async function ensureAgreement(
  commerce: Commerce,
  lead: Lead,
  proposal: Proposal,
): Promise<Agreement | null> {
  const db = getDb();
  if (!db) return null;

  const [bestaand] = await db
    .select()
    .from(schema.agreements)
    .where(eq(schema.agreements.commerceId, commerce.id))
    .orderBy(desc(schema.agreements.createdAt))
    .limit(1);

  if (bestaand?.status === "SIGNED") return bestaand;
  if (bestaand && bestaand.proposalId === proposal.id) return bestaand;
  if (bestaand) {
    await db
      .update(schema.agreements)
      .set({ status: "SUPERSEDED" })
      .where(eq(schema.agreements.id, bestaand.id));
  }

  const snapshot = readPricing(proposal, commerce);
  const [created] = await db
    .insert(schema.agreements)
    .values({
      commerceId: commerce.id,
      leadId: lead.id,
      proposalId: proposal.id,
      proposalVersion: proposal.version,
      status: "SENT",
      voorwaardenVersie: ACTIVE_CONTRACT_VERSION,
      pricing: snapshot as unknown as Record<string, unknown>,
      signerCompany: lead.bedrijfsnaam,
      signerName: lead.naam,
      signerEmail: lead.email,
      signerPhone: lead.telefoon,
    })
    .returning();
  return created ?? null;
}

/** De bevroren prijzen van een overeenkomst. */
export function agreementPricing(a: Agreement): PricingSnapshot {
  return a.pricing as unknown as PricingSnapshot;
}

/**
 * Bouwt de contracttekst uit de BEVROREN gegevens van de overeenkomst.
 * Nooit uit de actuele commerce-rij: een getekend contract mag niet
 * meebewegen met een latere prijswijziging.
 */
export function renderAgreement(
  a: Agreement,
  proposal: Proposal,
): { chapters: Chapter[]; ctx: AgreementContext; versionName: string } {
  const snap = agreementPricing(a);
  const L = pricingLabels(snap);
  const ctx: AgreementContext = {
    company: a.signerCompany ?? "",
    modules: proposal.modules ?? [],
    werkzaamheden: proposal.werkzaamheden ?? [],
    setupExclLabel: L.netExVat,
    setupInclLabel: L.total,
    vatPercent: L.vatPercent,
    monthlyExclLabel: L.monthlyExVat,
    monthlyInclLabel: L.monthlyInclVat,
    depositLabel: L.deposit,
    depositPercent: L.depositPercent,
    finalLabel: L.final,
    finalPercent: L.finalPercent,
    freeMonths: L.freeMonths,
    subscriptionStartLabel: L.startLabel,
    bijzonderheden: proposal.bijzonderheden,
  };
  const versie = resolveContractVersion(a.voorwaardenVersie);
  return {
    chapters: buildAgreement(ctx, a.voorwaardenVersie),
    ctx,
    versionName: versie.name,
  };
}

/** De akkoordverklaringen die de klant moet aanvinken, met de echte bedragen. */
export function agreementConsents(a: Agreement) {
  const L = pricingLabels(agreementPricing(a));
  return consentLabels({
    setupExclLabel: L.netExVat,
    depositLabel: L.deposit,
    depositPercent: L.depositPercent,
    finalLabel: L.final,
    finalPercent: L.finalPercent,
    monthlyExclLabel: L.monthlyExVat,
    versionLabel: resolveContractVersion(a.voorwaardenVersie).name,
  });
}

/** Is deze overeenkomst rechtsgeldig getekend? Poortwachter vóór elke betaling. */
export function isSigned(a: Agreement | null): a is Agreement {
  return Boolean(
    a &&
      a.status === "SIGNED" &&
      a.signedAt &&
      a.agreesOpdracht &&
      a.agreesInvestering &&
      a.agreesTermijnen &&
      a.agreesMaandbedrag &&
      a.agreesVoorwaarden &&
      a.agreesBevoegd,
  );
}
