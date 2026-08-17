import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { isHqEnabled } from "@/lib/hq/flags";
import {
  HQ_OWNER_ROLE,
  evaluateHqAccess,
  type HqAccessResult,
} from "@/lib/hq/access";

/**
 * Server-side autorisatie voor DogWare HQ.
 *
 * Bouwt voort op de bestaande sessielaag (lib/auth/session.ts) en volgt het
 * patroon van lib/admin-auth.ts: pagina's worden bewaakt door de layout, en
 * elke server action en route handler controleert daarnaast zélf opnieuw,
 * omdat die ook via een directe POST bereikbaar zijn.
 *
 * Er komt hier bewust geen tweede authenticatiesysteem bij: dezelfde cookie,
 * dezelfde sessietabel, dezelfde gebruiker. Alleen de autorisatie is strenger.
 *
 * HQ verraadt zichzelf nooit. Geen redirect naar een login, geen 403, geen
 * uitleg — onbevoegden krijgen exact dezelfde 404 als bij een adres dat niet
 * bestaat.
 */

/**
 * Staat de eigenaarrol op naam van deze gebruiker?
 *
 * Een aparte, kleine query — met opzet los van getCurrentUser(). De gewone
 * sessielaag filtert deze rol er juist uit (zie lib/auth/session.ts), zodat
 * de eigenaarrol nergens in de gewone rollenwereld kan meeliften. Alleen deze
 * functie kijkt ernaar.
 */
async function hasOwnerGrant(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: schema.userRoles.id })
    .from(schema.userRoles)
    .where(
      and(
        eq(schema.userRoles.userId, userId),
        // Bewust een SQL-fragment en geen eq(): de kolom is in TypeScript
        // getypeerd als de gewone UserRole-union, en daar hoort de
        // eigenaarrol juist níet in thuis. Een cast zou die scheiding
        // wegpoetsen; zo blijft ze zichtbaar en blijft de vergelijking
        // een gewone, geparameteriseerde query.
        sql`${schema.userRoles.role} = ${HQ_OWNER_ROLE}`,
      ),
    )
    .limit(1);
  return rows.length === 1;
}

/**
 * De volledige toegangsbeslissing, inclusief de reden. Voor intern gebruik;
 * de reden verlaat de server nooit.
 *
 * Verpakt in cache(): binnen één request beslissen de layout, de metadata en
 * de pagina alle drie zelfstandig, maar samen kosten ze één databasequery.
 */
export const checkHqAccess = cache(async function checkHqAccess(): Promise<{
  result: HqAccessResult;
  user: SessionUser | null;
}> {
  const hqEnabled = isHqEnabled();

  // Staat de vlag uit, dan lezen we bewust geen sessie meer. Er valt dan niets
  // te beslissen en niets te meten.
  if (!hqEnabled) {
    return {
      result: evaluateHqAccess({ hqEnabled, session: null, hasOwnerGrant: false }),
      user: null,
    };
  }

  let user: SessionUser | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null; // een fout in de sessielaag is een weigering, geen toegang
  }

  let eigenaar = false;
  if (user) {
    try {
      eigenaar = await hasOwnerGrant(user.id);
    } catch {
      eigenaar = false; // fail closed bij een databasefout
    }
  }

  return {
    result: evaluateHqAccess({
      hqEnabled,
      session: user ? { status: user.status, roles: user.roles } : null,
      hasOwnerGrant: eigenaar,
    }),
    user,
  };
});

/**
 * De eigenaar, of null. Voor plekken die zelf willen beslissen wat er gebeurt
 * (zoals een route handler die een kaal 404-antwoord teruggeeft).
 *
 * Spiegelt getAdminActor() uit lib/admin-auth.ts.
 */
export async function getOwnerActor(): Promise<SessionUser | null> {
  const { result, user } = await checkHqAccess();
  return result.allowed ? user : null;
}

/**
 * Verplicht eigenaarschap. Geeft de eigenaar terug, of stopt het renderen met
 * een 404 — dezelfde 404 als elk niet-bestaand adres, zodat het bestaan van HQ
 * verborgen blijft.
 */
export async function requireOwner(): Promise<SessionUser> {
  const { result, user } = await checkHqAccess();
  if (!result.allowed || !user) notFound();
  return user;
}
