#!/usr/bin/env node
/**
 * Voert drizzle/0006_partner_uitbetalingen.sql uit tegen de database.
 *
 * Idempotent en additief: alleen CREATE TABLE/INDEX IF NOT EXISTS. Er wordt
 * niets gewijzigd of verwijderd en geen bestaande rij aangeraakt.
 *
 * Gebruik:
 *   node scripts/migrate-partner-uitbetalingen.mjs            # uitvoeren
 *   node scripts/migrate-partner-uitbetalingen.mjs --droog    # alleen tonen wat er staat
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const match = env.match(/^DATABASE_URL=["']?([^"'\n]+)["']?/m);
    if (match) databaseUrl = match[1];
  } catch {
    /* geen .env.local */
  }
}
if (!databaseUrl) {
  console.error("DATABASE_URL niet gevonden (env of .env.local).");
  process.exit(1);
}

const sql = neon(databaseUrl);
const droog = process.argv.includes("--droog");

const stand = async () => {
  const [r] = await sql`
    SELECT to_regclass('public.partner_commissions') IS NOT NULL AS commissies,
           to_regclass('public.email_changes') IS NOT NULL AS email_wijzigingen
  `;
  return `partner_commissions bestaat: ${r.commissies} · email_changes bestaat: ${r.email_wijzigingen}`;
};

if (droog) {
  console.log(await stand());
  process.exit(0);
}

const bron = readFileSync(new URL("../drizzle/0006_partner_uitbetalingen.sql", import.meta.url), "utf8");
const statements = bron
  .split("\n")
  .filter((r) => !r.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Migratie uitgevoerd (${statements.length} statement${statements.length === 1 ? "" : "s"}).`);
console.log(await stand());
