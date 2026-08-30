import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type {
  Agreement,
  DocumentType,
  DogDocument,
  InvoiceStatus,
  Lead,
  Payment,
} from "@/lib/db/schema";
import { isInvoiceType } from "@/lib/db/schema";
import { legalEntity, entityReady } from "@/lib/legal-entity";
import { logJourneyEvent } from "@/lib/journey";
import {
  betaalmethodeLabel,
  euroFromCents,
  invoiceLineFromGross,
  negateInvoiceLine,
  sumInvoiceLines,
  type InvoiceLine,
  type InvoiceTotals,
} from "@/lib/money";

/**
 * Documentregistratie — facturen en vastgelegde stukken.
 *
 * Geen tweede boekhouding: een documentregel registreert iets dat elders al
 * waar is (een betaalde termijn, een voorstelversie, een getekende
 * overeenkomst) en geeft dat een eigen, onveranderlijk nummer. De bedragen
 * komen uit de betaling zelf, nooit uit een herberekening.
 */

export { isInvoiceType };

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

/* =========================================================================
 * De bevroren momentopname
 *
 * Dit is het hart van de administratieve integriteit. Verhuist een klant, of
 * verandert er een tarief, dan mag een factuur van vorig jaar daar niets van
 * merken. Alles wat op het papier hoort te staan wordt daarom bij het uitgeven
 * één keer vastgelegd en daarna alleen nog gelézen.
 * ========================================================================= */

export const INVOICE_SNAPSHOT_VERSION = 1;

export type PartySnapshot = {
  naam: string;
  contactpersoon: string | null;
  adresregels: string[];
  land: string | null;
  email: string | null;
  telefoon: string | null;
  kvk: string | null;
  btw: string | null;
  iban: string | null;
};

export type InvoiceSnapshot = {
  versie: number;
  /** Facturerende partij zoals die op het moment van uitgifte gold. */
  leverancier: PartySnapshot;
  klant: PartySnapshot;
  regels: InvoiceLine[];
  totalen: InvoiceTotals;
  omschrijving: string;
  referentie: string | null;
  molliePaymentId: string | null;
  betaaldOp: string | null;
  /** Machinecode van Mollie, bijv. "ideal". Het label komt uit lib/money. */
  betaalmethode: string | null;
  /** Wat er op dit moment aan de facturerende partij ontbrak. */
  entiteitOntbreekt: string[];
};

/** De facturerende partij, bevroren zoals hij nu is. */
function leverancierSnapshot(): PartySnapshot {
  return {
    naam: legalEntity.name,
    contactpersoon: null,
    adresregels: [legalEntity.address, `${legalEntity.postcode} ${legalEntity.city}`],
    land: legalEntity.country,
    email: legalEntity.email,
    telefoon: legalEntity.phone,
    kvk: legalEntity.kvk || null,
    btw: legalEntity.btw || null,
    iban: legalEntity.iban || null,
  };
}

/**
 * De klantgegevens, bevroren.
 *
 * Bij voorkeur uit de ONDERTEKENDE overeenkomst: dat zijn de gegevens die de
 * klant zelf heeft ingevuld en waarop hij heeft getekend. Ontbreken die, dan
 * de aanvraag — dan staat er tenminste iets waars op, in plaats van niets.
 */
function klantSnapshot(lead: Lead, agreement: Agreement | null): PartySnapshot {
  const postcodePlaats = [agreement?.signerPostcode, agreement?.signerCity]
    .filter(Boolean)
    .join(" ");
  const adresregels = [agreement?.signerAddress, postcodePlaats || lead.plaats].filter(
    (r): r is string => Boolean(r?.trim()),
  );
  return {
    naam: agreement?.signerCompany?.trim() || lead.bedrijfsnaam,
    contactpersoon: agreement?.signerName?.trim() || lead.naam,
    adresregels,
    land: "Nederland",
    email: agreement?.signerEmail?.trim() || lead.email,
    telefoon: agreement?.signerPhone?.trim() || lead.telefoon,
    kvk: agreement?.signerKvk?.trim() || null,
    btw: agreement?.signerVat?.trim() || null,
    iban: null,
  };
}

