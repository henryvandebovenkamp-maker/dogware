import "server-only";
import { and, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { INVOICE_DOCUMENT_TYPES } from "@/lib/db/schema";
import type { DogDocument, InvoiceStatus, Lead } from "@/lib/db/schema";
import { isInvoiceType, toInvoiceView, type InvoiceView } from "@/lib/documents";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent } from "@/lib/journey";
import { mailAndLog } from "@/lib/commerce";
import { portalUrl } from "@/lib/portal-access";
import { branding } from "@/lib/branding";

/**
 * De centrale factuuradministratie.
 *
 * Bewust een leeslaag boven de bestaande `documents`-tabel en géén tweede
 * boekhouding: een factuur is en blijft het document dat bij een betaalde
 * termijn is vastgelegd. Wat hier bij komt is het overzicht — zoeken,
 * filteren, optellen — plus de handelingen die een beheerder erop mag doen.
 *
 * Wat hier NIET staat, en bewust niet: een manier om een factuur handmatig op
 * "betaald" te zetten. De Mollie-webhook is de bron van waarheid voor geld.
 * Een knop die dat kan overrulen maakt de administratie onbetrouwbaar zonder
 * dat iemand het merkt.
 */

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  CONCEPT: "Concept",
  OPEN: "Openstaand",
  BETAALD: "Betaald",
  VERLOPEN: "Verlopen",
  GECREDITEERD: "Gecrediteerd",
  GEANNULEERD: "Geannuleerd",
};

/**
 * De status zoals die vandaag geldt.
 *
 * "Verlopen" is geen aparte administratieve handeling maar een gevolg van de
 * kalender. Door hem af te leiden in plaats van weg te schrijven kan er nooit
 * een factuur zijn die al twee weken over datum is maar nog "openstaand"
 * beweert omdat een achtergrondtaak niet liep.
 */
export function effectieveStatus(
  doc: Pick<DogDocument, "status" | "dueAt">,
  nu: Date = new Date(),
): InvoiceStatus {
  if (doc.status === "OPEN" && doc.dueAt && doc.dueAt.getTime() < nu.getTime()) {
    return "VERLOPEN";
  }
  return doc.status;
}

/** Eén rij in het factuuroverzicht. */
export type InvoiceRow = {
  id: string;
  nummer: string;
  titel: string;
  type: DogDocument["type"];
  issuedAt: Date;
  dueAt: Date | null;
  paidAt: Date | null;
  status: InvoiceStatus;
  totalInclVatCents: number;
  netExVatCents: number;
  leadId: string;
  klant: string;
  contactpersoon: string;
  isCreditnota: boolean;
};

export type InvoiceFilter = {
  /** Vrij zoeken op factuurnummer, klantnaam, contactpersoon of Mollie-id. */
  q?: string;
  status?: InvoiceStatus | "alle";
  /** ISO-datums (YYYY-MM-DD) — inclusief begin, inclusief eind. */
  van?: string;
  tot?: string;
  leadId?: string;
  limit?: number;
};

