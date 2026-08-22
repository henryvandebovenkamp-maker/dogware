import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Commerce, Lead, Proposal } from "@/lib/db/schema";
import {
  computeOneOff,
  euroFromCents,
  subscriptionStartLabel,
  type CommercialConfig,
} from "@/lib/money";
import { newPortalToken } from "@/lib/portal-access";

/**
 * Voorstellen met versiebeheer.
 *
 * De regel die alles stuurt: een VERSTUURD voorstel wijzigt nooit meer. Wil de
 * beheerder daarna iets veranderen, dan ontstaat er een nieuwe versie en gaat
 * de oude naar SUPERSEDED. Zonder die regel kun je later niet meer aantonen
 * waar de klant precies akkoord op gaf — en dat is nu juist de reden dat
 * versiebeheer hier bestaat.
 *
 * Een concept (DRAFT) mag wél vrij bewerkt worden; dat is de autosave-ruimte
 * van de beheerder.
 */

export type ProposalContent = {
  titel: string;
  intro: string | null;
  omschrijving: string | null;
  werkzaamheden: string[];
  modules: string[];
  bijzonderheden: string | null;
  geldigTot: Date | null;
};

/** De bevroren prijsopbouw zoals die in een voorstelversie wordt vastgelegd. */
export type PricingSnapshot = {
  config: CommercialConfig;
  subscriptionStartRule: Commerce["subscriptionStartRule"];
  subscriptionStartAt: string | null;
  computed: {
    subtotalCents: number;
    discountCents: number;
    netExVatCents: number;
    vatCents: number;
    totalInclVatCents: number;
    depositCents: number;
    finalCents: number;
    depositPercent: number;
    finalPercent: number;
    monthlyExVatCents: number;
    monthlyVatCents: number;
    monthlyInclVatCents: number;
  };
  /** Wanneer deze momentopname is gemaakt. */
  frozenAt: string;
};

export function toConfig(c: Commerce): CommercialConfig {
  return {
    projectCents: c.projectCents,
    setupCents: c.setupCents,
    discountType: c.discountType,
    discountValue: c.discountValue,
    vatPercent: c.vatPercent,
    depositPercent: c.depositPercent,
    monthlyCents: c.monthlyCents,
    freeMonths: c.freeMonths,
    introDiscountPercent: c.introDiscountPercent,
    introDiscountMonths: c.introDiscountMonths,
  };
}

/** Bouwt de momentopname uit de actuele afspraak. Server-side, altijd. */
export function freezePricing(c: Commerce): PricingSnapshot {
  const config = toConfig(c);
  return {
    config,
    subscriptionStartRule: c.subscriptionStartRule,
    subscriptionStartAt: c.subscriptionStartAt?.toISOString() ?? null,
    computed: computeOneOff(config),
    frozenAt: new Date().toISOString(),
  };
}

/**
 * Leest een bevroren momentopname terug. Valt terug op de actuele afspraak
 * wanneer er (nog) niets bevroren is — bijvoorbeeld bij een vers concept.
 */
export function readPricing(p: Proposal, fallback: Commerce): PricingSnapshot {
  const raw = p.pricing as unknown as PricingSnapshot | undefined;
  if (raw?.computed && raw.config) return raw;
  return freezePricing(fallback);
}

/* ---------------------------------------------------------------- queries -- */

export async function getCommerce(leadId: string): Promise<Commerce | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.leadId, leadId))
    .limit(1);
  return row ?? null;
}

/**
 * Haalt de commerce-rij op of maakt hem aan. Geeft meteen een portaalsleutel,
 * zodat de klantomgeving vanaf het eerste moment bestaat.
 */
export async function ensureCommerce(leadId: string): Promise<Commerce | null> {
  const db = getDb();
  if (!db) return null;
  const existing = await getCommerce(leadId);
  if (existing) {
    if (existing.portalToken) return existing;
    const [bijgewerkt] = await db
      .update(schema.commerce)
      .set({ portalToken: newPortalToken(), updatedAt: new Date() })
      .where(eq(schema.commerce.id, existing.id))
      .returning();
    return bijgewerkt ?? existing;
  }
  const [created] = await db
    .insert(schema.commerce)
    .values({ leadId, portalToken: newPortalToken() })
    .returning();
  return created ?? null;
}

