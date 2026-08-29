import "server-only";
import { and, desc, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Lead } from "@/lib/db/schema";
import { leidAf, type AanvraagAfleiding } from "@/lib/aanvragen";
import type { JourneySnapshot } from "@/lib/journey-next";

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

  const [commerceRijen, contactRijen] = await Promise.all([
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
  ]);

  const commerceIds = commerceRijen.map((c) => c.id);
  const [voorstellen, overeenkomsten, betalingen] = await Promise.all([
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
  ]);

  const commercePerLead = new Map(commerceRijen.map((c) => [c.leadId, c]));
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
    };

    const laatsteContactAt = contactPerLead.get(lead.id) ?? null;

    return {
      lead,
      laatsteContactAt,
      afleiding: leidAf(
        {
          id: lead.id,
          stage: lead.stage,
          status: lead.status,
          demoSentAt: lead.demoSentAt,
          laatsteContactAt,
          snapshot,
        },
        nu,
      ),
    };
  });
}

/** Aantal aanvragen dat vandaag om een handeling vraagt. */
export function telActieNodig(aanvragen: readonly Aanvraag[]): number {
  return aanvragen.filter((a) => a.afleiding.actieNodig).length;
}
