import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, max, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type {
  Commerce,
  ExtraOrder,
  ExtraOrderStatus,
  ExtraOrderVersion,
  Lead,
  MaandIngang,
  Payment,
  PaymentType,
} from "@/lib/db/schema";
import { logJourneyEvent } from "@/lib/journey";
import { logActivity } from "@/lib/audit";
import { isUniekeSchending } from "@/lib/db-errors";
import { mailAndLog, processPaymentByMollieId } from "@/lib/commerce";
import { registerDocument } from "@/lib/documents";
import {
  createMolliePayment,
  getMolliePayment,
  isMollieConfigured,
  mapMollieStatus,
  updateMollieSubscriptionAmount,
} from "@/lib/mollie";
import { euroFromCents } from "@/lib/money";
import { ensureCommerce } from "@/lib/proposals";
import { portalUrl } from "@/lib/portal-access";
import {
  eindeVanDag,
  geldigheidLabel,
  isKalenderdatum,
  kalenderdag,
  nieuweGeldigheid,
  standaardGeldigTot,
  vervaltOp,
} from "@/lib/proposal-geldigheid";
import {
  berekenOpdracht,
  euroNaarCenten,
  leesInhoud,
  maandInclBtw,
  maandMagIngaan,
  maandWijziging,
  type OpdrachtInhoud,
} from "@/lib/opdrachten/bedragen";

/**
 * Aanvullende opdrachten — de serverlaag.
 *
 * Hergebruikt alles wat er al is: de klantomgeving (/traject/[token]), de
 * Mollie-webhook als enige bron van waarheid, `payments`, `documents` met de
 * gewone factuurnummering, de tijdlijn en de mailservice. Elke statusovergang
 * is een voorwaardelijke update (WHERE status = vorige): een dubbelklik, een
 * tweede tabblad of een dubbele webhook zet nooit twee keer dezelfde stap.
 *
 * Wat hier NOOIT gebeurt: `leads.stage` of `commerce.status` wijzigen. De
 * oorspronkelijke website blijft live en actief, hoeveel opdrachten er ook
 * naast lopen.
 */

export type Uitkomst<T = undefined> =
  | (T extends undefined ? { ok: true; data?: undefined } : { ok: true; data: T })
  | { ok: false; melding: string };

const OK = { ok: true } as const;
const FOUT = (melding: string) => ({ ok: false as const, melding });

/** Na zoveel tijd geldt een betaling zonder Mollie-id als onderbroken. */
const ONDERBROKEN_NA_MS = 2 * 60_000;

/* =========================================================================
 * Lezen
 * ========================================================================= */

export async function listOpdrachten(commerceId: string): Promise<ExtraOrder[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.extraOrders)
    .where(eq(schema.extraOrders.commerceId, commerceId))
    .orderBy(desc(schema.extraOrders.volgnummer));
}

/**
 * Eén opdracht, uitsluitend binnen dit dossier. Een id van een andere klant
 * levert null op — nooit een gedeeltelijk resultaat.
 */
export async function getOpdracht(id: string, commerceId: string): Promise<ExtraOrder | null> {
  const db = getDb();
  if (!db || !isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(schema.extraOrders)
    .where(and(eq(schema.extraOrders.id, id), eq(schema.extraOrders.commerceId, commerceId)))
    .limit(1);
  return row ?? null;
}

export async function listVersies(orderId: string): Promise<ExtraOrderVersion[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.extraOrderVersions)
    .where(eq(schema.extraOrderVersions.extraOrderId, orderId))
    .orderBy(desc(schema.extraOrderVersions.version));
}

export async function betalingenVan(orderId: string): Promise<Payment[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.extraOrderId, orderId))
    .orderBy(desc(schema.payments.createdAt));
}

/** De versie die de klant nu voor zich heeft (alleen bij VERZONDEN). */
export async function huidigeVersie(order: ExtraOrder): Promise<ExtraOrderVersion | null> {
  const db = getDb();
  if (!db || order.version < 1) return null;
  const [v] = await db
    .select()
    .from(schema.extraOrderVersions)
    .where(
      and(
        eq(schema.extraOrderVersions.extraOrderId, order.id),
        eq(schema.extraOrderVersions.version, order.version),
      ),
    )
    .limit(1);
  return v ?? null;
}

/** Is de verstuurde, nog niet geaccepteerde opdracht verlopen? */
export function isOpdrachtVerlopen(order: Pick<ExtraOrder, "status" | "geldigTot">, nu = new Date()): boolean {
  if (order.status !== "VERZONDEN") return false;
  const einde = vervaltOp(order);
  return Boolean(einde && einde.getTime() < nu.getTime());
}

/** De link naar de opdracht in de klantomgeving. */
export function opdrachtUrl(token: string, orderId: string): string {
  return `${portalUrl(token)}/opdracht/${orderId}`;
}

export function opdrachtNaam(order: Pick<ExtraOrder, "volgnummer" | "titel">): string {
  return `Opdracht ${order.volgnummer}${order.titel.trim() ? ` “${order.titel.trim()}”` : ""}`;
}

/* =========================================================================
 * Concept
 * ========================================================================= */

export type ConceptInvoer = {
  titel?: string;
  omschrijving?: string;
  werkzaamheden?: string[] | string;
  prijs?: string;
  maandDelta?: string;
  maandIngang?: string;
  maandIngangDatum?: string;
  verwachteOplevering?: string;
  geldigTot?: string;
  interneNotitie?: string;
};

/** Een nieuw concept bij een bestaande klant. */
export async function maakConcept(leadId: string, actorId: string): Promise<Uitkomst<ExtraOrder>> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!lead) return FOUT("Klant niet gevonden.");
  const commerce = await ensureCommerce(leadId);
  if (!commerce) return FOUT("Klantdossier niet beschikbaar.");

  // Volgnummer per klant. Twee gelijktijdige kliks botsen op de unieke
  // index; dan gewoon het volgende nummer.
  for (let poging = 0; poging < 3; poging++) {
    const [r] = await db
      .select({ hoogste: max(schema.extraOrders.volgnummer) })
      .from(schema.extraOrders)
      .where(eq(schema.extraOrders.leadId, leadId));
    try {
      const [order] = await db
        .insert(schema.extraOrders)
        .values({
          leadId,
          commerceId: commerce.id,
          volgnummer: (r?.hoogste ?? 0) + 1,
          vatPercent: commerce.vatPercent,
          depositPercent: 50,
          geldigTot: standaardGeldigTot(),
          createdByUserId: actorId,
        })
        .returning();
      await logJourneyEvent(leadId, "extra_order_created", `${opdrachtNaam(order)} aangemaakt als concept`, {
        actor: "admin",
        internal: true,
        extraOrderId: order.id,
      });
      await logActivity({
        actorUserId: actorId,
        action: "extra_order.create",
        objectType: "extra_order",
        objectId: order.id,
        newValue: { leadId, volgnummer: order.volgnummer },
      });
      return { ok: true, data: order };
    } catch (err) {
      if (!isUniekeSchending(err, "extra_orders_lead_seq_idx")) throw err;
    }
  }
  return FOUT("Kon geen nieuwe opdracht aanmaken. Probeer het opnieuw.");
}

