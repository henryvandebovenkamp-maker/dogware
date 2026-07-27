import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/** Voegt de stijl-kolom toe aan groei_prospects. Veilig om vaker te draaien. */
for (const regel of readFileSync(".env.local", "utf8").split("\n")) {
  const m = regel.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sql = neon(process.env.DATABASE_URL);
const stappen = [
  `ALTER TABLE groei_prospects ADD COLUMN IF NOT EXISTS stijl jsonb NOT NULL DEFAULT '{}'::jsonb`,
];

for (const stap of stappen) await sql.query(stap);

const kolommen = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'groei_prospects' AND column_name = 'stijl'`;
console.log("stijl-kolom aanwezig:", kolommen.length === 1);
