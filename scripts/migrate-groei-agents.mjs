#!/usr/bin/env node
/**
 * Tabellen voor de Groei-agents en de bronvelden op prospects.
 * Idempotent: kan zonder risico opnieuw gedraaid worden.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const r of readFileSync(".env.local", "utf8").split("\n")) {
  const m = r.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

const STAPPEN = [
  `CREATE TABLE IF NOT EXISTS groei_agents (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     naam text NOT NULL,
     soort text NOT NULL DEFAULT 'ontdekken',
     branche text,
     provincies jsonb NOT NULL DEFAULT '[]'::jsonb,
     max_per_run integer NOT NULL DEFAULT 25,
     actief boolean NOT NULL DEFAULT true,
     laatste_run_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS groei_agents_owner_idx ON groei_agents (owner_user_id, actief)`,

  `CREATE TABLE IF NOT EXISTS groei_agent_runs (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     agent_id uuid NOT NULL REFERENCES groei_agents(id) ON DELETE CASCADE,
     status text NOT NULL DEFAULT 'bezig',
     gestart_at timestamptz NOT NULL DEFAULT now(),
     klaar_at timestamptz,
     gevonden integer NOT NULL DEFAULT 0,
     nieuw integer NOT NULL DEFAULT 0,
     overgeslagen integer NOT NULL DEFAULT 0,
     samenvatting text,
     fout text
   )`,
  `CREATE INDEX IF NOT EXISTS groei_agent_runs_agent_idx ON groei_agent_runs (agent_id, gestart_at)`,

  `ALTER TABLE groei_prospects ADD COLUMN IF NOT EXISTS bron text NOT NULL DEFAULT 'handmatig'`,
  `ALTER TABLE groei_prospects ADD COLUMN IF NOT EXISTS bron_id text`,
  `ALTER TABLE groei_prospects ADD COLUMN IF NOT EXISTS gevonden_door_agent_id uuid`,
  // Deduplicatie tussen runs: dezelfde OSM-vermelding kan nooit twee keer landen.
  `CREATE UNIQUE INDEX IF NOT EXISTS groei_prospects_bron_idx
     ON groei_prospects (owner_user_id, bron, bron_id) WHERE bron_id IS NOT NULL`,
];

let n = 0;
for (const s of STAPPEN) { await sql.query(s); n++; }
const t = await sql`select table_name from information_schema.tables
  where table_schema='public' and table_name in ('groei_agents','groei_agent_runs') order by 1`;
const c = await sql`select column_name from information_schema.columns
  where table_name='groei_prospects' and column_name in ('bron','bron_id','gevonden_door_agent_id') order by 1`;
console.log(`${n} statements uitgevoerd.`);
console.log("tabellen:", t.map(x=>x.table_name).join(", "));
console.log("nieuwe kolommen op groei_prospects:", c.map(x=>x.column_name).join(", "));