/** De getekende overeenkomst bij dit dossier, als die er is. */
async function findAgreement(
  commerceId: string,
  agreementId: string | null,
): Promise<Agreement | null> {
  const db = getDb();
  if (!db) return null;
  if (agreementId) {
    const [a] = await db
      .select()
      .from(schema.agreements)
      .where(eq(schema.agreements.id, agreementId))
      .limit(1);
    if (a) return a;
  }
  const [signed] = await db
    .select()
    .from(schema.agreements)
    .where(
      and(eq(schema.agreements.commerceId, commerceId), eq(schema.agreements.status, "SIGNED")),
    )
    .orderBy(desc(schema.agreements.signedAt))
    .limit(1);
  return signed ?? null;
}

/* =========================================================================
 * Vastleggen
 * ========================================================================= */

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
  status?: InvoiceStatus;
  dueAt?: Date | null;
  paidAt?: Date | null;
  paymentMethod?: string | null;
  molliePaymentId?: string | null;
  creditsDocumentId?: string | null;
  creditReason?: string | null;
};

/**
 * Legt een document vast. Idempotent op `paymentId`: een tweede webhook voor
 * dezelfde betaling maakt geen tweede factuur. De controle hieronder vangt het
 * normale geval af; de unieke index `documents_payment_idx` vangt de race af
 * waarin twee webhooks tegelijk langs die controle glippen.
 */
export async function registerDocument(input: DocumentInput): Promise<DogDocument | null> {
  const db = getDb();
  if (!db) return null;

  if (input.paymentId) {
    const bestaand = await documentForPayment(input.paymentId);
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
          snapshot: input.snapshot ?? {},
          visibleToCustomer: input.visibleToCustomer ?? true,
          status: input.status ?? "CONCEPT",
          dueAt: input.dueAt ?? null,
          paidAt: input.paidAt ?? null,
          paymentMethod: input.paymentMethod ?? null,
          molliePaymentId: input.molliePaymentId ?? null,
          creditsDocumentId: input.creditsDocumentId ?? null,
          creditReason: input.creditReason ?? null,
        })
        .returning();
      return created ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      /*
       * Botste de unieke index op `payment_id`, dan was een gelijktijdige
       * webhook ons net voor. Die factuur is dan al gemaakt — teruggeven, niet
       * opnieuw proberen, want een tweede poging maakt alsnog een duplicaat.
       */
      if (/documents_payment_idx/i.test(msg) && input.paymentId) {
        return (await documentForPayment(input.paymentId)) ?? null;
      }
      if (!/documents_nummer_idx|duplicate key/i.test(msg)) throw err;
    }
  }
  return null;
}

async function documentForPayment(paymentId: string): Promise<DogDocument | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.paymentId, paymentId))
    .limit(1);
  return row ?? null;
}

/** De omschrijving van de termijn waar deze betaling bij hoort. */
function omschrijvingVoor(payment: Payment): { titel: string; toelichting: string | null } {
  switch (payment.type) {
    case "DEPOSIT":
      return {
        titel: "Ontwikkeling & inrichting DogWare-platform",
        toelichting: "Eerste termijn",
      };
    case "FINAL_PAYMENT":
      return {
        titel: "Ontwikkeling & inrichting DogWare-platform",
        toelichting: "Resterende termijn",
      };
    case "SUBSCRIPTION":
      return {
        titel: `DogWare maandabonnement${payment.periode ? ` — ${maandLabel(payment.periode)}` : ""}`,
        toelichting: null,
      };
    default:
      return { titel: "DogWare", toelichting: null };
  }
}