const kort = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Controleert en normaliseert de invoer van het conceptformulier. */
export function leesConcept(invoer: ConceptInvoer): Uitkomst<{
  titel: string;
  omschrijving: string | null;
  werkzaamheden: string[];
  priceExVatCents: number;
  monthlyDeltaCents: number;
  maandIngang: MaandIngang;
  maandIngangDatum: string | null;
  verwachteOplevering: string | null;
  geldigTot: Date | null;
  interneNotitie: string | null;
}> {
  const regels = Array.isArray(invoer.werkzaamheden)
    ? invoer.werkzaamheden
    : String(invoer.werkzaamheden ?? "").split("\n");
  const werkzaamheden = regels.map((r) => kort(r, 300)).filter(Boolean).slice(0, 40);

  const prijs = invoer.prijs?.trim() ? euroNaarCenten(invoer.prijs) : 0;
  if (prijs === null || prijs < 0) return FOUT("Vul een geldige prijs in (bijv. 1250 of 1.250,00).");
  if (prijs > 100_000_000) return FOUT("Die prijs is onwaarschijnlijk hoog. Controleer het bedrag.");

  const delta = invoer.maandDelta?.trim() ? euroNaarCenten(invoer.maandDelta) : 0;
  if (delta === null) return FOUT("Vul een geldige wijziging van het maandbedrag in (bijv. 15 of -10).");
  if (Math.abs(delta) > 10_000_000) return FOUT("Die wijziging van het maandbedrag is onwaarschijnlijk hoog.");

  const maandIngang: MaandIngang = invoer.maandIngang === "datum" ? "datum" : "oplevering";
  const maandIngangDatum = isKalenderdatum(invoer.maandIngangDatum) ? invoer.maandIngangDatum : null;
  const verwachteOplevering = isKalenderdatum(invoer.verwachteOplevering) ? invoer.verwachteOplevering : null;
  const geldigTot = isKalenderdatum(invoer.geldigTot) ? eindeVanDag(invoer.geldigTot) : null;

  return {
    ok: true,
    data: {
      titel: kort(invoer.titel, 160),
      omschrijving: kort(invoer.omschrijving, 4000) || null,
      werkzaamheden,
      priceExVatCents: prijs,
      monthlyDeltaCents: delta,
      maandIngang,
      maandIngangDatum,
      verwachteOplevering,
      geldigTot,
      interneNotitie: kort(invoer.interneNotitie, 4000) || null,
    },
  };
}

/** Automatisch opslaan. Alleen zolang de opdracht concept is. */
export async function bewaarConcept(
  orderId: string,
  commerceId: string,
  invoer: ConceptInvoer,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const gelezen = leesConcept(invoer);
  if (!gelezen.ok) return gelezen;
  const [bewaard] = await db
    .update(schema.extraOrders)
    .set({ ...gelezen.data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.extraOrders.id, orderId),
        eq(schema.extraOrders.commerceId, commerceId),
        eq(schema.extraOrders.status, "CONCEPT"),
      ),
    )
    .returning({ id: schema.extraOrders.id });
  if (!bewaard) return FOUT("Deze opdracht is geen concept meer en kan niet worden gewijzigd.");
  return OK;
}

/** De interne notitie mag in elke status — hij komt nooit bij de klant. */
export async function bewaarInterneNotitie(
  orderId: string,
  commerceId: string,
  notitie: string,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const [r] = await db
    .update(schema.extraOrders)
    .set({ interneNotitie: kort(notitie, 4000) || null, updatedAt: new Date() })
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.commerceId, commerceId)))
    .returning({ id: schema.extraOrders.id });
  return r ? OK : FOUT("Opdracht niet gevonden.");
}

/** Wat ontbreekt er nog voordat dit concept verstuurd kan worden? */
export function ontbreektVoorVersturen(order: ExtraOrder, nu = new Date()): string[] {
  const mist: string[] = [];
  if (!order.titel.trim()) mist.push("een titel");
  if (order.werkzaamheden.length === 0) mist.push("minstens één werkzaamheid of opleverpunt");
  if (order.priceExVatCents <= 0) mist.push("een prijs");
  if (!order.geldigTot) mist.push("een geldigheidsdatum");
  else if ((vervaltOp(order)?.getTime() ?? 0) < nu.getTime()) mist.push("een geldigheidsdatum vandaag of later");
  if (order.monthlyDeltaCents !== 0 && order.maandIngang === "datum" && !order.maandIngangDatum) {
    mist.push("de ingangsdatum van het nieuwe maandbedrag");
  }
  return mist;
}

/** De bevroren inhoud zoals de klant hem te zien krijgt. Server-side berekend. */
export function bevriesInhoud(order: ExtraOrder, commerce: Commerce, versie: number): OpdrachtInhoud {
  const bedragen = berekenOpdracht({
    priceExVatCents: order.priceExVatCents,
    vatPercent: order.vatPercent,
    depositPercent: order.depositPercent,
  });
  const maand = maandWijziging(commerce.monthlyCents, order.monthlyDeltaCents, order.vatPercent);
  return {
    versie,
    titel: order.titel.trim(),
    omschrijving: order.omschrijving,
    werkzaamheden: order.werkzaamheden,
    verwachteOplevering: order.verwachteOplevering,
    geldigTot: order.geldigTot?.toISOString() ?? null,
    bedragen,
    maand: maand
      ? {
          ...maand,
          ingang: order.maandIngang,
          ingangDatum: order.maandIngang === "datum" ? order.maandIngangDatum : null,
        }
      : null,
  };
}

/** De zin over het maandbedrag, voor mail en klantweergave. Null zonder wijziging. */
export function maandZin(inhoud: OpdrachtInhoud): string | null {
  const m = inhoud.maand;
  if (!m) return null;
  const richting = m.deltaExVatCents > 0 ? "omhoog" : "omlaag";
  const wanneer =
    m.ingang === "datum" && m.ingangDatum
      ? `vanaf ${geldigheidLabel(eindeVanDag(m.ingangDatum)!)}`
      : "vanaf de oplevering";
  return `Je maandbedrag gaat ${wanneer} met ${euroFromCents(Math.abs(m.deltaExVatCents))} ${richting} naar ${euroFromCents(m.naarExVatCents)} excl. btw per maand.`;
}

