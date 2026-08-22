#!/usr/bin/env node
/**
 * Migratie: de commerciële vervolgflow op de Demo Journey.
 *
 * Voegt toe:
 *   - journey_events.actor + journey_events.internal
 *   - commerce: portal_token, mandaat-/abonnementvelden, mijlpalen
 *   - payments: koppeling naar voorstel/overeenkomst + Mollie-mandaatvelden
 *   - proposals   (versiebeheer van voorstellen)
 *   - agreements  (digitale ondertekening)
 *   - documents   (facturen en vastgelegde stukken)
 *
 * Volledig idempotent en additief: geen enkele bestaande kolom wordt
 * gewijzigd, hernoemd of verwijderd, en er worden geen rijen aangeraakt.
 * Bestaande aanvragen houden hun stage — de nieuwe journey-stappen zijn
 * tussen- en achtergevoegd, niet vervangen.
 *
 * Gebruik:
 *   node scripts/migrate-commerce-journey.mjs
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

/* ---------- 1. Tijdlijn: actor + interne markering ---------- */

await sql`ALTER TABLE journey_events ADD COLUMN IF NOT EXISTS actor text NOT NULL DEFAULT 'systeem'`;
await sql`ALTER TABLE journey_events ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false`;
await sql`
  CREATE INDEX IF NOT EXISTS journey_events_public_idx
    ON journey_events (lead_id, internal, created_at)
`;

/* ---------- 2. Commerce: klantomgeving, mandaat, mijlpalen ---------- */

for (const [col, type] of [
  ["portal_token", "text"],
  ["mandate_activated_at", "timestamptz"],
  ["mollie_subscription_id", "text"],
  ["subscription_activated_at", "timestamptz"],
  ["build_started_at", "timestamptz"],
  ["delivery_ready_at", "timestamptz"],
  ["live_at", "timestamptz"],
  ["active_customer_at", "timestamptz"],
]) {
  await sql.query(`ALTER TABLE commerce ADD COLUMN IF NOT EXISTS ${col} ${type}`);
}
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS commerce_portal_token_idx
    ON commerce (portal_token)
`;

/* ---------- 3. Voorstellen (versiebeheer) ---------- */

await sql`
  CREATE TABLE IF NOT EXISTS proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id uuid NOT NULL REFERENCES commerce(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    version integer NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    titel text NOT NULL DEFAULT '',
    intro text,
    omschrijving text,
    werkzaamheden jsonb NOT NULL DEFAULT '[]'::jsonb,
    modules jsonb NOT NULL DEFAULT '[]'::jsonb,
    bijzonderheden text,
    geldig_tot timestamptz,
    pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    first_viewed_at timestamptz,
    last_viewed_at timestamptz,
    view_count integer NOT NULL DEFAULT 0,
    accepted_at timestamptz,
    accepted_name text,
    accepted_ip_hash text,
    accepted_user_agent text,
    rejected_at timestamptz,
    rejected_reason text
  )
`;
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS proposals_version_idx
    ON proposals (commerce_id, version)
`;
await sql`CREATE INDEX IF NOT EXISTS proposals_lead_idx ON proposals (lead_id, version)`;

/* ---------- 4. Overeenkomsten (digitale ondertekening) ---------- */

await sql`
  CREATE TABLE IF NOT EXISTS agreements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commerce_id uuid NOT NULL REFERENCES commerce(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,
    proposal_version integer NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    voorwaarden_versie text NOT NULL,
    pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
    viewed_at timestamptz,
    signed_at timestamptz,
    signer_name text,
    signer_role text,
    signer_email text,
    signer_phone text,
    signer_company text,
    signer_address text,
    signer_postcode text,
    signer_city text,
    signer_kvk text,
    signer_vat text,
    agrees_opdracht boolean NOT NULL DEFAULT false,
    agrees_investering boolean NOT NULL DEFAULT false,
    agrees_termijnen boolean NOT NULL DEFAULT false,
    agrees_maandbedrag boolean NOT NULL DEFAULT false,
    agrees_voorwaarden boolean NOT NULL DEFAULT false,
    agrees_bevoegd boolean NOT NULL DEFAULT false,
    signed_ip_hash text,
    signed_user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS agreements_commerce_idx ON agreements (commerce_id, created_at)`;
await sql`CREATE INDEX IF NOT EXISTS agreements_lead_idx ON agreements (lead_id)`;

/* ---------- 5. Payments: koppeling voorstel/overeenkomst + mandaat ---------- */

for (const [col, type] of [
  ["proposal_id", "uuid REFERENCES proposals(id) ON DELETE SET NULL"],
  ["agreement_id", "uuid REFERENCES agreements(id) ON DELETE SET NULL"],
  ["referentie", "text"],
  ["sequence_type", "text"],
  ["mollie_customer_id", "text"],
  ["mollie_mandate_id", "text"],
  ["failure_reason", "text"],
]) {
  await sql.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ${col} ${type}`);
}

/* ---------- 6. Documenten ---------- */

await sql`
  CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    commerce_id uuid NOT NULL REFERENCES commerce(id) ON DELETE CASCADE,
    type text NOT NULL,
    nummer text NOT NULL,
    titel text NOT NULL,
    proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
    agreement_id uuid REFERENCES agreements(id) ON DELETE SET NULL,
    payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
    net_ex_vat_cents integer NOT NULL DEFAULT 0,
    vat_cents integer NOT NULL DEFAULT 0,
    total_incl_vat_cents integer NOT NULL DEFAULT 0,
    vat_percent integer NOT NULL DEFAULT 21,
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    visible_to_customer boolean NOT NULL DEFAULT true,
    issued_at timestamptz NOT NULL DEFAULT now()
  )
`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS documents_nummer_idx ON documents (nummer)`;
await sql`CREATE INDEX IF NOT EXISTS documents_lead_idx ON documents (lead_id, issued_at)`;
await sql`CREATE INDEX IF NOT EXISTS documents_commerce_idx ON documents (commerce_id, type)`;

/* ---------- Controle ---------- */

const tables = await sql`
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN ('proposals','agreements','documents')
   ORDER BY 1
`;
const cols = await sql`
  SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name = 'commerce' AND column_name = 'portal_token')
       OR (table_name = 'journey_events' AND column_name IN ('actor','internal'))
       OR (table_name = 'payments' AND column_name IN ('proposal_id','agreement_id','sequence_type')))
   ORDER BY 1, 2
`;
console.log("tabellen OK:", tables.map((t) => t.table_name).join(", "));
console.log(
  "kolommen OK:",
  cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "),
);
