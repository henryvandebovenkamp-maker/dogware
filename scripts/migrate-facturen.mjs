#!/usr/bin/env node
/**
 * Eenmalige, chirurgische migratie voor de factuuradministratie.
 *
 * Voegt kolommen toe aan `documents` (status, vervaldatum, betaaldatum,
 * betaalmethode, Mollie-referentie, verzendgegevens, creditnota-koppeling) en
 * één kolom aan `payments` (de werkelijke betaalmethode).
 *
 * Idempotent en veilig: uitsluitend ADD COLUMN IF NOT EXISTS en CREATE INDEX
 * IF NOT EXISTS. Er wordt geen enkele kolom verwijderd of hernoemd, en geen
 * bestaande rij weggegooid.
 *
 * De backfill leest wat er al in de snapshot stond, zodat bestaande facturen
 * meteen de juiste status en betaaldatum hebben in plaats van als "concept" in
 * het nieuwe overzicht te belanden.
 *
 * Gebruik:
 *   node scripts/migrate-facturen.mjs
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

/* ---------------------------------------------------------------- kolommen */

await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'CONCEPT'`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS due_at timestamptz`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS paid_at timestamptz`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS payment_method text`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS mollie_payment_id text`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS sent_at timestamptz`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS sent_to text`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS credits_document_id uuid`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS credited_by_document_id uuid`;
await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS credit_reason text`;

await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS method text`;

/* ---------------------------------------------------------------- backfill */

/*
 * Bestaande facturen zijn per definitie betaald: ze werden pas vastgelegd op
 * het moment dat Mollie de betaling bevestigde. De betaaldatum en de
 * Mollie-referentie stonden alleen in de snapshot; die halen we er nu uit.
 */
const gevuld = await sql`
  UPDATE documents
     SET status = 'BETAALD',
         paid_at = COALESCE(
           paid_at,
           NULLIF(snapshot->>'betaaldOp', '')::timestamptz
         ),
         mollie_payment_id = COALESCE(
           mollie_payment_id,
           NULLIF(snapshot->>'molliePaymentId', '')
         )
   WHERE type LIKE 'INVOICE%'
     AND status = 'CONCEPT'
  RETURNING nummer
`;

/*
 * De betaalmethode is nooit vastgelegd en valt niet te reconstrueren. Bewust
 * leeg laten in plaats van "ideal" aannemen: liever geen methode op een oude
 * factuur dan een verzonnen methode.
 */
const methodes = await sql`
  UPDATE documents d
     SET payment_method = p.method
    FROM payments p
   WHERE d.payment_id = p.id
     AND p.method IS NOT NULL
     AND d.payment_method IS NULL
  RETURNING d.nummer
`;

/* ----------------------------------------------------------------- indexen */

/*
 * Eén betaling, één factuur — vanaf nu door de database afgedwongen. Bestaan
 * er onverhoopt al duplicaten, dan mislukt deze index; dat is dan precies de
 * melding die je wilt zien in plaats van stilzwijgend doorgaan.
 */
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS documents_payment_idx
    ON documents (payment_id)
    WHERE payment_id IS NOT NULL
`;
await sql`
  CREATE INDEX IF NOT EXISTS documents_status_idx ON documents (status, issued_at)
`;

const totalen = await sql`
  SELECT status, count(*)::int AS aantal
    FROM documents
   WHERE type LIKE 'INVOICE%' OR type = 'CREDIT_NOTE'
   GROUP BY status
   ORDER BY status
`;

console.log("Kolommen en indexen: OK");
console.log(`Facturen op BETAALD gezet: ${gevuld.length}`);
console.log(`Betaalmethode overgenomen uit payments: ${methodes.length}`);
console.log("Verdeling:", JSON.stringify(totalen));
