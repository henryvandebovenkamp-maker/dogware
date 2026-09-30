import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Lead } from "@/lib/db/schema";
import { leidAf, type AanvraagAfleiding } from "@/lib/aanvragen";
import type { JourneySnapshot } from "@/lib/journey-next";
import { regelingStand } from "@/lib/payment-plan";
import {
  EVENT_DEMO_AFGEROND,
  EVENT_HANDMATIG_AFGEVALLEN,
  EVENT_HEROPEND,
  demoAfgerondOp,
} from "@/lib/demo-afronding-tekst";

/**
 * Het aanvragenoverzicht in één keer laden.
 *
 * De detailpagina bouwt zijn snapshot uit een handvol losse queries per
 * aanvraag. Dat kan daar prima — het is één aanvraag — maar in de lijst zou
 * datzelfde patroon per rij een stuk of acht queries kosten. Hier gebeurt het
 * daarom in vaste stappen: eerst de aanvragen, dan per relatie één query voor
 * álle aanvragen tegelijk, en daarna in geheugen samenvoegen.
 *
 * Twee dingen die uit de echte data volgen en makkelijk fout gaan:
 *
 *  - Niet elke aanvraag heeft een `commerce`-rij. Er zijn er nu twee zonder.
 *    Deze lijst leest alleen en mag er dus nooit een aanmaken; een ontbrekende
 *    rij betekent gewoon "commercieel nog niets gebeurd".
 *  - "Contact gehad" wordt afgeleid uit gebeurtenissen van de KLANT, niet uit
 *    alles wat een admin deed. De demomail zelf logt als systeem, en een
 *    handmatige statuscorrectie door de beheerder is geen reactie van de klant.
 *    Zouden we die meetellen, dan verdwijnt een aanvraag uit "opvolgen" zonder
 *    dat er iemand iets van zich heeft laten horen.
 */

export type Aanvraag = {
  lead: Lead;
  afleiding: AanvraagAfleiding;
  /** Laatste keer dat de klant zelf iets deed. */
  laatsteContactAt: Date | null;
  /**
   * Het commerciële dossier, of null als dat er nog niet is. De klantenpagina
   * leest hieruit het maandbedrag en de opleverdata; de aanvragenlijst niet.
   */
  commerce: {
    maandbedragCenten: number;
    opleveringKlaarAt: Date | null;
    liveAt: Date | null;
  } | null;
  /**
   * Alleen bij een afgeronde demo: wanneer, de PDF die meeging en naar wie de
   * afsluitmail ging. Null voor alle andere aanvragen.
   */
  demoAfsluiting: {
    afgerondOp: Date;
    pdfId: string | null;
    mailNaar: string | null;
  } | null;
};

/** Gebeurtenissen die tellen als "de klant heeft van zich laten horen". */
const KLANT_CONTACT = sql`(${schema.journeyEvents.actor} = 'klant' or ${schema.journeyEvents.kind} = 'internal_note')`;