export async function listProposals(commerceId: string): Promise<Proposal[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.commerceId, commerceId))
    .orderBy(desc(schema.proposals.version));
}

/** Het openstaande concept, als dat er is. */
export async function getDraftProposal(commerceId: string): Promise<Proposal | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.proposals)
    .where(
      and(eq(schema.proposals.commerceId, commerceId), eq(schema.proposals.status, "DRAFT")),
    )
    .orderBy(desc(schema.proposals.version))
    .limit(1);
  return row ?? null;
}

/**
 * Het voorstel dat op dit moment "geldt" voor de klant: het geaccepteerde als
 * dat er is, anders het laatst verstuurde.
 */
export async function getActiveProposal(commerceId: string): Promise<Proposal | null> {
  const db = getDb();
  if (!db) return null;
  const [accepted] = await db
    .select()
    .from(schema.proposals)
    .where(
      and(eq(schema.proposals.commerceId, commerceId), eq(schema.proposals.status, "ACCEPTED")),
    )
    .orderBy(desc(schema.proposals.version))
    .limit(1);
  if (accepted) return accepted;

  const [sent] = await db
    .select()
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.commerceId, commerceId),
        inArray(schema.proposals.status, ["SENT", "VIEWED"]),
      ),
    )
    .orderBy(desc(schema.proposals.version))
    .limit(1);
  return sent ?? null;
}

/* ------------------------------------------------------------- mutations -- */

/**
 * Maakt een nieuw concept aan, of geeft het bestaande concept terug.
 *
 * Er is altijd hooguit één concept per traject: twee halve voorstellen naast
 * elkaar is verwarrend en levert bij het versturen een keuze op die niemand
 * wil maken.
 */
