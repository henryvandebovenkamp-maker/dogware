#!/usr/bin/env node
/**
 * Maakt de tabellen voor de Groei-omgeving aan.
 *
 * Idempotent en chirurgisch: raakt geen enkele bestaande tabel en kan zonder
 * risico opnieuw gedraaid worden.
 *
 * Gebruik:
 *   node scripts/migrate-groei.mjs
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const regel of readFileSync(".env.local", "utf8").split("\n")) {
  const m = regel.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ontbreekt.");
  process.exit(1);
}

const sql = neon(url);

const STAPPEN = [
  "CREATE TABLE IF NOT EXISTS groei_prospects (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,\
    bedrijfsnaam text NOT NULL,\
    branche text,\
    plaats text,\
    website text,\
    email text,\
    telefoon text,\
    contactpersoon text,\
    voornaam text,\
    logo_url text,\
    socials jsonb NOT NULL DEFAULT '{}'::jsonb,\
    google_rating text,\
    google_reviews integer,\
    herkomst jsonb NOT NULL DEFAULT '{}'::jsonb,\
    grondslag text NOT NULL DEFAULT 'onbekend',\
    stap text NOT NULL DEFAULT 'gevonden',\
    notities text,\
    created_at timestamptz NOT NULL DEFAULT now(),\
    updated_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE INDEX IF NOT EXISTS groei_prospects_owner_idx ON groei_prospects (owner_user_id, stap)",
  "CREATE INDEX IF NOT EXISTS groei_prospects_created_idx ON groei_prospects (created_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS groei_prospects_website_idx ON groei_prospects (owner_user_id, website)",

  "CREATE TABLE IF NOT EXISTS groei_analyses (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    prospect_id uuid NOT NULL REFERENCES groei_prospects(id) ON DELETE CASCADE,\
    sterk jsonb NOT NULL DEFAULT '[]'::jsonb,\
    kansen jsonb NOT NULL DEFAULT '[]'::jsonb,\
    details jsonb NOT NULL DEFAULT '[]'::jsonb,\
    past boolean NOT NULL DEFAULT true,\
    passendheid_uitleg text,\
    model text,\
    created_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE INDEX IF NOT EXISTS groei_analyses_prospect_idx ON groei_analyses (prospect_id, created_at)",

  "CREATE TABLE IF NOT EXISTS groei_voorstellen (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    prospect_id uuid NOT NULL REFERENCES groei_prospects(id) ON DELETE CASCADE,\
    token text NOT NULL,\
    titel text NOT NULL,\
    intro text NOT NULL,\
    secties jsonb NOT NULL DEFAULT '[]'::jsonb,\
    accent_kleur text,\
    geopend_at timestamptz,\
    aantal_keer_geopend integer NOT NULL DEFAULT 0,\
    laatst_geopend_at timestamptz,\
    created_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE UNIQUE INDEX IF NOT EXISTS groei_voorstellen_token_idx ON groei_voorstellen (token)",
  "CREATE INDEX IF NOT EXISTS groei_voorstellen_prospect_idx ON groei_voorstellen (prospect_id)",

  "CREATE TABLE IF NOT EXISTS groei_berichten (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    prospect_id uuid NOT NULL REFERENCES groei_prospects(id) ON DELETE CASCADE,\
    voorstel_id uuid REFERENCES groei_voorstellen(id) ON DELETE SET NULL,\
    onderwerp text NOT NULL,\
    tekst text NOT NULL,\
    verstuurd_at timestamptz,\
    bewerkt_door_henry boolean NOT NULL DEFAULT false,\
    model text,\
    created_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE INDEX IF NOT EXISTS groei_berichten_prospect_idx ON groei_berichten (prospect_id, created_at)",

  "CREATE TABLE IF NOT EXISTS groei_events (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    prospect_id uuid NOT NULL REFERENCES groei_prospects(id) ON DELETE CASCADE,\
    kind text NOT NULL,\
    label text NOT NULL,\
    meta jsonb,\
    created_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE INDEX IF NOT EXISTS groei_events_prospect_idx ON groei_events (prospect_id, created_at)",

  "CREATE TABLE IF NOT EXISTS groei_blokkeerlijst (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    email text,\
    domein text,\
    reden text,\
    created_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE UNIQUE INDEX IF NOT EXISTS groei_blokkeerlijst_email_idx ON groei_blokkeerlijst (email)",
  "CREATE INDEX IF NOT EXISTS groei_blokkeerlijst_domein_idx ON groei_blokkeerlijst (domein)",

  "CREATE TABLE IF NOT EXISTS groei_ideeen (\
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,\
    branche text,\
    soort text NOT NULL,\
    tekst text NOT NULL,\
    raak_score integer NOT NULL DEFAULT 0,\
    gebruikt integer NOT NULL DEFAULT 0,\
    created_at timestamptz NOT NULL DEFAULT now()\
  )",
  "CREATE INDEX IF NOT EXISTS groei_ideeen_owner_idx ON groei_ideeen (owner_user_id, branche, soort)",
];

// neon() is een tagged template; losse DDL gaat via sql.query().
let gedaan = 0;
for (const stap of STAPPEN) {
  await sql.query(stap);
  gedaan++;
}

const tabellen = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_name like 'groei_%'
  order by table_name
`;

console.log(`${gedaan} statements uitgevoerd.`);
console.log("Groei-tabellen aanwezig:");
for (const t of tabellen) console.log(`  ${t.table_name}`);
