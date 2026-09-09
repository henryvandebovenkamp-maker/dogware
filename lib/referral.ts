import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Partner, Utm } from "@/lib/db/schema";
import { signValue, verifySignedValue } from "@/lib/auth/crypto";
import {
  ATTRIBUTION_MODEL,
  CLICK_DEDUPE_MINUTES,
  REFERRAL_WINDOW_DAYS,
  REF_COOKIE,
  VISITOR_COOKIE,
  VISITOR_COOKIE_DAYS,
} from "@/lib/referral-config";
import {
  kenToe,
  mergeTouch,
  normalizeReferralCode,
  parseReferralCookie,
  partnerCanRefer,
  resterendeSeconden,
  schoneLandingspagina,
  schoneUtm,
  schoneVerwijzer,
  vensterOpen,
  type ReferralCookie,
} from "@/lib/referral-attributie";

/**
 * Referral-attributie voor het DogWare Partnerprogramma.
 *
 * Model: FIRST_TOUCH — de partner die de bezoeker binnenbracht houdt de
 * aanvraag, ook wanneer die bezoeker weken later rechtstreeks terugkomt. Een
 * tweede partnerlink neemt de aanbreng niet stilletjes over; die wordt als
 * last touch bewaard. Alleen wanneer de eerste partner niet meer mag
 * attribueren (gepauzeerd, geblokkeerd, beëindigd) valt de aanvraag terug op
 * een geldige latere partner.
 *
 * De cookie onthoudt niets méér dan id's, codes en tijdstippen; alles wordt
 * server-side opnieuw geverifieerd. Zodra er een aanvraag ligt, is de
 * databaserij de bron van waarheid en doet de cookie er niet meer toe.
 */

export { ATTRIBUTION_MODEL, REFERRAL_WINDOW_DAYS };
/**
 * Vormcontrole van een code en de vraag of een partner nog mag attribueren.
 * Beide puur en getest in lib/referral-attributie.ts; hier alleen doorgegeven
 * zodat aanroepers één plek hoeven te kennen.
 */
export { normalizeReferralCode, partnerCanRefer };

const BOT_UA =
  /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|twitterbot|pinterest|vercel-screenshot|lighthouse|headless/i;

/* ---------- Referralcodes ---------- */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // zonder 0/O/1/I/L

/** Genereer een onvoorspelbare, schone code (bijv. A7K4P2X9). Opgeslagen in hoofdletters. */
export function generateReferralCode(): string {
  const bytes = randomBytes(9);
  let code = "";
  for (let i = 0; i < 9; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

/** De persoonlijke uitnodigingslink van een partner: dogware.nl/demo?ref=... */
export function referralLinkFor(code: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dogware.nl";
  return `${base}/demo?ref=${code.toLowerCase()}`;
}

/** Zoek een partner op referralcode (server-side validatie). */
export async function findPartnerByCode(raw: string): Promise<Partner | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  const db = getDb();
  if (!db) return null;
  const [partner] = await db
    .select()
    .from(schema.partners)
    .where(eq(schema.partners.referralCode, code))
    .limit(1);
  return partner ?? null;
}

/* ---------- Cookie lezen en schrijven ---------- */

/** Lees en verifieer de attributiecookie. Geen geldige cookie = null. */
async function leesCookie(): Promise<ReferralCookie | null> {
  const jar = await cookies();
  const raw = jar.get(REF_COOKIE)?.value;
  if (!raw) return null;
  const payload = verifySignedValue(raw);
  if (!payload) return null;
  return parseReferralCookie(payload);
}

/* ---------- Click-registratie ---------- */

type ClickContext = {
  /** Het pad waarop de bezoeker daadwerkelijk binnenkwam (bijv. /hondenschool) */
  landingPage: string | null;
  userAgent: string | null;
  /** De Referer-header van het binnenkomende verzoek */
  referrer?: string | null;
  searchParams?: URLSearchParams;
};

/**
 * Registreer een geldig referralbezoek en werk de attributiecookies bij.
 * Retourneert het clickId (bestaand bij dedupe, nieuw anders), of null
 * wanneer registratie niet mogelijk/zinvol is.
 */
export async function recordReferralVisit(
  partner: Partner,
  ctx: ClickContext,
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!visitorId || !/^[a-f0-9-]{36}$/.test(visitorId)) {
    visitorId = randomUUID();
  }
  jar.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_COOKIE_DAYS * 86400,
  });

  const ua = (ctx.userAgent ?? "").slice(0, 120) || null;
  const isBot = ua ? BOT_UA.test(ua) : false;

  const utm = schoneUtm(ctx.searchParams);
  const referrer = schoneVerwijzer(ctx.referrer);
  // Zonder bruikbaar pad noteren we waar de bezoeker feitelijk langskwam.
  const landingPage =
    schoneLandingspagina(ctx.landingPage) ?? `/p/${partner.referralCode}`;

  // Dedupe: zelfde bezoeker + partner binnen het venster → lastSeen bijwerken
  const since = new Date(Date.now() - CLICK_DEDUPE_MINUTES * 60_000);
  const [existing] = await db
    .select()
    .from(schema.referralClicks)
    .where(
      and(
        eq(schema.referralClicks.visitorId, visitorId),
        eq(schema.referralClicks.partnerId, partner.id),
        gt(schema.referralClicks.lastSeenAt, since),
      ),
    )
    .limit(1);

  let clickId: string;
  if (existing) {
    await db
      .update(schema.referralClicks)
      .set({ lastSeenAt: new Date() })
      .where(eq(schema.referralClicks.id, existing.id));
    clickId = existing.id;
  } else {
    const [click] = await db
      .insert(schema.referralClicks)
      .values({
        partnerId: partner.id,
        referralCode: partner.referralCode,
        visitorId,
        landingPage,
        referrer,
        utm,
        userAgent: ua,
        isBot,
      })
      .returning({ id: schema.referralClicks.id });
    clickId = click.id;
  }

  /*
   * Attributiecookie: ondertekend, alleen server-side te lezen — bots niet.
   *
   * De eerste aanraking blijft staan; deze click wordt de last touch. De
   * levensduur is verankerd aan die eerste aanraking, zodat een herhaald
   * bezoek het venster niet stilletjes verlengt.
   */
  if (!isBot) {
    const nu = Date.now();
    const cookie = mergeTouch(await leesCookie(), {
      partnerId: partner.id,
      referralCode: partner.referralCode,
      clickId,
      at: nu,
    });
    jar.set(REF_COOKIE, signValue(JSON.stringify(cookie)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: resterendeSeconden(cookie, nu),
    });
  }

  return clickId;
}

