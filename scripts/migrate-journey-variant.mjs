#!/usr/bin/env node
/**
 * Voert drizzle/0003_journey_variant.sql uit tegen de database.
 *
 * Idempotent en additief: ADD COLUMN IF NOT EXISTS met DEFAULT 'demo'. Elke
 * bestaande aanvraag houdt daarmee de demo-route; er wordt geen rij van route
 * veranderd en niets verwijderd.
 *
 * Gebruik:
 *   node scripts/migrate-journey-variant.mjs
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

await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS journey_variant text NOT NULL DEFAULT 'demo'`;

const bijgewerkt = await sql`
  UPDATE leads
  SET journey_variant = 'demo'
  WHERE journey_variant IS NULL OR journey_variant NOT IN ('demo', 'direct')
  RETURNING 1`;

const telling = await sql`
  SELECT journey_variant, count(*)::int AS aantal
  FROM leads
  GROUP BY journey_variant
  ORDER BY journey_variant`;

console.log(`Kolom journey_variant staat klaar (${bijgewerkt.length} rijen rechtgezet).`);
for (const r of telling) console.log(`  ${r.journey_variant}: ${r.aantal}`);
console.log("Klaar. Bestaande aanvragen lopen ongewijzigd de demo-route.");
