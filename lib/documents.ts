import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { DocumentType, DogDocument, Payment } from "@/lib/db/schema";
import { legalEntity, entityAddressLines, entityReady } from "@/lib/legal-entity";
import { euroFromCents } from "@/lib/money";

/**
 * Documentregistratie — facturen en vastgelegde stukken.
 *
 * Geen tweede boekhouding: een documentregel registreert iets dat elders al
 * waar is (een betaalde termijn, een voorstelversie, een getekende
 * overeenkomst) en geeft dat een eigen, onveranderlijk nummer. De bedragen
 * komen uit de betaling zelf, nooit uit een herberekening.
 */

const PREFIX = "DW";

/**
 * Volgend documentnummer binnen het lopende jaar: DW-2026-0001.
 *
 * De uniciteit wordt uiteindelijk door de unieke index op `nummer` bewaakt;
 * deze functie levert alleen de kandidaat. De aanroeper (registerDocument)
 * probeert het opnieuw bij een botsing, zodat twee gelijktijdige webhooks
 * nooit hetzelfde nummer krijgen.
 */
async function nextNumber(jaar: number): Promise<string> {
  const db = getDb();
  if (!db) return `${PREFIX}-${jaar}-0001`;
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(nullif(split_part(${schema.documents.nummer}, '-', 3), '')::int), 0)`,
    })
    .from(schema.documents)
    .where(sql`${schema.documents.nummer} like ${`${PREFIX}-${jaar}-%`}`);
  return `${PREFIX}-${jaar}-${String((row?.max ?? 0) + 1).padStart(4, "0")}`;
}

export type DocumentInput = {
  leadId: string;
  commerceId: string;
  type: DocumentType;
  titel: string;
  proposalId?: string | null;
  agreementId?: string | null;
  paymentId?: string | null;
  netExVatCents?: number;
  vatCents?: number;
  totalInclVatCents?: number;
  vatPercent?: number;
  snapshot?: Record<string, unknown>;
  visibleToCustomer?: boolean;
};

/**
 * Legt een document vast. Idempotent op (commerceId, type, paymentId): een
 * tweede webhook voor dezelfde betaling maakt geen tweede factuur.
 */
export async function registerDocument(input: DocumentInput): Promise<DogDocument | null> {
  const db = getDb();
  if (!db) return null;

  if (input.paymentId) {
    const [bestaand] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.paymentId, input.paymentId))
      .limit(1);
    if (bestaand) return bestaand;
  }

  const jaar = new Date().getFullYear();
  // Bij een gelijktijdige tweede webhook botst de unieke index; dan pakken we
  // gewoon het volgende nummer. Drie pogingen is ruim voldoende.
  for (let poging = 0; poging < 3; poging++) {
    try {
      const [created] = await db
        .insert(schema.documents)
        .values({
          leadId: input.leadId,
          commerceId: input.commerceId,
          type: input.type,
          nummer: await nextNumber(jaar),
          titel: input.titel,
          proposalId: input.proposalId ?? null,
          agreementId: input.agreementId ?? null,
          paymentId: input.paymentId ?? null,
          netExVatCents: input.netExVatCents ?? 0,
          vatCents: input.vatCents ?? 0,
          totalInclVatCents: input.totalInclVatCents ?? 0,
          vatPercent: input.vatPercent ?? 21,
          snapshot: { ...(input.snapshot ?? {}), entiteit: entityAddressLines() },
          visibleToCustomer: input.visibleToCustomer ?? true,
        })
        .returning();
      return created ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!/documents_nummer_idx|duplicate key/i.test(msg)) throw err;
    }
  }
  return null;
}

/**
 * Factuur bij een betaalde termijn. De bedragen worden uit het werkelijk
 * betaalde bedrag teruggerekend — dat is het bedrag dat Mollie heeft
 * bevestigd, en dus wat er op de factuur hoort te staan.
 */
export async function registerInvoiceForPayment(
  payment: Payment,
  ctx: { leadId: string; commerceId: string; vatPercent: number; bedrijfsnaam: string },
): Promise<DogDocument | null> {
  const type: DocumentType =
    payment.type === "DEPOSIT"
      ? "INVOICE_DEPOSIT"
      : payment.type === "FINAL_PAYMENT"
        ? "INVOICE_FINAL"
        : "INVOICE_SUBSCRIPTION";

  const vatPercent = Math.max(0, ctx.vatPercent);
  const incl = payment.amountCents;
  const excl = Math.round(incl / (1 + vatPercent / 100));

  const omschrijving =
    payment.type === "DEPOSIT"
      ? "Eerste termijn — DogWare website en platform"
      : payment.type === "FINAL_PAYMENT"
        ? "Tweede termijn — DogWare website en platform"
        : `DogWare abonnement${payment.periode ? ` — ${payment.periode}` : ""}`;

  return registerDocument({
    leadId: ctx.leadId,
    commerceId: ctx.commerceId,
    type,
    titel: omschrijving,
    paymentId: payment.id,
    proposalId: payment.proposalId,
    agreementId: payment.agreementId,
    netExVatCents: excl,
    vatCents: incl - excl,
    totalInclVatCents: incl,
    vatPercent,
    snapshot: {
      klant: ctx.bedrijfsnaam,
      omschrijving,
      betaaldOp: payment.paidAt?.toISOString() ?? null,
      molliePaymentId: payment.molliePaymentId,
      referentie: payment.referentie,
      bedragen: {
        excl: euroFromCents(excl),
        btw: euroFromCents(incl - excl),
        incl: euroFromCents(incl),
      },
      /*
       * Ontbreken KvK-/btw-nummer, dan leggen we dat expliciet vast in plaats
       * van het stil weg te laten. Zo is later zichtbaar welke facturen nog
       * aangevuld moeten worden.
       */
      entiteitCompleet: entityReady().ok,
      entiteitOntbreekt: entityReady().missing,
      facturerendePartij: legalEntity.name,
    },
  });
}

export async function listDocuments(
  commerceId: string,
  scope: "admin" | "klant" = "admin",
): Promise<DogDocument[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.commerceId, commerceId))
    .orderBy(desc(schema.documents.issuedAt));
  return scope === "klant" ? rows.filter((d) => d.visibleToCustomer) : rows;
}