/* =========================================================================
 * Versturen, aanpassen, verlengen, herinneren, intrekken
 * ========================================================================= */

async function context(orderId: string, leadId: string) {
  const db = getDb();
  if (!db || !isUuid(orderId)) return null;
  const [rij] = await db
    .select({ order: schema.extraOrders, lead: schema.leads, commerce: schema.commerce })
    .from(schema.extraOrders)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.extraOrders.leadId))
    .innerJoin(schema.commerce, eq(schema.commerce.id, schema.extraOrders.commerceId))
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.leadId, leadId)))
    .limit(1);
  return rij ?? null;
}

export async function verstuurOpdracht(
  orderId: string,
  leadId: string,
  actorId: string,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  if (ctx.order.status !== "CONCEPT") return FOUT("Deze opdracht is al verstuurd.");
  const mist = ontbreektVoorVersturen(ctx.order);
  if (mist.length) return FOUT(`Nog nodig: ${mist.join(", ")}.`);
  const commerce = (await ensureCommerce(leadId)) ?? ctx.commerce;
  if (!commerce.portalToken) return FOUT("De klantomgeving is niet beschikbaar.");

  /*
   * Eerst de claim, dan pas de inhoud bevriezen uit de rij die de claim
   * teruggeeft. Zo kan een autosave die net vóór het versturen binnenkomt
   * nooit een andere tekst in de mail zetten dan in de bevroren versie.
   */
  const nu = new Date();
  const [verstuurd] = await db
    .update(schema.extraOrders)
    .set({ status: "VERZONDEN", version: ctx.order.version + 1, sentAt: nu, updatedAt: nu })
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.status, "CONCEPT")))
    .returning();
  if (!verstuurd) return FOUT("Deze opdracht is intussen al verstuurd.");

  const inhoud = bevriesInhoud(verstuurd, commerce, verstuurd.version);
  await db.insert(schema.extraOrderVersions).values({
    extraOrderId: orderId,
    leadId,
    version: verstuurd.version,
    status: "VERZONDEN",
    inhoud: inhoud as unknown as Record<string, unknown>,
    geldigTot: verstuurd.geldigTot,
    sentAt: nu,
    sentByUserId: actorId,
  });
  await registerDocument({
    leadId,
    commerceId: commerce.id,
    type: "EXTRA_ORDER",
    titel: `${opdrachtNaam(verstuurd)} — versie ${verstuurd.version}`,
    totalInclVatCents: inhoud.bedragen.inclVatCents,
    netExVatCents: inhoud.bedragen.exVatCents,
    vatCents: inhoud.bedragen.vatCents,
    vatPercent: inhoud.bedragen.vatPercent,
    snapshot: { soort: "voorstel", inhoud },
    extraOrderId: orderId,
  });

  await logJourneyEvent(
    leadId,
    "extra_order_sent",
    `${opdrachtNaam(verstuurd)} verstuurd (versie ${verstuurd.version}, ${euroFromCents(inhoud.bedragen.exVatCents)} excl. btw)`,
    { actor: "admin", extraOrderId: orderId, version: verstuurd.version },
  );
  await mailAndLog(
    ctx.lead,
    "opdracht-sent",
    {
      titel: inhoud.titel,
      amount: `${euroFromCents(inhoud.bedragen.exVatCents)} excl. btw`,
      extra: maandZin(inhoud) ?? undefined,
    },
    opdrachtUrl(commerce.portalToken, orderId),
  );
  await logActivity({
    actorUserId: actorId,
    action: "extra_order.send",
    objectType: "extra_order",
    objectId: orderId,
    newValue: { version: verstuurd.version, exVatCents: inhoud.bedragen.exVatCents, maand: inhoud.maand },
  });
  return OK;
}

/**
 * Een verstuurde opdracht aanpassen. De verstuurde versie gaat naar
 * VERVANGEN (de klant kan er geen akkoord meer op geven) en de opdracht wordt
 * weer concept. Opnieuw versturen maakt een nieuwe versie.
 */
export async function pasOpdrachtAan(orderId: string, leadId: string, actorId: string): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const [terug] = await db
    .update(schema.extraOrders)
    .set({ status: "CONCEPT", updatedAt: new Date() })
    .where(
      and(
        eq(schema.extraOrders.id, orderId),
        eq(schema.extraOrders.status, "VERZONDEN"),
        isNull(schema.extraOrders.acceptedAt),
      ),
    )
    .returning();
  if (!terug) return FOUT("Alleen een verstuurde opdracht zonder akkoord kan worden aangepast.");
  await db
    .update(schema.extraOrderVersions)
    .set({ status: "VERVANGEN", closedAt: new Date() })
    .where(
      and(
        eq(schema.extraOrderVersions.extraOrderId, orderId),
        eq(schema.extraOrderVersions.status, "VERZONDEN"),
      ),
    );
  await logJourneyEvent(
    leadId,
    "extra_order_reopened",
    `${opdrachtNaam(terug)}: versie ${terug.version} vervangen — wordt aangepast`,
    { actor: "admin", internal: true, extraOrderId: orderId },
  );
  await logActivity({
    actorUserId: actorId,
    action: "extra_order.reopen",
    objectType: "extra_order",
    objectId: orderId,
    oldValue: { version: terug.version },
  });
  return OK;
}

export async function verlengOpdracht(
  orderId: string,
  leadId: string,
  actorId: string,
  datum: string,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const nieuw = nieuweGeldigheid(datum);
  if (!nieuw.ok) return FOUT(nieuw.reden);
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const [verlengd] = await db
    .update(schema.extraOrders)
    .set({ geldigTot: nieuw.geldigTot, updatedAt: new Date() })
    .where(and(eq(schema.extraOrders.id, orderId), inArray(schema.extraOrders.status, ["CONCEPT", "VERZONDEN"])))
    .returning();
  if (!verlengd) return FOUT("De geldigheid kan alleen worden aangepast vóór het akkoord.");
  if (verlengd.status === "VERZONDEN") {
    await db
      .update(schema.extraOrderVersions)
      .set({ geldigTot: nieuw.geldigTot })
      .where(
        and(
          eq(schema.extraOrderVersions.extraOrderId, orderId),
          eq(schema.extraOrderVersions.version, verlengd.version),
        ),
      );
  }
  await logJourneyEvent(
    leadId,
    "extra_order_extended",
    `${opdrachtNaam(verlengd)}: geldig t/m ${geldigheidLabel(nieuw.geldigTot)}`,
    { actor: "admin", internal: true, extraOrderId: orderId },
  );
  await logActivity({
    actorUserId: actorId,
    action: "extra_order.extend",
    objectType: "extra_order",
    objectId: orderId,
    oldValue: { geldigTot: ctx.order.geldigTot?.toISOString() ?? null },
    newValue: { geldigTot: nieuw.geldigTot.toISOString() },
  });
  return OK;
}

