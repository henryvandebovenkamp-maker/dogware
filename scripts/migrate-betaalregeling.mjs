#!/usr/bin/env node
/**
 * Voert drizzle/0004_betaalregeling.sql uit tegen de database.
 *
 * Idempotent en additief: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT
 * EXISTS en CREATE INDEX IF NOT EXISTS. Bestaande afspraken krijgen via de
 * DEFAULT de 50/50-regeling die ze al hadden; er wordt niets herberekend,
 * niets verwijderd en voor bestaande overeenkomsten geen schema aangemaakt.
 *
 * Gebruik:
 *   node scripts/migrate-betaalregeling.mjs            # uitvoeren
 *   node scripts/migrate-betaalregeling.mjs --droog    # alleen tonen wat er staat
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

const bestaat = async () =>
  (
    await sql`SELECT to_regclass('public.payment_installments') IS NOT NULL AS er`
  )[0].er;

if (droog) {
  console.log(`payment_installments bestaat: ${await bestaat()}`);
  const kolommen = await sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'commerce' AND column_name LIKE ANY (ARRAY['payment_plan', 'installment%'])`;
  console.log(`commerce-kolommen: ${kolommen.map((k) => k.column_name).join(", ") || "(nog geen)"}`);
  process.exit(0);
}

/*
 * Dezelfde statements als in drizzle/0004_betaalregeling.sql. Eén voor één,
 * omdat de Neon-driver per aanroep één statement uitvoert.
 */
const bron = readFileSync(new URL("../drizzle/0004_betaalregeling.sql", import.meta.url), "utf8");
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

const telling = await sql`
  SELECT payment_plan, count(*)::int AS aantal
    FROM commerce
   GROUP BY payment_plan
   ORDER BY payment_plan`;
const schemas = await sql`SELECT count(*)::int AS aantal FROM payment_installments`;

console.log(`Migratie uitgevoerd (${statements.length} statements).`);
for (const r of telling) console.log(`  ${r.payment_plan}: ${r.aantal} afspraak/afspraken`);
console.log(`Termijnen in het betaalschema: ${schemas[0].aantal} (bestaande klanten krijgen er geen).`);