export async function createOrGetDraft(
  commerce: Commerce,
  lead: Lead,
  createdByUserId: string | null,
): Promise<Proposal | null> {
  const db = getDb();
  if (!db) return null;

  const bestaand = await getDraftProposal(commerce.id);
  if (bestaand) return bestaand;

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.proposals.version}), 0)::int` })
    .from(schema.proposals)
    .where(eq(schema.proposals.commerceId, commerce.id));

  // Bij een vervolgversie nemen we de inhoud van de vorige over: de beheerder
  // corrigeert doorgaans één ding en hoort niet opnieuw te hoeven typen.
  const [vorige] = await db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.commerceId, commerce.id))
    .orderBy(desc(schema.proposals.version))
    .limit(1);

  const geldigTot = new Date();
  geldigTot.setDate(geldigTot.getDate() + 30);

  const [created] = await db
    .insert(schema.proposals)
    .values({
      commerceId: commerce.id,
      leadId: lead.id,
      version: (max ?? 0) + 1,
      status: "DRAFT",
      titel: vorige?.titel || `Jouw nieuwe website met DogWare`,
      intro: vorige?.intro ?? null,
      omschrijving: vorige?.omschrijving ?? null,
      werkzaamheden: vorige?.werkzaamheden ?? [],
      modules: vorige?.modules ?? defaultModulesFromLead(lead),
      bijzonderheden: vorige?.bijzonderheden ?? null,
      geldigTot: vorige?.geldigTot ?? geldigTot,
      pricing: freezePricing(commerce) as unknown as Record<string, unknown>,
      createdByUserId,
    })
    .returning();
  return created ?? null;
}

/**
 * Vult de modules alvast met wat de klant zelf in de aanvraag heeft opgegeven.
 * Geen aannames, geen standaardpakket — uitsluitend wat er al staat.
 */
function defaultModulesFromLead(lead: Lead): string[] {
  return Array.from(
    new Set([...(lead.diensten ?? []), ...(lead.functies ?? [])].map((s) => s.trim()).filter(Boolean)),
  );
}

/** Slaat conceptinhoud op. Werkt uitsluitend op een DRAFT. */
export async function saveDraftContent(
  proposalId: string,
  content: Partial<ProposalContent>,
): Promise<{ ok: boolean; reason?: "NOT_DRAFT" | "NOT_FOUND" }> {
  const db = getDb();
  if (!db) return { ok: false, reason: "NOT_FOUND" };
  const [p] = await db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.id, proposalId))
    .limit(1);
  if (!p) return { ok: false, reason: "NOT_FOUND" };
  if (p.status !== "DRAFT") return { ok: false, reason: "NOT_DRAFT" };

  await db
    .update(schema.proposals)
    .set({
      ...(content.titel !== undefined ? { titel: content.titel } : {}),
      ...(content.intro !== undefined ? { intro: content.intro } : {}),
      ...(content.omschrijving !== undefined ? { omschrijving: content.omschrijving } : {}),
      ...(content.werkzaamheden !== undefined ? { werkzaamheden: content.werkzaamheden } : {}),
      ...(content.modules !== undefined ? { modules: content.modules } : {}),
      ...(content.bijzonderheden !== undefined ? { bijzonderheden: content.bijzonderheden } : {}),
      ...(content.geldigTot !== undefined ? { geldigTot: content.geldigTot } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.proposals.id, proposalId));
  return { ok: true };
}

/**
 * Verstuurt een concept: bevriest de prijzen, zet de status op SENT en maakt
 * eerdere verstuurde-maar-niet-geaccepteerde versies SUPERSEDED.
 *
 * Een geaccepteerde versie wordt NOOIT superseded — die is de juridische
 * basis onder een eventuele overeenkomst en betaling.
 */
export async function markProposalSent(
  proposal: Proposal,
  commerce: Commerce,
): Promise<Proposal | null> {
  const db = getDb();
  if (!db) return null;

  await db
    .update(schema.proposals)
    .set({ status: "SUPERSEDED" })
    .where(
      and(
        eq(schema.proposals.commerceId, commerce.id),
        inArray(schema.proposals.status, ["SENT", "VIEWED"]),
      ),
    );

  const [sent] = await db
    .update(schema.proposals)
    .set({
      status: "SENT",
      sentAt: new Date(),
      pricing: freezePricing(commerce) as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(schema.proposals.id, proposal.id))
    .returning();
  return sent ?? null;
}

/** Registreert dat de klant het voorstel geopend heeft. Faalt nooit hard. */
export async function trackProposalViewed(proposalId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const now = new Date();
    await db
      .update(schema.proposals)
      .set({
        viewCount: sql`${schema.proposals.viewCount} + 1`,
        lastViewedAt: now,
        firstViewedAt: sql`coalesce(${schema.proposals.firstViewedAt}, ${now})`,
        status: sql`case when ${schema.proposals.status} = 'SENT' then 'VIEWED' else ${schema.proposals.status} end`,
      })
      .where(eq(schema.proposals.id, proposalId));
  } catch {
    /* tracking mag de pagina nooit blokkeren */
  }
}

/** Is dit voorstel verlopen? */
export function isExpired(p: Proposal, now = new Date()): boolean {
  return Boolean(p.geldigTot && p.geldigTot.getTime() < now.getTime());
}

/* ---------------------------------------------------------------- labels -- */

/** Leesbare bedragen uit een bevroren momentopname — één plek, overal gelijk. */
export function pricingLabels(snap: PricingSnapshot) {
  const c = snap.computed;
  return {
    subtotal: euroFromCents(c.subtotalCents),
    discount: euroFromCents(c.discountCents),
    netExVat: euroFromCents(c.netExVatCents),
    vat: euroFromCents(c.vatCents),
    total: euroFromCents(c.totalInclVatCents),
    deposit: euroFromCents(c.depositCents),
    final: euroFromCents(c.finalCents),
    depositPercent: c.depositPercent,
    finalPercent: c.finalPercent,
    monthlyExVat: euroFromCents(c.monthlyExVatCents),
    monthlyInclVat: euroFromCents(c.monthlyInclVatCents),
    vatPercent: snap.config.vatPercent,
    freeMonths: snap.config.freeMonths,
    startLabel: subscriptionStartLabel(
      snap.subscriptionStartRule,
      snap.subscriptionStartAt ? new Date(snap.subscriptionStartAt) : null,
    ),
  };
}
