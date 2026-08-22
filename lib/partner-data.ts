import "server-only";
import { and, count, countDistinct, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { LeadStatus, Partner } from "@/lib/db/schema";
import { stageIndex } from "@/lib/journey-stages";

/**
 * Datatoegang voor het partnerportaal.
 * Alles is strikt beperkt tot de eigen partner (server-side, geen IDOR):
 * queries filteren altijd op het partner-ID van de ingelogde gebruiker.
 */

export async function getPartnerForUser(userId: string): Promise<Partner | null> {
  const db = getDb();
  if (!db) return null;
  const [partner] = await db
    .select()
    .from(schema.partners)
    .where(eq(schema.partners.userId, userId))
    .limit(1);
  return partner ?? null;
}

export async function getPartnerStats(partnerId: string) {
  const db = getDb();
  if (!db) return { clicks: 0, uniek: 0, aanvragen: 0, conversie: 0 };

  const [[clickRow], [leadRow]] = await Promise.all([
    db
      .select({
        clicks: count(),
        uniek: countDistinct(schema.referralClicks.visitorId),
      })
      .from(schema.referralClicks)
      .where(
        and(
          eq(schema.referralClicks.partnerId, partnerId),
          eq(schema.referralClicks.isBot, false),
          eq(schema.referralClicks.isInternal, false),
        ),
      ),
    db
      .select({ aanvragen: count() })
      .from(schema.leads)
      .where(eq(schema.leads.affiliatePartnerId, partnerId)),
  ]);

  const uniek = Number(clickRow.uniek);
  const aanvragen = leadRow.aanvragen;
  return {
    clicks: clickRow.clicks,
    uniek,
    aanvragen,
    conversie: uniek > 0 ? Math.round((aanvragen / uniek) * 100) : 0,
  };
}

/** Partner-vriendelijke weergave van leadstatussen — geen interne details. */
export const PARTNER_STATUS_LABELS: Record<LeadStatus, string> = {
  nieuw: "Demo aangevraagd",
  "demo in de maak": "Demo in de maak",
  "demo verstuurd": "Demo verstuurd",
  "contact gehad": "Contact gehad",
  "klant geworden": "Klant geworden",
  afgevallen: "Niet doorgegaan",
};

/** Beperkte lijst van eigen aanvragen — geen persoonsgegevens van de aanvrager. */
export async function getPartnerLeads(partnerId: string) {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.leads.id,
      createdAt: schema.leads.createdAt,
      bedrijfsnaam: schema.leads.bedrijfsnaam,
      plaats: schema.leads.plaats,
      status: schema.leads.status,
      stage: schema.leads.stage,
      referralCodeSnapshot: schema.leads.referralCodeSnapshot,
      // Alleen de PUBLIEKE voorbeeldwebsite + verzenddatum — nooit de
      // portaal-/loginlink of persoonsgegevens van de aanvrager.
      demoUrl: schema.leads.demoDomain,
      demoSentAt: schema.leads.demoSentAt,
    })
    .from(schema.leads)
    .where(eq(schema.leads.affiliatePartnerId, partnerId))
    .orderBy(desc(schema.leads.createdAt));
  return rows;
}

/**
 * Commissie-overzicht — volledig server-side berekend.
 *
 * De drie bakken worden bepaald met de PLAATS van de stage in de journey, niet
 * met een opsomming van losse stages. Dat is bewust: bij een opsomming valt een
 * aanvraag stilzwijkend uit alle tellers zodra hij een stage bereikt die
 * niemand in het lijstje heeft gezet, en dan ziet de partner zijn aanbreng
 * verdwijnen precies op het moment dat die vooruitgaat.
 *
 * In behandeling — vanaf de demo-afspraak tot het voorstel verstuurd is.
 * Gereserveerd  — klant akkoord, overeenkomst en eerste termijn.
 * Verkocht      — vanaf de bouwfase; hier is de commissie verdiend.
 *
 * Handmatig op "afgevallen" gezet telt nergens meer mee, ongeacht hoe ver de
 * stage stond toen het afketste.
 */
export async function getPartnerCommission(
  partnerId: string,
  commissionCents: number,
) {
  const db = getDb();
  if (!db) {
    return { verkocht: 0, verdiendCents: 0, gereserveerd: 0, inBehandeling: 0 };
  }
  const rows = await db
    .select({ stage: schema.leads.stage, status: schema.leads.status })
    .from(schema.leads)
    .where(eq(schema.leads.affiliatePartnerId, partnerId));

  const VANAF_BEHANDELING = stageIndex("afspraak");
  const VANAF_GERESERVEERD = stageIndex("akkoord");
  const VANAF_VERKOCHT = stageIndex("gestart");

  let verkocht = 0;
  let gereserveerd = 0;
  let inBehandeling = 0;
  for (const r of rows) {
    if (r.status === "afgevallen") continue;
    const i = stageIndex(r.stage);
    if (i >= VANAF_VERKOCHT) verkocht += 1;
    else if (i >= VANAF_GERESERVEERD) gereserveerd += 1;
    else if (i >= VANAF_BEHANDELING) inBehandeling += 1;
  }
  return {
    verkocht,
    verdiendCents: verkocht * commissionCents,
    gereserveerd,
    inBehandeling,
  };
}

/** Bedrag in centen als nette euro-tekst. */
export function euro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