export async function laadAanvragen(nu: Date = new Date()): Promise<Aanvraag[] | null> {
  const db = getDb();
  if (!db) return null;

  const leads = await db
    .select()
    .from(schema.leads)
    .orderBy(desc(schema.leads.createdAt));
  if (leads.length === 0) return [];

  const ids = leads.map((l) => l.id);

  const [commerceRijen, contactRijen, afsluitRijen, demoPdfRijen] = await Promise.all([
    db
      .select()
      .from(schema.commerce)
      .where(inArray(schema.commerce.leadId, ids)),
    db
      .select({
        leadId: schema.journeyEvents.leadId,
        laatste: sql<string | null>`max(${schema.journeyEvents.createdAt})`,
      })
      .from(schema.journeyEvents)
      .where(and(inArray(schema.journeyEvents.leadId, ids), KLANT_CONTACT))
      .groupBy(schema.journeyEvents.leadId),
    // De momenten die bepalen of een aanvraag een afgeronde demo is.
    db
      .select({
        leadId: schema.journeyEvents.leadId,
        kind: schema.journeyEvents.kind,
        laatste: sql<string | null>`max(${schema.journeyEvents.createdAt})`,
      })
      .from(schema.journeyEvents)
      .where(
        and(
          inArray(schema.journeyEvents.leadId, ids),
          inArray(schema.journeyEvents.kind, [
            EVENT_DEMO_AFGEROND,
            EVENT_HEROPEND,
            EVENT_HANDMATIG_AFGEVALLEN,
          ]),
        ),
      )
      .groupBy(schema.journeyEvents.leadId, schema.journeyEvents.kind),
    // De verstuurde demo-PDF's (de afsluitmail ging mee als bijlage).
    db
      .select({
        id: schema.documents.id,
        leadId: schema.documents.leadId,
        sentAt: schema.documents.sentAt,
        sentTo: schema.documents.sentTo,
      })
      .from(schema.documents)
      .where(
        and(
          inArray(schema.documents.leadId, ids),
          eq(schema.documents.type, "DEMO_PDF"),
          isNotNull(schema.documents.sentAt),
        ),
      ),
  ]);

  const commerceIds = commerceRijen.map((c) => c.id);
  const [voorstellen, overeenkomsten, betalingen, termijnen] = await Promise.all([
    commerceIds.length
      ? db
          .select({
            commerceId: schema.proposals.commerceId,
            sentAt: schema.proposals.sentAt,
            acceptedAt: schema.proposals.acceptedAt,
            status: schema.proposals.status,
          })
          .from(schema.proposals)
          .where(inArray(schema.proposals.commerceId, commerceIds))
      : [],
    commerceIds.length
      ? db
          .select({
            commerceId: schema.agreements.commerceId,
            signedAt: schema.agreements.signedAt,
          })
          .from(schema.agreements)
          .where(inArray(schema.agreements.commerceId, commerceIds))
      : [],
    commerceIds.length
      ? db
          .select({
            commerceId: schema.payments.commerceId,
            type: schema.payments.type,
            status: schema.payments.status,
          })
          .from(schema.payments)
          .where(inArray(schema.payments.commerceId, commerceIds))
      : [],
    commerceIds.length
      ? db
          .select({
            commerceId: schema.paymentInstallments.commerceId,
            plan: schema.paymentInstallments.plan,
            volgnummer: schema.paymentInstallments.volgnummer,
            aantal: schema.paymentInstallments.aantal,
            status: schema.paymentInstallments.status,
            dueAt: schema.paymentInstallments.dueAt,
          })
          .from(schema.paymentInstallments)
          .where(inArray(schema.paymentInstallments.commerceId, commerceIds))
      : [],
  ]);

  const commercePerLead = new Map(commerceRijen.map((c) => [c.leadId, c]));
  const moment = (leadId: string, kind: string) => {
    const r = afsluitRijen.find((x) => x.leadId === leadId && x.kind === kind);
    return r?.laatste ? new Date(r.laatste) : null;
  };
  const contactPerLead = new Map(
    contactRijen.map((c) => [c.leadId, c.laatste ? new Date(c.laatste) : null]),
  );

  return leads.map((lead) => {
    const commerce = commercePerLead.get(lead.id) ?? null;
    const eigenVoorstellen = commerce
      ? voorstellen.filter((p) => p.commerceId === commerce.id)
      : [];
    const eigenOvereenkomsten = commerce
      ? overeenkomsten.filter((a) => a.commerceId === commerce.id)
      : [];
    const eigenBetalingen = commerce
      ? betalingen.filter((p) => p.commerceId === commerce.id)
      : [];

    const snapshot: JourneySnapshot = {
      stage: lead.stage,
      variant: lead.journeyVariant,
      commerceStatus: commerce?.status ?? null,
      demoVerstuurd: Boolean(lead.demoSentAt),
      demoLinksKlaar: Boolean(
        lead.demoDomain?.trim() && lead.demoPortalUrl?.trim(),
      ),
      heeftConcept: eigenVoorstellen.some((p) => p.status === "DRAFT"),
      voorstelVerstuurd: eigenVoorstellen.some((p) => p.sentAt),
      // De lijst toont geen "bekeken"-nuance; die staat op de detailpagina.
      voorstelBekeken: false,
      voorstelGeaccepteerd: eigenVoorstellen.some((p) => p.acceptedAt),
      overeenkomstGetekend: eigenOvereenkomsten.some((a) => a.signedAt),
      aanbetalingBetaald: eigenBetalingen.some(
        (p) => p.type === "DEPOSIT" && p.status === "PAID",
      ),
      opleveringKlaar: Boolean(commerce?.deliveryReadyAt),
      restbetalingBetaald: eigenBetalingen.some(
        (p) => p.type === "FINAL_PAYMENT" && p.status === "PAID",
      ),
      mandaatActief: Boolean(commerce?.mandateActivatedAt),
      live: Boolean(commerce?.liveAt),
      heeftAbonnement: (commerce?.monthlyCents ?? 0) > 0,
      regeling: commerce
        ? regelingStand(termijnen.filter((t) => t.commerceId === commerce.id), nu)
        : null,
    };

    const laatsteContactAt = contactPerLead.get(lead.id) ?? null;
    const demoAfgerondAt = demoAfgerondOp(lead.status, {
      demoAfgerond: moment(lead.id, EVENT_DEMO_AFGEROND),
      heropend: moment(lead.id, EVENT_HEROPEND),
      handmatigAfgevallen: moment(lead.id, EVENT_HANDMATIG_AFGEVALLEN),
    });
    // De PDF die bij déze afronding hoort: de laatst verstuurde.
    const pdf = demoAfgerondAt
      ? [...demoPdfRijen]
          .filter((d) => d.leadId === lead.id)
          .sort((x, y) => (y.sentAt?.getTime() ?? 0) - (x.sentAt?.getTime() ?? 0))[0] ?? null
      : null;

    return {
      lead,
      laatsteContactAt,
      commerce: commerce
        ? {
            maandbedragCenten: commerce.monthlyCents,
            opleveringKlaarAt: commerce.deliveryReadyAt,
            liveAt: commerce.liveAt,
          }
        : null,
      demoAfsluiting: demoAfgerondAt
        ? { afgerondOp: demoAfgerondAt, pdfId: pdf?.id ?? null, mailNaar: pdf?.sentTo ?? null }
        : null,
      afleiding: leidAf(
        {
          id: lead.id,
          stage: lead.stage,
          status: lead.status,
          demoSentAt: lead.demoSentAt,
          laatsteContactAt,
          snapshot,
          demoAfgerondAt,
        },
        nu,
      ),
    };
  });
}

/** Wie er inmiddels klant is: de eerste betaling is binnen. */
export function alleenKlanten(aanvragen: readonly Aanvraag[]): Aanvraag[] {
  return aanvragen.filter((a) => a.afleiding.klant);
}

/** Aantal aanvragen dat vandaag om een handeling vraagt. */
export function telActieNodig(aanvragen: readonly Aanvraag[]): number {
  return aanvragen.filter((a) => a.afleiding.actieNodig).length;
}
