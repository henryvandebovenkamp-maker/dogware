#!/usr/bin/env node
/**
 * Voert drizzle/0007_aanvullende_opdrachten.sql uit tegen de database.
 *
 * Idempotent en additief: alleen CREATE TABLE/INDEX IF NOT EXISTS en ADD
 * COLUMN IF NOT EXISTS. Er wordt niets gewijzigd of verwijderd en geen
 * bestaande rij aangeraakt.
 *
 * LET OP: zonder DATABASE_URL in de omgeving leest dit script .env.local, en
 * die wijst lokaal naar productie. Draai het eerst tegen een Neon-branch.
 *
 * Gebruik:
 *   node scripts/migrate-aanvullende-opdrachten.mjs            # uitvoeren
 *   node scripts/migrate-aanvullende-opdrachten.mjs --droog    # alleen tonen wat er staat
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
    SELECT to_regclass('public.extra_orders') IS NOT NULL AS opdrachten,
           to_regclass('public.extra_order_versions') IS NOT NULL AS versies,
           EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payments' AND column_name = 'extra_order_id') AS betalingen
  `;
  return `extra_orders: ${r.opdrachten} · extra_order_versions: ${r.versies} · payments.extra_order_id: ${r.betalingen}`;
};

if (droog) {
  console.log(await stand());
  process.exit(0);
}

const bron = readFileSync(new URL("../drizzle/0007_aanvullende_opdrachten.sql", import.meta.url), "utf8");
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
