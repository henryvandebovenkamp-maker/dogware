/**
 * Vervangt lib/db/index.ts tijdens tests.
 *
 * Twee redenen. Ten eerste veiligheid: een test mag NOOIT tegen een echte
 * database praten, ook niet als er toevallig een DATABASE_URL in de omgeving
 * staat (lokaal wijst die naar productie). Deze stub kijkt daar niet eens
 * naar. Ten tweede maakt hij integratietests mogelijk: een test die een
 * in-process Postgres (PGlite) opzet, hangt die aan `globalThis.__testDb` en
 * de echte DogWare-code draait er dan ongewijzigd tegenaan.
 *
 * Zonder `__testDb` geeft getDb() null — precies wat de bestaande tests
 * altijd al kregen, want die draaien zonder DATABASE_URL.
 */
import * as schema from "../lib/db/schema.ts";

export function isDbConfigured() {
  return Boolean(globalThis.__testDb);
}

export function getDb() {
  return globalThis.__testDb ?? null;
}

export { schema };
