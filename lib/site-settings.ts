import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { absoluteUrl, branding } from "@/lib/branding";

/**
 * Runtime-instellingen die de Super Admin beheert (tabel `site_settings`).
 * Alles degradeert netjes: zonder DB of bij een fout valt elke waarde terug op
 * de statische defaults uit lib/branding.ts.
 */

const SINGLETON = "singleton";

// Korte in-memory cache zodat niet elke mail een DB-query doet. Een wijziging
// via de Super Admin is binnen ~30s zichtbaar.
let cache: { url: string; at: number } | null = null;
const TTL_MS = 30_000;

/** De statische default (het meegeleverde e-maillogo als absolute URL). */
export function defaultEmailLogoUrl(): string {
  return absoluteUrl(branding.logo.email);
}

/**
 * De actuele logo-URL voor e-mails: de door de Super Admin geüploade override,
 * of anders de default. Nooit throwen — mail mag hier niet op stuklopen.
 */
export async function getEmailLogoUrl(): Promise<string> {
  const fallback = defaultEmailLogoUrl();
  if (cache && Date.now() - cache.at < TTL_MS) return cache.url;

  const db = getDb();
  if (!db) return fallback;
  try {
    const [row] = await db
      .select({ url: schema.siteSettings.emailLogoUrl })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.id, SINGLETON))
      .limit(1);
    const url = row?.url?.trim() || fallback;
    cache = { url, at: Date.now() };
    return url;
  } catch {
    return fallback;
  }
}

/** Cache legen na een wijziging, zodat de nieuwe waarde direct geldt. */
export function clearEmailLogoCache(): void {
  cache = null;
}

/**
 * Voor de beheerpagina: de actuele logo-URL én of het een eigen override is
 * (i.p.v. de default). Leest ongecachet zodat de UI direct klopt na opslaan.
 */
export async function getEmailLogoSetting(): Promise<{
  effectiveUrl: string;
  isOverride: boolean;
}> {
  const fallback = defaultEmailLogoUrl();
  const db = getDb();
  if (!db) return { effectiveUrl: fallback, isOverride: false };
  try {
    const [row] = await db
      .select({ url: schema.siteSettings.emailLogoUrl })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.id, SINGLETON))
      .limit(1);
    const override = row?.url?.trim() || null;
    return { effectiveUrl: override ?? fallback, isOverride: Boolean(override) };
  } catch {
    return { effectiveUrl: fallback, isOverride: false };
  }
}
