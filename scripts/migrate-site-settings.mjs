#!/usr/bin/env node
/**
 * Eenmalige, chirurgische migratie: maakt de tabel `site_settings` aan (voor de
 * door de Super Admin instelbare e-maillogo-override). Idempotent en veilig —
 * raakt geen enkele bestaande tabel.
 *
 * Gebruik:
 *   node scripts/migrate-site-settings.mjs
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

// Alleen deze tabel; IF NOT EXISTS zodat het idempotent en veilig is.
await sql`
  CREATE TABLE IF NOT EXISTS site_settings (
    id text PRIMARY KEY DEFAULT 'singleton',
    email_logo_url text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
  )
`;
// Zorg dat de singleton-rij bestaat.
await sql`
  INSERT INTO site_settings (id) VALUES ('singleton')
  ON CONFLICT (id) DO NOTHING
`;

const rows = await sql`SELECT id, email_logo_url, updated_at FROM site_settings`;
console.log("site_settings OK:", JSON.stringify(rows));