/**
 * Herinnering, passend bij de status: het voorstel, de aanbetaling of de
 * eindbetaling. Altijd met de link naar dezelfde opdracht.
 */
export async function stuurHerinnering(orderId: string, leadId: string, actorId: string): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const { order, lead, commerce } = ctx;
  const inhoud = leesInhoud(order.acceptedSnapshot) ?? leesInhoud((await huidigeVersie(order))?.inhoud);
  if (!inhoud || !commerce.portalToken) return FOUT("Er is nog niets verstuurd om aan te herinneren.");
  const link = opdrachtUrl(commerce.portalToken, orderId);

  if (order.status === "VERZONDEN") {
    if (isOpdrachtVerlopen(order)) return FOUT("Deze opdracht is verlopen. Verleng eerst de geldigheid.");
    await mailAndLog(
      lead,
      "opdracht-reminder",
      {
        titel: inhoud.titel,
        extra: order.geldigTot ? `Hij is geldig tot en met ${geldigheidLabel(order.geldigTot)}.` : undefined,
      },
      link,
    );
  } else if (order.status === "AKKOORD") {
    await mailAndLog(
      lead,
      "opdracht-accepted",
      { titel: inhoud.titel, amount: euroFromCents(inhoud.bedragen.aanbetaling.inclVatCents) },
      link,
    );
  } else if (order.status === "OPGELEVERD") {
    await mailAndLog(
      lead,
      "opdracht-delivered",
      { titel: inhoud.titel, amount: euroFromCents(inhoud.bedragen.eindbetaling.inclVatCents) },
      link,
    );
  } else {
    return FOUT("Er staat op dit moment niets open om aan te herinneren.");
  }
  await db
    .update(schema.extraOrders)
    .set({ remindedAt: new Date() })
    .where(eq(schema.extraOrders.id, orderId));
  await logActivity({ actorUserId: actorId, action: "extra_order.remind", objectType: "extra_order", objectId: orderId });
  return OK;
}

/**
 * Intrekken. Alleen zolang er niets betaald is en er geen betaling loopt:
 * anders zou een klant op een ingetrokken opdracht kunnen betalen.
 */
export async function trekOpdrachtIn(
  orderId: string,
  leadId: string,
  actorId: string,
  reden: string,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const lopend = (await betalingenVan(orderId)).filter((p) =>
    ["CREATED", "OPEN", "PENDING", "PAID"].includes(p.status),
  );
  if (lopend.length) {
    return FOUT("Er is al een betaling gestart of ontvangen voor deze opdracht. Intrekken kan dan niet meer.");
  }
  const [ingetrokken] = await db
    .update(schema.extraOrders)
    .set({ status: "INGETROKKEN", cancelledAt: new Date(), cancelReason: kort(reden, 500) || null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.extraOrders.id, orderId),
        inArray(schema.extraOrders.status, ["CONCEPT", "VERZONDEN", "AKKOORD"]),
      ),
    )
    .returning();
  if (!ingetrokken) return FOUT("Deze opdracht kan in deze fase niet meer worden ingetrokken.");
  await db
    .update(schema.extraOrderVersions)
    .set({ status: "INGETROKKEN", closedAt: new Date() })
    .where(
      and(
        eq(schema.extraOrderVersions.extraOrderId, orderId),
        eq(schema.extraOrderVersions.status, "VERZONDEN"),
      ),
    );
  await logJourneyEvent(leadId, "extra_order_cancelled", `${opdrachtNaam(ingetrokken)} ingetrokken`, {
    actor: "admin",
    internal: ctx.order.status === "CONCEPT",
    extraOrderId: orderId,
  });
  await logActivity({
    actorUserId: actorId,
    action: "extra_order.cancel",
    objectType: "extra_order",
    objectId: orderId,
    oldValue: { status: ctx.order.status },
    reason: reden || undefined,
  });
  return OK;
}

/* =========================================================================
 * Klant — akkoord
 * ========================================================================= */

export type AkkoordInvoer = {
  versie: number;
  naam: string;
  agreesOpdracht: boolean;
  agreesMaandbedrag: boolean;
  ipHash: string;
  userAgent: string;
};