function parseDatum(waarde: string | undefined, eindeVanDag = false): Date | null {
  if (!waarde || !/^\d{4}-\d{2}-\d{2}$/.test(waarde)) return null;
  const d = new Date(`${waarde}T${eindeVanDag ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Alle facturen die aan het filter voldoen, met de klant erbij.
 *
 * Eén query met een join in plaats van een lijst plus een lookup per rij: het
 * overzicht kan honderden facturen bevatten en mag daar niet honderden
 * queries voor doen.
 */
export async function listInvoices(filter: InvoiceFilter = {}): Promise<InvoiceRow[]> {
  const db = getDb();
  if (!db) return [];

  const voorwaarden: SQL[] = [
    inArray(schema.documents.type, [...INVOICE_DOCUMENT_TYPES]),
  ];

  if (filter.leadId) voorwaarden.push(eq(schema.documents.leadId, filter.leadId));

  const van = parseDatum(filter.van);
  const tot = parseDatum(filter.tot, true);
  if (van) voorwaarden.push(gte(schema.documents.issuedAt, van));
  if (tot) voorwaarden.push(lte(schema.documents.issuedAt, tot));

  const q = filter.q?.trim();
  if (q) {
    const patroon = `%${q}%`;
    const zoek = or(
      sql`${schema.documents.nummer} ilike ${patroon}`,
      sql`${schema.documents.titel} ilike ${patroon}`,
      sql`${schema.documents.molliePaymentId} ilike ${patroon}`,
      sql`${schema.leads.bedrijfsnaam} ilike ${patroon}`,
      sql`${schema.leads.naam} ilike ${patroon}`,
    );
    if (zoek) voorwaarden.push(zoek);
  }

  /*
   * Filteren op "verlopen" kan niet op de kolom: die status bestaat alleen als
   * afleiding. We halen de openstaande facturen op en zeven ze daarna met
   * dezelfde functie die de weergave gebruikt, zodat lijst en label nooit iets
   * anders beweren.
   */
  const gevraagd = filter.status && filter.status !== "alle" ? filter.status : null;
  if (gevraagd === "VERLOPEN") {
    voorwaarden.push(eq(schema.documents.status, "OPEN"));
  } else if (gevraagd) {
    voorwaarden.push(eq(schema.documents.status, gevraagd));
  }

  const rijen = await db
    .select({
      doc: schema.documents,
      bedrijfsnaam: schema.leads.bedrijfsnaam,
      naam: schema.leads.naam,
    })
    .from(schema.documents)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.documents.leadId))
    .where(and(...voorwaarden))
    .orderBy(desc(schema.documents.issuedAt))
    .limit(Math.min(500, Math.max(1, filter.limit ?? 250)));

  const nu = new Date();
  return rijen
    .map(({ doc, bedrijfsnaam, naam }) => ({
      id: doc.id,
      nummer: doc.nummer,
      titel: doc.titel,
      type: doc.type,
      issuedAt: doc.issuedAt,
      dueAt: doc.dueAt,
      paidAt: doc.paidAt,
      status: effectieveStatus(doc, nu),
      totalInclVatCents: doc.totalInclVatCents,
      netExVatCents: doc.netExVatCents,
      leadId: doc.leadId,
      klant: bedrijfsnaam,
      contactpersoon: naam,
      isCreditnota: doc.type === "CREDIT_NOTE",
    }))
    .filter((r) => {
      if (gevraagd === "VERLOPEN") return r.status === "VERLOPEN";
      if (gevraagd === "OPEN") return r.status === "OPEN";
      return true;
    });
}

export type InvoiceSummary = {
  openstaandCents: number;
  openstaandAantal: number;
  betaaldDezeMaandCents: number;
  betaaldDezeMaandAantal: number;
  verlopenCents: number;
  verlopenAantal: number;
  /** Netto gefactureerd dit jaar, exclusief btw en ná creditnota's. */
  gefactureerdDitJaarCents: number;
};

/**
 * De vier getallen bovenaan het factuurscherm.
 *
 * "Gefactureerd" is bewust exclusief btw en telt creditnota's mee: btw is geen
 * omzet en een gecrediteerde factuur is geen omzet meer. Creditnota's hebben
 * negatieve bedragen, dus de gewone som doet hier het juiste werk. Geannuleerde
 * facturen tellen nergens in mee.
 */
export async function invoiceSummary(nu: Date = new Date()): Promise<InvoiceSummary> {
  const leeg: InvoiceSummary = {
    openstaandCents: 0,
    openstaandAantal: 0,
    betaaldDezeMaandCents: 0,
    betaaldDezeMaandAantal: 0,
    verlopenCents: 0,
    verlopenAantal: 0,
    gefactureerdDitJaarCents: 0,
  };
  const db = getDb();
  if (!db) return leeg;

  const beginMaand = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1));
  const beginJaar = new Date(Date.UTC(nu.getUTCFullYear(), 0, 1));

  const rijen = await db
    .select({
      status: schema.documents.status,
      dueAt: schema.documents.dueAt,
      paidAt: schema.documents.paidAt,
      issuedAt: schema.documents.issuedAt,
      incl: schema.documents.totalInclVatCents,
      excl: schema.documents.netExVatCents,
    })
    .from(schema.documents)
    .where(inArray(schema.documents.type, [...INVOICE_DOCUMENT_TYPES]));

  return rijen.reduce((som, r) => {
    const status = effectieveStatus(r, nu);
    if (status === "OPEN") {
      som.openstaandCents += r.incl;
      som.openstaandAantal += 1;
    }
    if (status === "VERLOPEN") {
      som.verlopenCents += r.incl;
      som.verlopenAantal += 1;
    }
    if (status === "BETAALD" && r.paidAt && r.paidAt >= beginMaand) {
      som.betaaldDezeMaandCents += r.incl;
      som.betaaldDezeMaandAantal += 1;
    }
    if (status !== "GEANNULEERD" && status !== "CONCEPT" && r.issuedAt >= beginJaar) {
      som.gefactureerdDitJaarCents += r.excl;
    }
    return som;
  }, leeg);
}

/* =========================================================================
 * De klantkant — uitsluitend eigen facturen
 * ========================================================================= */

/**
 * De aanvragen die bij dit account horen.
 *
 * Eén plek, want dit is de enige eigendomsvraag die telt: alle klantroutes
 * hieronder gaan hier doorheen. Het koppelveld is `demoCustomerUserId` —
 * hetzelfde veld dat het bestaande klantportaal gebruikt. Bewust NIET matchen
 * op e-mailadres: dat is te makkelijk gelijk te krijgen aan dat van iemand
 * anders, en toegang tot facturen mag daar niet van afhangen.
 */
async function eigenLeads(userId: string): Promise<Lead[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.demoCustomerUserId, userId))
    .orderBy(desc(schema.leads.createdAt));
}

export type KlantFactuur = {
  nummer: string;
  omschrijving: string;
  issuedAt: Date;
  paidAt: Date | null;
  status: InvoiceStatus;
  totalInclVatCents: number;
  isCreditnota: boolean;
};

/** De facturen van deze klant. Nooit die van iemand anders. */
export async function invoicesForUser(userId: string): Promise<KlantFactuur[]> {
  const db = getDb();
  if (!db) return [];
  const leads = await eigenLeads(userId);
  if (leads.length === 0) return [];

  const rijen = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        inArray(
          schema.documents.leadId,
          leads.map((l) => l.id),
        ),
        inArray(schema.documents.type, [...INVOICE_DOCUMENT_TYPES]),
        eq(schema.documents.visibleToCustomer, true),
      ),
    )
    .orderBy(desc(schema.documents.issuedAt));

  const nu = new Date();
  return rijen
    // Een concept is nog niet uitgegeven; dat hoort een klant niet te zien.
    .filter((d) => d.status !== "CONCEPT")
    .map((d) => ({
      nummer: d.nummer,
      omschrijving: d.titel,
      issuedAt: d.issuedAt,
      paidAt: d.paidAt,
      status: effectieveStatus(d, nu),
      totalInclVatCents: d.totalInclVatCents,
      isCreditnota: d.type === "CREDIT_NOTE",
    }));
}

/**
 * Eén factuur van deze klant, of null.
 *
 * De eigendomscontrole gebeurt hier en niet in de pagina: een route die alleen
 * op een factuurnummer zoekt en daarna "vergeet" te controleren wiens factuur
 * het is, is precies het lek dat we niet willen. Nummers zijn oplopend en dus
 * te raden.
 */
export async function invoiceForUser(
  userId: string,
  nummer: string,
): Promise<{ view: InvoiceView; doc: DogDocument } | null> {
  const db = getDb();
  if (!db) return null;
  const leads = await eigenLeads(userId);
  if (leads.length === 0) return null;

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.nummer, nummer),
        inArray(
          schema.documents.leadId,
          leads.map((l) => l.id),
        ),
        eq(schema.documents.visibleToCustomer, true),
      ),
    )
    .limit(1);
  if (!doc) return null;
  if (!isInvoiceType(doc.type) || doc.status === "CONCEPT") return null;

  const [agreement] = await db
    .select()
    .from(schema.agreements)
    .where(
      and(eq(schema.agreements.commerceId, doc.commerceId), eq(schema.agreements.status, "SIGNED")),
    )
    .limit(1);

  return { view: toInvoiceView(doc, agreement ?? null), doc };
}

/* =========================================================================
 * Versturen
 * ========================================================================= */

/**
 * De link waarmee de klant deze factuur kan openen.
 *
 * Bij voorkeur de persoonlijke trajectlink: die werkt zonder in te loggen en
 * is de link die de klant al kent uit eerdere mails. Is die er niet, dan de
 * route in het klantaccount — die vraagt wel om inloggen, maar lekt niets.
 */
export async function invoiceLinkForCustomer(doc: DogDocument): Promise<string> {
  const db = getDb();
  const nummer = encodeURIComponent(doc.nummer);
  if (db) {
    const [c] = await db
      .select({ token: schema.commerce.portalToken })
      .from(schema.commerce)
      .where(eq(schema.commerce.id, doc.commerceId))
      .limit(1);
    if (c?.token) return `${portalUrl(c.token)}/factuur/${nummer}`;
  }
  return `${branding.siteUrl}/account/facturen/${nummer}`;
}

/**
 * Waar de knop in de factuurmail heen wijst.
 *
 * Voor de klant is dat zijn eigen trajectlink: die werkt zonder inloggen,
 * want een klant een wachtwoord laten verzinnen om zijn eigen factuur te zien
 * is onzin.
 *
 * Voor een KOPIE naar een ander adres ligt dat anders. Diezelfde link opent
 * het volledige traject — voorstel, overeenkomst, betalingen — zonder enige
 * controle. Die zomaar naar een willekeurig adres sturen zou een lek zijn dat
 * je zelf aanzet. Standaard wijst een kopie daarom naar de beheeromgeving, die
 * wél om een login vraagt. Alleen als de beheerder er bewust voor kiest gaat de
 * openbare link mee.
 */
async function ctaVoorFactuur(
  doc: DogDocument,
  opts: { kopie: boolean; publiekeLink: boolean },
): Promise<string> {
  if (!opts.kopie || opts.publiekeLink) return invoiceLinkForCustomer(doc);
  return `${branding.siteUrl}/admin/facturen/${encodeURIComponent(doc.nummer)}`;
}

/** Simpele, strikte controle — genoeg om een typefout tegen te houden. */
export function isGeldigEmail(waarde: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(waarde.trim());
}

/**
 * Mailt de factuur via de bestaande e-mailarchitectuur.
 *
 * Geen tweede maillaag: dit gaat door `mailAndLog`, dus het belandt
 * automatisch in het e-maillogboek én op de tijdlijn — met adres, onderwerp en
 * of het gelukt is. Opnieuw versturen is daarmee gewoon nog een keer dit
 * aanroepen.
 *
 * Twee smaken, met een belangrijk verschil:
 *
 *  - zonder `naar` gaat de factuur naar de klant. Dán pas wordt `sentAt`/
 *    `sentTo` gevuld, want dat veld betekent "de klant heeft hem gekregen".
 *  - met `naar` is het een kopie (jezelf, je boekhouder). Die raakt `sentAt`
 *    bewust NIET aan: anders zou de administratie beweren dat de klant zijn
 *    factuur heeft ontvangen terwijl hij nooit iets kreeg.
 */
export async function sendInvoiceMail(
  documentId: string,
  actorUserId?: string | null,
  opts: { naar?: string; publiekeLink?: boolean } = {},
): Promise<{ ok: true; ontvanger: string; kopie: boolean } | { ok: false; message: string }> {
  const db = getDb();
  if (!db) return { ok: false, message: "Database niet beschikbaar." };

  const naar = opts.naar?.trim();
  if (naar && !isGeldigEmail(naar)) {
    return { ok: false, message: "Dat is geen geldig e-mailadres." };
  }

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))
    .limit(1);
  if (!doc) return { ok: false, message: "Factuur niet gevonden." };
  if (!isInvoiceType(doc.type)) return { ok: false, message: "Dit is geen factuur." };
  if (doc.status === "CONCEPT") {
    return { ok: false, message: "Een concept versturen kan niet — de factuur is nog niet uitgegeven." };
  }

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, doc.leadId))
    .limit(1);
  if (!lead) return { ok: false, message: "Klant niet gevonden." };

  const ontvanger = naar || lead.email;
  const kopie = ontvanger.toLowerCase() !== lead.email.toLowerCase();
  const link = await ctaVoorFactuur(doc, {
    kopie,
    publiekeLink: opts.publiekeLink === true,
  });
  const view = toInvoiceView(doc);

  const verstuurd = await mailAndLog(
    lead,
    "invoice-sent",
    {
      amount: new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
        doc.totalInclVatCents / 100,
      ),
      extra: `${doc.nummer} · ${view.omschrijving}`,
    },
    link,
    { naar: ontvanger },
  );
  if (!verstuurd) return { ok: false, message: "De mail kon niet worden verstuurd." };

  /*
   * Alleen een echte verzending aan de klant telt als "verstuurd". Een kopie
   * naar jezelf mag die stand niet veranderen.
   */
  if (!kopie) {
    await db
      .update(schema.documents)
      .set({ sentAt: new Date(), sentTo: ontvanger })
      .where(eq(schema.documents.id, doc.id));

    await logJourneyEvent(
      lead.id,
      "invoice_sent",
      `Factuur ${doc.nummer} verstuurd naar ${ontvanger}`,
      { actor: "admin", nummer: doc.nummer },
    );
  } else {
    await logJourneyEvent(
      lead.id,
      "invoice_copy_sent",
      `Kopie van factuur ${doc.nummer} verstuurd naar ${ontvanger}${
        opts.publiekeLink ? " (met openbare bekijklink)" : ""
      }`,
      { actor: "admin", nummer: doc.nummer, internal: true },
    );
  }

  await logActivity({
    actorUserId,
    action: kopie ? "invoice.copy_sent" : "invoice.sent",
    objectType: "document",
    objectId: doc.id,
    newValue: {
      nummer: doc.nummer,
      ontvanger,
      publiekeLink: kopie ? opts.publiekeLink === true : true,
    },
  });

  return { ok: true, ontvanger, kopie };
}
