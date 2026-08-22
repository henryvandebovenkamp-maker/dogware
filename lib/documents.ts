import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
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

/* =========================================================================
 * Weergave van een factuur
 * ========================================================================= */

/** Alles wat een factuur nodig heeft om getoond te worden. */
export type InvoiceView = {
  nummer: string;
  datum: Date;
  omschrijving: string;
  /** Leverancier — altijd de juridische entiteit, nooit het merk alleen. */
  leverancier: {
    naam: string;
    adresregels: string[];
    email: string;
    telefoon: string;
    kvk: string;
    btw: string;
    /** Ontbrekende verplichte gegevens; leeg = compleet. */
    ontbreekt: string[];
  };
  klant: {
    bedrijfsnaam: string;
    contactpersoon: string | null;
    adresregels: string[];
    kvk: string | null;
    btw: string | null;
    email: string | null;
  };
  bedragen: {
    exclCents: number;
    btwCents: number;
    inclCents: number;
    btwPercent: number;
  };
  betaling: {
    betaald: boolean;
    betaaldOp: Date | null;
    referentie: string | null;
    molliePaymentId: string | null;
  };
};

/**
 * Haalt een factuur op en bouwt alles wat nodig is om hem te tonen.
 *
 * De klantgegevens komen bij voorkeur uit de ONDERTEKENDE overeenkomst: dat
 * zijn de adresgegevens die de klant zelf heeft ingevuld en waarop hij heeft
 * getekend. Ontbreken die, dan vallen we terug op de aanvraag. Zo klopt een
 * factuur ook voor documenten die zijn vastgelegd vóór er een overeenkomst was.
 */
export async function getInvoiceView(
  nummer: string,
): Promise<{ view: InvoiceView; leadId: string; commerceId: string } | null> {
  const db = getDb();
  if (!db) return null;

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.nummer, nummer))
    .limit(1);
  if (!doc) return null;
  if (!doc.type.startsWith("INVOICE")) return null;

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, doc.leadId))
    .limit(1);
  if (!lead) return null;

  const agreement = doc.agreementId
    ? (
        await db
          .select()
          .from(schema.agreements)
          .where(eq(schema.agreements.id, doc.agreementId))
          .limit(1)
      )[0]
    : (
        await db
          .select()
          .from(schema.agreements)
          .where(
            and(
              eq(schema.agreements.commerceId, doc.commerceId),
              eq(schema.agreements.status, "SIGNED"),
            ),
          )
          .limit(1)
      )[0];

  const snapshot = doc.snapshot as Record<string, unknown>;
  const adres = [
    agreement?.signerAddress,
    [agreement?.signerPostcode, agreement?.signerCity].filter(Boolean).join(" ") || lead.plaats,
  ].filter((r): r is string => Boolean(r?.trim()));

  const gemist = entityReady();

  return {
    leadId: doc.leadId,
    commerceId: doc.commerceId,
    view: {
      nummer: doc.nummer,
      datum: doc.issuedAt,
      omschrijving: doc.titel,
      leverancier: {
        naam: legalEntity.name,
        adresregels: [legalEntity.address, `${legalEntity.postcode} ${legalEntity.city}`],
        email: legalEntity.email,
        telefoon: legalEntity.phone,
        kvk: legalEntity.kvk,
        btw: legalEntity.btw,
        ontbreekt: gemist.missing,
      },
      klant: {
        bedrijfsnaam: agreement?.signerCompany ?? lead.bedrijfsnaam,
        contactpersoon: agreement?.signerName ?? lead.naam,
        adresregels: adres,
        kvk: agreement?.signerKvk ?? null,
        btw: agreement?.signerVat ?? null,
        email: agreement?.signerEmail ?? lead.email,
      },
      bedragen: {
        exclCents: doc.netExVatCents,
        btwCents: doc.vatCents,
        inclCents: doc.totalInclVatCents,
        btwPercent: doc.vatPercent,
      },
      betaling: {
        betaald: Boolean(snapshot?.betaaldOp),
        betaaldOp: snapshot?.betaaldOp ? new Date(String(snapshot.betaaldOp)) : null,
        referentie: (snapshot?.referentie as string) ?? null,
        molliePaymentId: (snapshot?.molliePaymentId as string) ?? null,
      },
    },
  };
}

/** De factuur die bij een betaling hoort, als die er is. */
export async function invoiceNumberForPayment(paymentId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [d] = await db
    .select({ nummer: schema.documents.nummer })
    .from(schema.documents)
    .where(eq(schema.documents.paymentId, paymentId))
    .limit(1);
  return d?.nummer ?? null;
}