export async function accepteerOpdracht(
  lead: Lead,
  commerce: Commerce,
  orderId: string,
  invoer: AkkoordInvoer,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Tijdelijk niet beschikbaar.");
  const order = await getOpdracht(orderId, commerce.id);
  if (!order) return FOUT("Deze opdracht is niet gevonden.");
  if (order.acceptedAt) return OK; // al akkoord — idempotent
  if (order.status === "CONCEPT" && order.version > 0) {
    return FOUT("Deze opdracht wordt op dit moment aangepast. Je ontvangt binnenkort de nieuwe versie.");
  }
  if (order.status !== "VERZONDEN") return FOUT("Op deze opdracht kun je geen akkoord meer geven.");
  if (invoer.versie !== order.version) {
    return FOUT("Er staat intussen een nieuwere versie van deze opdracht klaar. Ververs de pagina en bekijk die eerst.");
  }
  if (isOpdrachtVerlopen(order)) {
    return FOUT("Deze opdracht is niet meer geldig. Neem even contact met ons op, dan zetten we hem opnieuw klaar.");
  }
  const versie = await huidigeVersie(order);
  const inhoud = leesInhoud(versie?.inhoud);
  if (!versie || !inhoud) return FOUT("Deze opdracht is niet compleet. Neem even contact met ons op.");

  const naam = invoer.naam.trim();
  if (naam.length < 2) return FOUT("Vul je naam in om akkoord te geven.");
  if (!invoer.agreesOpdracht) return FOUT("Vink aan dat je akkoord gaat met de opdracht en de prijs.");
  if (inhoud.maand && !invoer.agreesMaandbedrag) {
    return FOUT("Vink aan dat je akkoord gaat met het nieuwe maandbedrag en de ingangsdatum.");
  }

  /*
   * Atomair op status én versie: van twee gelijktijdige kliks krijgt er één
   * een rij terug, en een akkoord op een inmiddels vervangen versie kan niet.
   */
  const nu = new Date();
  const [geaccepteerd] = await db
    .update(schema.extraOrders)
    .set({
      status: "AKKOORD",
      acceptedAt: nu,
      acceptedVersion: order.version,
      acceptedName: naam.slice(0, 160),
      acceptedIpHash: invoer.ipHash,
      acceptedUserAgent: invoer.userAgent,
      agreesOpdracht: true,
      agreesMaandbedrag: Boolean(inhoud.maand && invoer.agreesMaandbedrag),
      acceptedSnapshot: versie.inhoud,
      updatedAt: nu,
    })
    .where(
      and(
        eq(schema.extraOrders.id, order.id),
        eq(schema.extraOrders.status, "VERZONDEN"),
        eq(schema.extraOrders.version, invoer.versie),
        isNull(schema.extraOrders.acceptedAt),
      ),
    )
    .returning();
  if (!geaccepteerd) {
    const opnieuw = await getOpdracht(order.id, commerce.id);
    return opnieuw?.acceptedAt
      ? OK
      : FOUT("Er is intussen iets aan deze opdracht veranderd. Ververs de pagina en probeer het opnieuw.");
  }

  await db
    .update(schema.extraOrderVersions)
    .set({ status: "GEACCEPTEERD", closedAt: nu })
    .where(eq(schema.extraOrderVersions.id, versie.id));

  await registerDocument({
    leadId: lead.id,
    commerceId: commerce.id,
    type: "EXTRA_ORDER",
    titel: `${opdrachtNaam(geaccepteerd)} — akkoord op versie ${order.version}`,
    totalInclVatCents: inhoud.bedragen.inclVatCents,
    netExVatCents: inhoud.bedragen.exVatCents,
    vatCents: inhoud.bedragen.vatCents,
    vatPercent: inhoud.bedragen.vatPercent,
    snapshot: {
      soort: "akkoord",
      inhoud,
      akkoord: {
        naam,
        op: nu.toISOString(),
        versie: order.version,
        ipHash: invoer.ipHash,
        userAgent: invoer.userAgent,
        opdracht: true,
        maandbedrag: Boolean(inhoud.maand),
      },
    },
    extraOrderId: order.id,
  });

  await logJourneyEvent(
    lead.id,
    "extra_order_accepted",
    `${opdrachtNaam(geaccepteerd)}: akkoord gegeven door ${naam} (versie ${order.version})${inhoud.maand ? ", inclusief het nieuwe maandbedrag" : ""}`,
    { actor: "klant", extraOrderId: order.id, version: order.version, ipHash: invoer.ipHash },
  );
  await logActivity({
    action: "extra_order.accept",
    objectType: "extra_order",
    objectId: order.id,
    newValue: { version: order.version, naam, ipHash: invoer.ipHash, maand: inhoud.maand },
  });
  if (commerce.portalToken) {
    await mailAndLog(
      lead,
      "opdracht-accepted",
      {
        titel: inhoud.titel,
        amount: euroFromCents(inhoud.bedragen.aanbetaling.inclVatCents),
        extra: maandZin(inhoud) ?? undefined,
      },
      opdrachtUrl(commerce.portalToken, order.id),
    );
  }
  return OK;
}

export async function markeerBekeken(order: ExtraOrder): Promise<void> {
  const db = getDb();
  if (!db || order.firstViewedAt || order.status !== "VERZONDEN") return;
  const [eerste] = await db
    .update(schema.extraOrders)
    .set({ firstViewedAt: new Date() })
    .where(and(eq(schema.extraOrders.id, order.id), isNull(schema.extraOrders.firstViewedAt)))
    .returning({ id: schema.extraOrders.id });
  if (eerste) {
    await logJourneyEvent(order.leadId, "extra_order_viewed", `${opdrachtNaam(order)} voor het eerst bekeken`, {
      actor: "klant",
      internal: true,
      extraOrderId: order.id,
    });
  }
}

/* =========================================================================
 * Klant — betalen
 * ========================================================================= */

export type BetaalSoort = "aanbetaling" | "eindbetaling";