/** "2026-09" → "september 2026". Onbekende invoer blijft ongewijzigd. */
export function maandLabel(periode: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return periode;
  const datum = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return datum.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

/**
 * Factuur bij een betaalde termijn.
 *
 * De bedragen worden uit het werkelijk betaalde bedrag teruggerekend — dat is
 * het bedrag dat Mollie heeft bevestigd, en dus wat er op de factuur hoort te
 * staan. Alles wat de factuur later moet kunnen tonen wordt hier bevroren.
 */
export async function registerInvoiceForPayment(
  payment: Payment,
  ctx: { leadId: string; commerceId: string; vatPercent: number; bedrijfsnaam: string },
): Promise<DogDocument | null> {
  const db = getDb();
  if (!db) return null;

  const type: DocumentType =
    payment.type === "DEPOSIT"
      ? "INVOICE_DEPOSIT"
      : payment.type === "FINAL_PAYMENT"
        ? "INVOICE_FINAL"
        : "INVOICE_SUBSCRIPTION";

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, ctx.leadId))
    .limit(1);
  if (!lead) return null;

  const agreement = await findAgreement(ctx.commerceId, payment.agreementId);
  const { titel, toelichting } = omschrijvingVoor(payment);

  const regel = invoiceLineFromGross({
    omschrijving: titel,
    toelichting,
    grossCents: payment.amountCents,
    vatPercent: Math.max(0, ctx.vatPercent),
  });
  const totalen = sumInvoiceLines([regel]);
  const betaald = payment.status === "PAID";

  const snapshot: InvoiceSnapshot = {
    versie: INVOICE_SNAPSHOT_VERSION,
    leverancier: leverancierSnapshot(),
    klant: klantSnapshot(lead, agreement),
    regels: [regel],
    totalen,
    omschrijving: titel,
    referentie: payment.referentie,
    molliePaymentId: payment.molliePaymentId,
    betaaldOp: payment.paidAt?.toISOString() ?? null,
    betaalmethode: payment.method ?? null,
    entiteitOntbreekt: entityReady().missing,
  };

  const bestond = payment.id ? await documentForPayment(payment.id) : null;
  const doc = await registerDocument({
    leadId: ctx.leadId,
    commerceId: ctx.commerceId,
    type,
    titel,
    paymentId: payment.id,
    proposalId: payment.proposalId,
    agreementId: agreement?.id ?? payment.agreementId,
    netExVatCents: totalen.exclCents,
    vatCents: totalen.btwCents,
    totalInclVatCents: totalen.inclCents,
    vatPercent: regel.vatPercent,
    snapshot: snapshot as unknown as Record<string, unknown>,
    status: betaald ? "BETAALD" : "OPEN",
    paidAt: payment.paidAt ?? null,
    paymentMethod: payment.method ?? null,
    molliePaymentId: payment.molliePaymentId,
  });

  // Alleen bij een écht nieuwe factuur op de tijdlijn — anders zou een tweede
  // webhook een tweede regel opleveren voor dezelfde factuur.
  if (doc && !bestond) {
    await logJourneyEvent(
      ctx.leadId,
      "invoice_created",
      `Factuur ${doc.nummer} aangemaakt (${euroFromCents(totalen.inclCents)})`,
      { actor: "systeem", nummer: doc.nummer, documentId: doc.id },
    );
  }
  return doc;
}

/**
 * Creditnota op een bestaande factuur.
 *
 * De enige toegestane correctie. De oorspronkelijke factuur blijft ongewijzigd
 * bestaan en houdt zijn nummer; de creditnota is een eigen document met eigen
 * nummer en spiegelbeeldige bedragen. Idempotent: is er al gecrediteerd, dan
 * komt die nota terug in plaats van een tweede.
 */
export async function createCreditNote(
  documentId: string,
  reden: string,
): Promise<{ ok: true; nota: DogDocument } | { ok: false; message: string }> {
  const db = getDb();
  if (!db) return { ok: false, message: "Database niet beschikbaar." };
  if (!reden.trim()) return { ok: false, message: "Een creditnota heeft een reden nodig." };

  const [origineel] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!origineel) return { ok: false, message: "Factuur niet gevonden." };
  if (!isInvoiceType(origineel.type) || origineel.type === "CREDIT_NOTE") {
    return { ok: false, message: "Alleen een factuur kan gecrediteerd worden." };
  }
  if (origineel.creditedByDocumentId) {
    const [bestaand] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, origineel.creditedByDocumentId))
      .limit(1);
    if (bestaand) return { ok: true, nota: bestaand };
  }

  const bron = leesSnapshot(origineel);
  const regels = bron.regels.map(negateInvoiceLine);
  const totalen = sumInvoiceLines(regels);
  const titel = `Creditnota bij factuur ${origineel.nummer}`;

  const snapshot: InvoiceSnapshot = {
    ...bron,
    versie: INVOICE_SNAPSHOT_VERSION,
    regels,
    totalen,
    omschrijving: titel,
    betaaldOp: null,
    betaalmethode: null,
    molliePaymentId: null,
    referentie: origineel.nummer,
  };

  const nota = await registerDocument({
    leadId: origineel.leadId,
    commerceId: origineel.commerceId,
    type: "CREDIT_NOTE",
    titel,
    proposalId: origineel.proposalId,
    agreementId: origineel.agreementId,
    // Bewust GEEN paymentId: die is al door de oorspronkelijke factuur bezet,
    // en één betaling hoort bij precies één factuur.
    paymentId: null,
    netExVatCents: totalen.exclCents,
    vatCents: totalen.btwCents,
    totalInclVatCents: totalen.inclCents,
    vatPercent: origineel.vatPercent,
    snapshot: snapshot as unknown as Record<string, unknown>,
    status: "BETAALD",
    creditsDocumentId: origineel.id,
    creditReason: reden.trim(),
    visibleToCustomer: origineel.visibleToCustomer,
  });
  if (!nota) return { ok: false, message: "De creditnota kon niet worden vastgelegd." };

  await db
    .update(schema.documents)
    .set({ status: "GECREDITEERD", creditedByDocumentId: nota.id })
    .where(eq(schema.documents.id, origineel.id));

  await logJourneyEvent(
    origineel.leadId,
    "invoice_credited",
    `Factuur ${origineel.nummer} gecrediteerd met ${nota.nummer} — ${reden.trim()}`,
    { actor: "admin", nummer: nota.nummer, origineel: origineel.nummer },
  );

  return { ok: true, nota };
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
  vervaldatum: Date | null;
  omschrijving: string;
  status: InvoiceStatus;
  isCreditnota: boolean;
  /** Leverancier — altijd de juridische entiteit, nooit het merk alleen. */
  leverancier: PartySnapshot & { ontbreekt: string[] };
  klant: PartySnapshot;
  regels: InvoiceLine[];
  bedragen: {
    exclCents: number;
    btwCents: number;
    inclCents: number;
    btwPercent: number;
  };
  betaling: {
    betaald: boolean;
    betaaldOp: Date | null;
    /** Nette naam van de methode, of null als die niet vaststaat. */
    methode: string | null;
    referentie: string | null;
    molliePaymentId: string | null;
  };
};

