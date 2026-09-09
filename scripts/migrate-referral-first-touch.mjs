#!/usr/bin/env node
/**
 * Voert drizzle/0002_referral_first_touch.sql uit tegen de database.
 *
 * Idempotent en veilig: uitsluitend ADD COLUMN IF NOT EXISTS, CREATE INDEX
 * IF NOT EXISTS en backfills die alleen lege velden vullen. Er wordt geen
 * kolom verwijderd of hernoemd en geen bestaande rij weggegooid.
 *
 * Gebruik:
 *   node scripts/migrate-referral-first-touch.mjs
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

/* --------------------------------------------------------------- kolommen */

await sql`ALTER TABLE referral_clicks ADD COLUMN IF NOT EXISTS referrer text`;

await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_partner_id uuid REFERENCES partners(id) ON DELETE SET NULL`;
await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_touch_partner_id uuid REFERENCES partners(id) ON DELETE SET NULL`;
await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS referral_first_seen_at timestamptz`;
await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS referral_landing_page text`;
await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS referral_referrer text`;
await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm jsonb`;
await sql`CREATE INDEX IF NOT EXISTS leads_first_touch_idx ON leads (first_touch_partner_id)`;

console.log("Kolommen en index staan klaar.");

/* --------------------------------------------------------------- backfill */

const [{ count: gekoppeld }] = await sql`
  UPDATE leads
  SET first_touch_partner_id = affiliate_partner_id,
      last_touch_partner_id  = affiliate_partner_id
  WHERE affiliate_partner_id IS NOT NULL
    AND first_touch_partner_id IS NULL
  RETURNING 1 AS count`.then((rows) => [{ count: rows.length }]);

const [{ count: uitClick }] = await sql`
  UPDATE leads l
  SET referral_first_seen_at = c.first_seen_at,
      referral_landing_page  = c.landing_page,
      utm                    = c.utm
  FROM referral_clicks c
  WHERE l.referral_click_id = c.id
    AND l.referral_first_seen_at IS NULL
  RETURNING 1 AS count`.then((rows) => [{ count: rows.length }]);

const [{ count: uitAttributie }] = await sql`
  UPDATE leads
  SET referral_first_seen_at = attributed_at
  WHERE affiliate_partner_id IS NOT NULL
    AND referral_first_seen_at IS NULL
    AND attributed_at IS NOT NULL
  RETURNING 1 AS count`.then((rows) => [{ count: rows.length }]);

console.log(`Aanrakingen ingevuld:      ${gekoppeld}`);
console.log(`Herkomst uit clickrecord:  ${uitClick}`);
console.log(`Eerste bezoek uit toekenning: ${uitAttributie}`);
console.log("Klaar. Bestaande toewijzingen en commissiecijfers zijn ongewijzigd.");