export async function startOpdrachtBetaling(
  lead: Lead,
  commerce: Commerce,
  orderId: string,
  soort: BetaalSoort,
  actor: "klant" | "admin" = "klant",
): Promise<Uitkomst<{ checkoutUrl: string }>> {
  const db = getDb();
  if (!db) return FOUT("Tijdelijk niet beschikbaar.");
  if (soort !== "aanbetaling" && soort !== "eindbetaling") return FOUT("Onbekende betaling.");
  const order = await getOpdracht(orderId, commerce.id);
  if (!order) return FOUT("Deze opdracht is niet gevonden.");
  const inhoud = leesInhoud(order.acceptedSnapshot);
  if (!order.acceptedAt || !inhoud) return FOUT("Geef eerst akkoord op de opdracht.");

  const type: PaymentType = soort === "aanbetaling" ? "EXTRA_DEPOSIT" : "EXTRA_FINAL";
  const nodig: ExtraOrderStatus = soort === "aanbetaling" ? "AKKOORD" : "OPGELEVERD";
  if (order.status !== nodig) {
    if (soort === "aanbetaling" && order.depositPaidAt) return FOUT("De aanbetaling is al ontvangen.");
    if (soort === "eindbetaling" && order.finalPaidAt) return FOUT("De eindbetaling is al ontvangen.");
    return FOUT(
      soort === "eindbetaling"
        ? "De eindbetaling komt beschikbaar zodra de opdracht is opgeleverd."
        : "Op deze opdracht staat geen aanbetaling open.",
    );
  }
  const termijn = soort === "aanbetaling" ? inhoud.bedragen.aanbetaling : inhoud.bedragen.eindbetaling;
  const amountCents = termijn.inclVatCents;
  if (amountCents <= 0) return FOUT("Er staat op dit moment niets open.");
  if (!isMollieConfigured()) return FOUT("Betalen is nog niet geconfigureerd.");
  if (!commerce.portalToken) return FOUT("De klantomgeving is niet beschikbaar.");

  /*
   * Herhaald klikken. Loopt er al een betaling voor deze termijn, dan gaat de
   * klant naar diezelfde checkout — er komt geen tweede betaalverzoek.
   */
  const nu = new Date();
  const [bestaand] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.extraOrderId, order.id),
        eq(schema.payments.type, type),
        inArray(schema.payments.status, ["CREATED", "OPEN", "PENDING", "PAID"]),
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);
  if (bestaand?.status === "PAID") return FOUT("Deze betaling is al ontvangen.");
  if (bestaand?.status === "CREATED" && !bestaand.molliePaymentId) {
    if (nu.getTime() - bestaand.createdAt.getTime() < ONDERBROKEN_NA_MS) {
      return FOUT("Er wordt al een betaling gestart. Een moment geduld.");
    }
    // Nooit bij Mollie aangekomen: vrijgeven, zodat de klant opnieuw kan.
    await db
      .update(schema.payments)
      .set({ status: "FAILED", failureReason: "Onderbroken voordat de betaling bij Mollie werd aangemaakt." })
      .where(
        and(
          eq(schema.payments.id, bestaand.id),
          eq(schema.payments.status, "CREATED"),
          isNull(schema.payments.molliePaymentId),
          lt(schema.payments.createdAt, new Date(nu.getTime() - ONDERBROKEN_NA_MS)),
        ),
      );
  }
  if (bestaand?.molliePaymentId && ["OPEN", "PENDING"].includes(bestaand.status)) {
    const live = await getMolliePayment(bestaand.molliePaymentId);
    const url = live?.getCheckoutUrl?.();
    if (url) return { ok: true, data: { checkoutUrl: url } };
    if (live) {
      const echt = mapMollieStatus(live.status);
      if (echt === "PAID") {
        await processPaymentByMollieId(bestaand.molliePaymentId);
        return FOUT("Deze betaling is zojuist ontvangen. Ververs de pagina.");
      }
      if (echt === "OPEN" || echt === "PENDING") {
        return FOUT("Je vorige betaling wordt nog verwerkt. Probeer het over een paar minuten opnieuw.");
      }
      // Verlopen of afgebroken: via de gewone verwerking vastleggen, dan opnieuw.
      await processPaymentByMollieId(bestaand.molliePaymentId);
    }
  }

  const referentie = `DW-${lead.bedrijfsnaam.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}-OPDRACHT${order.volgnummer}-${soort === "aanbetaling" ? "AANBETALING" : "EINDBETALING"}-${Date.now().toString(36)}`;

  let record: Payment;
  try {
    [record] = await db
      .insert(schema.payments)
      .values({
        commerceId: commerce.id,
        type,
        amountCents,
        status: "CREATED",
        extraOrderId: order.id,
        referentie,
        sequenceType: "oneoff",
      })
      .returning();
  } catch (err) {
    // De laatste grendel tegen een dubbelklik: één lopende betaling per termijn.
    if (isUniekeSchending(err, "payments_extra_active_idx")) {
      return FOUT("Er loopt al een betaling voor deze opdracht. Ververs de pagina.");
    }
    if (isUniekeSchending(err, "payments_extra_paid_idx")) return FOUT("Deze betaling is al ontvangen.");
    throw err;
  }

  const result = await createMolliePayment({
    amountCents,
    description: `DogWare ${soort} — ${inhoud.titel} — ${lead.bedrijfsnaam}`.slice(0, 255),
    redirectUrl: `${opdrachtUrl(commerce.portalToken, order.id)}?betaling=terug`,
    metadata: {
      paymentId: record.id,
      leadId: lead.id,
      commerceId: commerce.id,
      extraOrderId: order.id,
      type,
    },
    reference: referentie,
    sequenceType: "oneoff",
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
    .set({ molliePaymentId: result.molliePaymentId, status: "OPEN", sequenceType: result.usedSequence })
    .where(eq(schema.payments.id, record.id));

  await logJourneyEvent(
    lead.id,
    "payment_created",
    `${opdrachtNaam(order)}: ${soort} gestart (${euroFromCents(amountCents)})`,
    { actor, referentie, molliePaymentId: result.molliePaymentId, extraOrderId: order.id },
  );
  return { ok: true, data: { checkoutUrl: result.checkoutUrl } };
}

/* =========================================================================
 * Webhook — aangeroepen vanuit lib/commerce.ts, ná de factuurregistratie
 * ========================================================================= */

/**
 * Een termijn van een aanvullende opdracht is betaald.
 *
 * Komt uitsluitend uit `processPaymentByMollieId` — dus na de echte
 * Mollie-status, de bedragcontrole en de atomaire claim op de betaling. Die
 * claim garandeert al dat dit één keer gebeurt; de voorwaardelijke
 * statusupdate hieronder is de tweede grendel.
 */
export async function opdrachtBetalingBetaald(
  payment: Payment,
  ctx: { lead: Lead; commerce: Commerce },
): Promise<void> {
  const db = getDb();
  if (!db || !payment.extraOrderId) return;
  const order = await getOpdracht(payment.extraOrderId, ctx.commerce.id);
  if (!order) return;
  const inhoud = leesInhoud(order.acceptedSnapshot);
  const link = ctx.commerce.portalToken ? opdrachtUrl(ctx.commerce.portalToken, order.id) : undefined;
  const nu = new Date();

  if (payment.type === "EXTRA_DEPOSIT") {
    const [bijgewerkt] = await db
      .update(schema.extraOrders)
      .set({ status: "AANBETAALD", depositPaidAt: payment.paidAt ?? nu, updatedAt: nu })
      .where(and(eq(schema.extraOrders.id, order.id), eq(schema.extraOrders.status, "AKKOORD")))
      .returning();
    if (!bijgewerkt) {
      await onverwachteBetaling(order, payment);
      return;
    }
    await logJourneyEvent(
      ctx.lead.id,
      "extra_order_deposit_paid",
      `${opdrachtNaam(order)}: aanbetaling ontvangen (${euroFromCents(payment.amountCents)})`,
      { actor: "systeem", extraOrderId: order.id, molliePaymentId: payment.molliePaymentId },
    );
    await mailAndLog(
      ctx.lead,
      "opdracht-deposit-received",
      { titel: inhoud?.titel ?? order.titel, amount: euroFromCents(payment.amountCents) },
      link,
    );
    // Een maandwijziging met een vaste datum die al bereikt is, gaat nu in.
    await pasMaandbedragToeAlsTijd(bijgewerkt);
    return;
  }

  if (payment.type === "EXTRA_FINAL") {
    const [bijgewerkt] = await db
      .update(schema.extraOrders)
      .set({ status: "EINDBETAALD", finalPaidAt: payment.paidAt ?? nu, updatedAt: nu })
      .where(and(eq(schema.extraOrders.id, order.id), eq(schema.extraOrders.status, "OPGELEVERD")))
      .returning();
    if (!bijgewerkt) {
      await onverwachteBetaling(order, payment);
      return;
    }
    await logJourneyEvent(
      ctx.lead.id,
      "extra_order_final_paid",
      `${opdrachtNaam(order)}: eindbetaling ontvangen (${euroFromCents(payment.amountCents)})`,
      { actor: "systeem", extraOrderId: order.id, molliePaymentId: payment.molliePaymentId },
    );
    await pasMaandbedragToeAlsTijd(bijgewerkt);
    // Alles is betaald en opgeleverd: de opdracht is daarmee af.
    await rondOpdrachtAf(order.id, ctx.lead.id, null);
  }
}

/** Een betaling op een opdracht die niet (meer) op die betaling wachtte. */
async function onverwachteBetaling(order: ExtraOrder, payment: Payment): Promise<void> {
  await logJourneyEvent(
    order.leadId,
    "extra_order_payment_unexpected",
    `${opdrachtNaam(order)}: betaling van ${euroFromCents(payment.amountCents)} ontvangen terwijl de opdracht op "${order.status}" stond. De factuur is vastgelegd; controleer of terugbetalen nodig is.`,
    { actor: "systeem", internal: true, extraOrderId: order.id, paymentId: payment.id },
  );
}

/* =========================================================================
 * Admin — bouwen, opleveren, afronden
 * ========================================================================= */

/** De bouw mag pas starten als Mollie de aanbetaling heeft bevestigd. */
export async function startBouw(orderId: string, leadId: string, actorId: string): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const betaald = (await betalingenVan(orderId)).some((p) => p.type === "EXTRA_DEPOSIT" && p.status === "PAID");
  if (!betaald || ctx.order.status !== "AANBETAALD") {
    return FOUT("De bouw kan pas starten zodra Mollie de aanbetaling heeft bevestigd.");
  }
  const nu = new Date();
  const [gestart] = await db
    .update(schema.extraOrders)
    .set({ status: "IN_UITVOERING", buildStartedAt: nu, updatedAt: nu })
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.status, "AANBETAALD")))
    .returning();
  if (!gestart) return FOUT("De bouw is al gestart.");
  const inhoud = leesInhoud(gestart.acceptedSnapshot);
  await logJourneyEvent(leadId, "extra_order_build_started", `${opdrachtNaam(gestart)}: bouw gestart`, {
    actor: "admin",
    extraOrderId: orderId,
  });
  if (ctx.commerce.portalToken) {
    await mailAndLog(
      ctx.lead,
      "opdracht-build-started",
      {
        titel: inhoud?.titel ?? gestart.titel,
        extra: inhoud?.verwachteOplevering
          ? `De verwachte oplevering is rond ${geldigheidLabel(eindeVanDag(inhoud.verwachteOplevering)!)}.`
          : undefined,
      },
      opdrachtUrl(ctx.commerce.portalToken, orderId),
    );
  }
  await logActivity({ actorUserId: actorId, action: "extra_order.start", objectType: "extra_order", objectId: orderId });
  return OK;
}