/**
 * Leest de bevroren momentopname van een document.
 *
 * Documenten van vóór de gestructureerde snapshot missen die velden. Die
 * worden hier één keer omgezet naar hetzelfde model, zodat de rest van de code
 * maar één vorm hoeft te kennen. De omzetting gebruikt UITSLUITEND wat er in
 * het document zelf staat — nooit de actuele klant- of bedrijfsgegevens, want
 * dan zou een oude factuur alsnog meebewegen.
 */
function leesSnapshot(doc: DogDocument): InvoiceSnapshot {
  const raw = doc.snapshot as unknown as Partial<InvoiceSnapshot> & {
    klant?: unknown;
    entiteit?: string[];
    facturerendePartij?: string;
    entiteitOntbreekt?: string[];
    omschrijving?: string;
  };

  if (typeof raw?.versie === "number" && Array.isArray(raw.regels) && raw.leverancier) {
    return raw as InvoiceSnapshot;
  }

  // Oud formaat: één regel, klantnaam als losse string, adresregels van de
  // leverancier in `entiteit`.
  const vatPercent = doc.vatPercent;
  const regel: InvoiceLine = {
    omschrijving: raw?.omschrijving ?? doc.titel,
    toelichting: null,
    aantal: 1,
    prijsExVatCents: doc.netExVatCents,
    vatPercent,
    regelExVatCents: doc.netExVatCents,
    regelVatCents: doc.vatCents,
    regelInclVatCents: doc.totalInclVatCents,
  };
  const oudeEntiteit = Array.isArray(raw?.entiteit) ? raw.entiteit : [];
  return {
    versie: 0,
    leverancier: {
      naam: raw?.facturerendePartij ?? oudeEntiteit[0] ?? legalEntity.name,
      contactpersoon: null,
      adresregels: oudeEntiteit.slice(1, 3),
      land: legalEntity.country,
      email: oudeEntiteit[3] ?? legalEntity.email,
      telefoon: oudeEntiteit[4] ?? legalEntity.phone,
      kvk: legalEntity.kvk || null,
      btw: legalEntity.btw || null,
      iban: legalEntity.iban || null,
    },
    klant: {
      naam: typeof raw?.klant === "string" ? raw.klant : "",
      contactpersoon: null,
      adresregels: [],
      land: null,
      email: null,
      telefoon: null,
      kvk: null,
      btw: null,
      iban: null,
    },
    regels: [regel],
    totalen: {
      exclCents: doc.netExVatCents,
      btwCents: doc.vatCents,
      inclCents: doc.totalInclVatCents,
      btwPercent: vatPercent,
    },
    omschrijving: raw?.omschrijving ?? doc.titel,
    referentie: (raw?.referentie as string) ?? null,
    molliePaymentId: (raw?.molliePaymentId as string) ?? doc.molliePaymentId,
    betaaldOp: (raw?.betaaldOp as string) ?? doc.paidAt?.toISOString() ?? null,
    betaalmethode: doc.paymentMethod ?? null,
    /*
     * Bewust de HUIDIGE stand en niet wat er destijds is opgeslagen.
     *
     * Deze oude documenten hebben hun afzendergegevens nooit bevroren: KvK en
     * btw hierboven komen live uit `legalEntity`. Zou de ontbreekt-lijst dan
     * wél uit de opslag komen, dan spreekt de factuur zichzelf tegen — de
     * nummers staan er gewoon op, terwijl de melding beweert dat ze ontbreken.
     * Eén bron voor beide, dus.
     *
     * Voor facturen mét momentopname (versie ≥ 1) blijft alles bevroren; daar
     * geldt deze tak niet.
     */
    entiteitOntbreekt: entityReady().missing,
  };
}

