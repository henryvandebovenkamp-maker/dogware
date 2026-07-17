import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Partner, PartnerStatus } from "@/lib/db/schema";
import { signValue, verifySignedValue } from "@/lib/auth/crypto";

/**
 * Referral-attributie voor het DogWare Partnerprogramma.
 *
 * Model: LAST_VALID_REFERRAL — de laatste geldige partnerlink binnen de
 * attributieperiode krijgt de aanvraag. Centraal en configureerbaar,
 * zodat andere modellen later mogelijk zijn.
 */

export const ATTRIBUTION_DAYS = Number(process.env.ATTRIBUTION_DAYS ?? 30);
export const ATTRIBUTION_MODEL = "LAST_VALID_REFERRAL" as const;

/**
 * Statussen waarbij een partnerlink "leeft": bezoek registreren, welkom tonen
 * én attribueren. Een net uitgenodigde partner (INVITED) telt mee — de link
 * hoort meteen te werken. PAUSED/BLOCKED/ENDED (gepauzeerd/geblokkeerd/
 * beëindigd) doen bewust niets: geen attributie, geen korting, geen commissie.
 */
const REFERRAL_ACTIVE_STATUSES: PartnerStatus[] = ["ACTIVE", "INVITED"];

export function partnerCanRefer(status: PartnerStatus): boolean {
  return REFERRAL_ACTIVE_STATUSES.includes(status);
}

const REF_COOKIE = "dw_ref";
const VISITOR_COOKIE = "dw_vid";
/** Zelfde bezoeker + partner binnen dit venster = geen nieuw clickrecord */
const CLICK_DEDUPE_MINUTES = 30;

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

/** Normaliseer invoer: niet hoofdlettergevoelig, alleen veilige tekens. */
export function normalizeReferralCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,38}[A-Z0-9]$/.test(code)) return null;
  return code;
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

/* ---------- Click-registratie ---------- */

type ClickContext = {
  landingPage: string;
  userAgent: string | null;
  searchParams?: URLSearchParams;
};

/**
 * Registreer een geldig referralbezoek en zet de attributiecookies.
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
    maxAge: 365 * 86400,
  });

  const ua = (ctx.userAgent ?? "").slice(0, 120) || null;
  const isBot = ua ? BOT_UA.test(ua) : false;

  const utm: Record<string, string> = {};
  ctx.searchParams?.forEach((v, k) => {
    if (k.startsWith("utm_")) utm[k] = v.slice(0, 120);
  });

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
        landingPage: ctx.landingPage.slice(0, 300),
        utm: Object.keys(utm).length ? utm : null,
        userAgent: ua,
        isBot,
      })
      .returning({ id: schema.referralClicks.id });
    clickId = click.id;
  }

  // Attributiecookie: ondertekend, alleen server-side te lezen — bots niet
  if (!isBot) {
    const payload = JSON.stringify({
      p: partner.id,
      c: partner.referralCode,
      k: clickId,
      t: Date.now(),
    });
    jar.set(REF_COOKIE, signValue(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ATTRIBUTION_DAYS * 86400,
    });
  }

  return clickId;
}

/* ---------- Attributie bij conversie ---------- */

export type Attribution = {
  partnerId: string;
  referralCode: string;
  clickId: string | null;
};

/**
 * Lees de attributie voor een conversie. Alles wordt server-side
 * geverifieerd: handtekening, vervaltijd én actuele partnerstatus.
 * PAUSED/BLOCKED/ENDED partners krijgen geen nieuwe attributie.
 */
export async function getValidAttribution(): Promise<Attribution | null> {
  const jar = await cookies();
  const raw = jar.get(REF_COOKIE)?.value;
  if (!raw) return null;

  const payload = verifySignedValue(raw);
  if (!payload) return null;

  try {
    const { p, c, k, t } = JSON.parse(payload) as {
      p: string;
      c: string;
      k?: string;
      t: number;
    };
    if (Date.now() - t > ATTRIBUTION_DAYS * 86400_000) return null;

    const db = getDb();
    if (!db) return null;
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, p))
      .limit(1);
    if (!partner || !partnerCanRefer(partner.status)) return null;

    return { partnerId: partner.id, referralCode: c, clickId: k ?? null };
  } catch {
    return null;
  }
}