/**
 * Opleveren en de tweede termijn vrijgeven. De mail is het betaalverzoek:
 * de knop opent de opdracht in de klantomgeving, waar de Mollie-checkout pas
 * bij het klikken ontstaat (een vooraf gemaakte checkout verloopt).
 */
export async function leverOpdrachtOp(orderId: string, leadId: string, actorId: string): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const nu = new Date();
  const [opgeleverd] = await db
    .update(schema.extraOrders)
    .set({ status: "OPGELEVERD", deliveredAt: nu, updatedAt: nu })
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.status, "IN_UITVOERING")))
    .returning();
  if (!opgeleverd) return FOUT("Alleen een opdracht die in uitvoering is, kan worden opgeleverd.");
  const inhoud = leesInhoud(opgeleverd.acceptedSnapshot);
  await logJourneyEvent(
    leadId,
    "extra_order_delivered",
    `${opdrachtNaam(opgeleverd)}: opgeleverd — eindbetaling vrijgegeven`,
    { actor: "admin", extraOrderId: orderId },
  );

  const maand = await pasMaandbedragToeAlsTijd(opgeleverd);

  if (ctx.commerce.portalToken && inhoud) {
    await mailAndLog(
      ctx.lead,
      "opdracht-delivered",
      {
        titel: inhoud.titel,
        amount: euroFromCents(inhoud.bedragen.eindbetaling.inclVatCents),
        extra: maand?.toegepast ? maandZin(inhoud) ?? undefined : undefined,
      },
      opdrachtUrl(ctx.commerce.portalToken, orderId),
    );
  }
  await logActivity({ actorUserId: actorId, action: "extra_order.deliver", objectType: "extra_order", objectId: orderId });
  return OK;
}

/** Afronden na de eindbetaling. Ook automatisch vanuit de webhook. */
export async function rondOpdrachtAf(orderId: string, leadId: string, actorId: string | null): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return FOUT("Database niet beschikbaar.");
  const ctx = await context(orderId, leadId);
  if (!ctx) return FOUT("Opdracht niet gevonden.");
  const nu = new Date();
  const [af] = await db
    .update(schema.extraOrders)
    .set({ status: "AFGEROND", completedAt: nu, updatedAt: nu })
    .where(and(eq(schema.extraOrders.id, orderId), eq(schema.extraOrders.status, "EINDBETAALD")))
    .returning();
  if (!af) return FOUT("Een opdracht kan pas worden afgerond als de eindbetaling binnen is.");
  const inhoud = leesInhoud(af.acceptedSnapshot);
  await logJourneyEvent(leadId, "extra_order_completed", `${opdrachtNaam(af)}: afgerond`, {
    actor: actorId ? "admin" : "systeem",
    extraOrderId: orderId,
  });
  const maand =
    inhoud?.maand && af.maandNaarCents !== null
      ? `Je maandbedrag is aangepast naar ${euroFromCents(af.maandNaarCents)} excl. btw. Je website en abonnement lopen verder gewoon door.`
      : inhoud?.maand && inhoud.maand.ingang === "datum" && inhoud.maand.ingangDatum
        ? `${maandZin(inhoud)} Je website en abonnement lopen verder gewoon door.`
        : undefined;
  await mailAndLog(
    ctx.lead,
    "opdracht-completed",
    {
      titel: inhoud?.titel ?? af.titel,
      amount: inhoud ? euroFromCents(inhoud.bedragen.eindbetaling.inclVatCents) : undefined,
      extra: maand,
    },
    ctx.commerce.portalToken ? opdrachtUrl(ctx.commerce.portalToken, orderId) : undefined,
  );
  if (actorId) {
    await logActivity({ actorUserId: actorId, action: "extra_order.complete", objectType: "extra_order", objectId: orderId });
  }
  return OK;
}