/* ---------- Attributie bij conversie ---------- */

export type AttributionTouch = {
  partnerId: string;
  referralCode: string;
  clickId: string | null;
  at: Date;
};

export type Attribution = {
  /** De partner die de commissie toekomt. */
  partnerId: string;
  referralCode: string;
  /** De click waaruit deze attributie volgt (van de toegekende aanraking). */
  clickId: string | null;
  /** FIRST_TOUCH normaal; LAST_VALID_REFERRAL als de eerste partner afviel. */
  model: "FIRST_TOUCH" | "LAST_VALID_REFERRAL";
  /** Beide aanrakingen, ook als een van de partners inmiddels niet meer mag. */
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
  /** Alleen ingevuld als de partnerrij nog bestaat (voor de foreign key). */
  firstTouchPartnerId: string | null;
  lastTouchPartnerId: string | null;
};

/**
 * Lees de attributie voor een conversie. Alles wordt server-side
 * geverifieerd: handtekening, vervaltijd én de actuele partnerstatus.
 *
 * First touch wint. Mag die partner niet meer attribueren, dan schuift de
 * aanvraag door naar de laatste geldige partnerlink — en anders naar niemand.
 * Zo levert een geblokkeerde partner nooit een stille commissie op, en
 * verdwijnt een aanvraag ook niet zonder herkomst wanneer er wél een geldige
 * latere aanbrenger is.
 */
export async function getValidAttribution(): Promise<Attribution | null> {
  const cookie = await leesCookie();
  if (!cookie) return null;
  if (!vensterOpen(cookie, Date.now())) return null;

  const db = getDb();
  if (!db) return null;

  const ids = cookie.p === cookie.lp ? [cookie.p] : [cookie.p, cookie.lp];
  const rijen = await db
    .select({
      id: schema.partners.id,
      status: schema.partners.status,
      referralCode: schema.partners.referralCode,
    })
    .from(schema.partners)
    .where(inArray(schema.partners.id, ids));
  const perId = new Map(rijen.map((r) => [r.id, r]));

  const firstTouch: AttributionTouch = {
    partnerId: cookie.p,
    referralCode: cookie.c,
    clickId: cookie.k,
    at: new Date(cookie.t),
  };
  const lastTouch: AttributionTouch = {
    partnerId: cookie.lp,
    referralCode: cookie.lc,
    clickId: cookie.lk,
    at: new Date(cookie.lt),
  };

  // De beslissing zelf is puur en apart getest; hier wordt alleen de
  // werkelijkheid uit de database ernaast gelegd.
  const toekenning = kenToe(cookie, perId);
  if (!toekenning) return null;

  return {
    ...toekenning,
    firstTouch,
    lastTouch,
    // Alleen invullen wanneer de partnerrij echt bestaat — het is een
    // foreign key, geen aantekening.
    firstTouchPartnerId: perId.has(cookie.p) ? cookie.p : null,
    lastTouchPartnerId: perId.has(cookie.lp) ? cookie.lp : null,
  };
}

/* ---------- Herkomst vastleggen bij de aanvraag ---------- */

/**
 * De marketingherkomst van de eerste aanraking: landingspagina, verwijzer en
 * UTM. Bewust apart gehouden van de partnerkoppeling — het ene bepaalt de
 * commissie, het andere vertelt alleen langs welke campagne iemand kwam.
 *
 * We halen die gegevens uit het clickrecord en niet uit de cookie: zo staat er
 * nooit meer in de browser dan nodig, en blijft de database de bron.
 */
export type ReferralHerkomst = {
  landingPage: string | null;
  referrer: string | null;
  utm: Utm | null;
  firstSeenAt: Date | null;
};

export async function getReferralHerkomst(
  attribution: Attribution,
): Promise<ReferralHerkomst> {
  const leeg: ReferralHerkomst = {
    landingPage: null,
    referrer: null,
    utm: null,
    firstSeenAt: attribution.firstTouch.at,
  };
  const clickId = attribution.firstTouch.clickId;
  const db = getDb();
  if (!clickId || !db) return leeg;

  const [click] = await db
    .select({
      landingPage: schema.referralClicks.landingPage,
      referrer: schema.referralClicks.referrer,
      utm: schema.referralClicks.utm,
      firstSeenAt: schema.referralClicks.firstSeenAt,
    })
    .from(schema.referralClicks)
    .where(eq(schema.referralClicks.id, clickId))
    .limit(1);
  if (!click) return leeg;

  return {
    landingPage: click.landingPage,
    referrer: click.referrer,
    utm: click.utm,
    firstSeenAt: click.firstSeenAt,
  };
}