/**
 * Bouwt de weergave van een factuur uit het document zelf.
 *
 * Alles komt uit de bevroren momentopname. Verhuist de klant, of verandert er
 * later een bedrijfsgegeven, dan blijft deze factuur tonen wat er op het
 * moment van uitgifte gold — dat is precies wat een administratie moet doen.
 * Voor documenten van vóór de snapshot vult `leesSnapshot` aan met wat er wél
 * in het document staat; de klantgegevens komen daar dan uit de overeenkomst.
 */
export function toInvoiceView(doc: DogDocument, agreement?: Agreement | null): InvoiceView {
  const snap = leesSnapshot(doc);

  // Alleen voor de oude documenten (versie 0) vullen we de klantgegevens
  // alsnog aan uit de ondertekende overeenkomst — die is zelf ook bevroren.
  const klant: PartySnapshot =
    snap.versie === 0 && agreement
      ? {
          ...snap.klant,
          naam: snap.klant.naam || agreement.signerCompany || "",
          contactpersoon: agreement.signerName,
          adresregels: [
            agreement.signerAddress,
            [agreement.signerPostcode, agreement.signerCity].filter(Boolean).join(" "),
          ].filter((r): r is string => Boolean(r?.trim())),
          email: agreement.signerEmail,
          telefoon: agreement.signerPhone,
          kvk: agreement.signerKvk,
          btw: agreement.signerVat,
        }
      : snap.klant;

  const betaaldOp = doc.paidAt ?? (snap.betaaldOp ? new Date(snap.betaaldOp) : null);

  return {
    nummer: doc.nummer,
    datum: doc.issuedAt,
    vervaldatum: doc.dueAt,
    omschrijving: snap.omschrijving || doc.titel,
    status: doc.status,
    isCreditnota: doc.type === "CREDIT_NOTE",
    leverancier: { ...snap.leverancier, ontbreekt: snap.entiteitOntbreekt },
    klant,
    regels: snap.regels,
    bedragen: {
      exclCents: doc.netExVatCents,
      btwCents: doc.vatCents,
      inclCents: doc.totalInclVatCents,
      btwPercent: snap.totalen.btwPercent ?? doc.vatPercent,
    },
    betaling: {
      betaald: doc.status === "BETAALD" || Boolean(betaaldOp),
      betaaldOp,
      methode: betaalmethodeLabel(doc.paymentMethod ?? snap.betaalmethode),
      referentie: snap.referentie,
      molliePaymentId: doc.molliePaymentId ?? snap.molliePaymentId,
    },
  };
}

/** Haalt een factuur op en bouwt alles wat nodig is om hem te tonen. */
export async function getInvoiceView(
  nummer: string,
): Promise<{ view: InvoiceView; doc: DogDocument; leadId: string; commerceId: string } | null> {
  const db = getDb();
  if (!db) return null;

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.nummer, nummer))
    .limit(1);
  if (!doc) return null;
  if (!isInvoiceType(doc.type)) return null;

  // Alleen nodig om oude documenten (zonder snapshot) aan te vullen.
  const agreement = await findAgreement(doc.commerceId, doc.agreementId);

  return {
    doc,
    leadId: doc.leadId,
    commerceId: doc.commerceId,
    view: toInvoiceView(doc, agreement),
  };
}

/** De factuur die bij een betaling hoort, als die er is. */
export async function invoiceNumberForPayment(paymentId: string): Promise<string | null> {
  const doc = await documentForPayment(paymentId);
  return doc?.nummer ?? null;
}