/* =========================================================================
 * Maandbedrag — het bestaande abonnement aanpassen, nooit een tweede
 * ========================================================================= */

/** Is het moment voor de maandwijziging van deze opdracht aangebroken? */
export function maandIsAanDeBeurt(order: ExtraOrder, nu = new Date()): boolean {
  if (order.maandToegepastAt || !maandMagIngaan(order.status)) return false;
  const inhoud = leesInhoud(order.acceptedSnapshot);
  if (!inhoud?.maand) return false;
  if (inhoud.maand.ingang === "datum") {
    return Boolean(inhoud.maand.ingangDatum && inhoud.maand.ingangDatum <= kalenderdag(nu));
  }
  return Boolean(order.deliveredAt);
}

/**
 * Past het maandbedrag toe als het zover is. Idempotent: een tweede aanroep
 * (dubbele webhook, cron, opnieuw opleveren) doet niets.
 *
 * Volgorde, met elke stap terug te draaien:
 *   1. claim op de opdracht (maand_toegepast_at IS NULL);
 *   2. het maandbedrag op de afspraak, optimistisch op het oude bedrag — zo
 *      tellen twee gelijktijdige opdrachten elk hun eigen verschil op;
 *   3. het BESTAANDE Mollie-abonnement bijwerken. Mislukt dat, dan gaan 1 en 2
 *      terug en probeert de dagelijkse ronde het opnieuw.
 */
export async function pasMaandbedragToeAlsTijd(
  order: ExtraOrder,
  nu = new Date(),
): Promise<{ toegepast: boolean; melding?: string } | null> {
  const db = getDb();
  if (!db || !maandIsAanDeBeurt(order, nu)) return null;
  const inhoud = leesInhoud(order.acceptedSnapshot)!;
  const delta = inhoud.maand!.deltaExVatCents;

  const [commerce] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.id, order.commerceId))
    .limit(1);
  if (!commerce) return null;
  const van = commerce.monthlyCents;
  const naar = van + delta;
  if (naar < 0 || (naar === 0 && commerce.mollieSubscriptionId)) {
    await logJourneyEvent(
      order.leadId,
      "extra_order_monthly_blocked",
      `${opdrachtNaam(order)}: het maandbedrag zou ${euroFromCents(naar)} worden. Niet automatisch aangepast — handel dit handmatig af.`,
      { actor: "systeem", internal: true, extraOrderId: order.id },
    );
    return { toegepast: false, melding: "Het nieuwe maandbedrag is niet geldig." };
  }

  const [claim] = await db
    .update(schema.extraOrders)
    .set({ maandToegepastAt: nu, maandVanCents: van, maandNaarCents: naar })
    .where(and(eq(schema.extraOrders.id, order.id), isNull(schema.extraOrders.maandToegepastAt)))
    .returning({ id: schema.extraOrders.id });
  if (!claim) return null;

  const loslaten = async () => {
    await db
      .update(schema.extraOrders)
      .set({ maandToegepastAt: null, maandVanCents: null, maandNaarCents: null })
      .where(eq(schema.extraOrders.id, order.id));
  };

  const [afspraak] = await db
    .update(schema.commerce)
    .set({ monthlyCents: naar, updatedAt: nu })
    .where(and(eq(schema.commerce.id, commerce.id), eq(schema.commerce.monthlyCents, van)))
    .returning({ id: schema.commerce.id });
  if (!afspraak) {
    await loslaten();
    return { toegepast: false, melding: "Het maandbedrag veranderde tegelijk; de dagelijkse ronde probeert het opnieuw." };
  }

  if (commerce.mollieSubscriptionId && commerce.mollieCustomerId) {
    const res = await updateMollieSubscriptionAmount({
      mollieCustomerId: commerce.mollieCustomerId,
      subscriptionId: commerce.mollieSubscriptionId,
      amountCents: maandInclBtw(naar, commerce.vatPercent),
    });
    if (!res.ok) {
      await db
        .update(schema.commerce)
        .set({ monthlyCents: van, updatedAt: new Date() })
        .where(and(eq(schema.commerce.id, commerce.id), eq(schema.commerce.monthlyCents, naar)));
      await loslaten();
      await logJourneyEvent(
        order.leadId,
        "extra_order_monthly_failed",
        `${opdrachtNaam(order)}: maandbedrag nog niet aangepast — ${res.message} De dagelijkse ronde probeert het opnieuw.`,
        { actor: "systeem", internal: true, extraOrderId: order.id },
      );
      return { toegepast: false, melding: res.message };
    }
  } else {
    await logJourneyEvent(
      order.leadId,
      "extra_order_monthly_no_subscription",
      `${opdrachtNaam(order)}: er loopt nog geen Mollie-abonnement. Het nieuwe maandbedrag staat in de afspraak en geldt zodra het abonnement start.`,
      { actor: "systeem", internal: true, extraOrderId: order.id },
    );
  }

  await logJourneyEvent(
    order.leadId,
    "extra_order_monthly_applied",
    `Maandbedrag aangepast van ${euroFromCents(van)} naar ${euroFromCents(naar)} excl. btw (${opdrachtNaam(order)})`,
    { actor: "systeem", extraOrderId: order.id, van, naar },
  );
  await logActivity({
    action: "extra_order.monthly_applied",
    objectType: "commerce",
    objectId: commerce.id,
    oldValue: { monthlyCents: van },
    newValue: { monthlyCents: naar, extraOrderId: order.id, subscriptionId: commerce.mollieSubscriptionId },
  });
  return { toegepast: true };
}

/** De dagelijkse ronde (cron): maandwijzigingen waarvan de dag is aangebroken. */
export async function runOpdrachtRonde(nu = new Date()): Promise<{ maandAangepast: number }> {
  const db = getDb();
  const uitkomst = { maandAangepast: 0 };
  if (!db) return uitkomst;
  const kandidaten = await db
    .select()
    .from(schema.extraOrders)
    .where(
      and(
        isNull(schema.extraOrders.maandToegepastAt),
        ne(schema.extraOrders.monthlyDeltaCents, 0),
        inArray(schema.extraOrders.status, ["AANBETAALD", "IN_UITVOERING", "OPGELEVERD", "EINDBETAALD", "AFGEROND"]),
      ),
    )
    .orderBy(asc(schema.extraOrders.acceptedAt));
  for (const order of kandidaten) {
    const r = await pasMaandbedragToeAlsTijd(order, nu);
    if (r?.toegepast) uitkomst.maandAangepast++;
  }
  return uitkomst;
}

/* ------------------------------------------------------------- helpers ---- */

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
