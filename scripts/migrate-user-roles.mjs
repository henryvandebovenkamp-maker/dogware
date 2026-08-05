#!/usr/bin/env node
/**
 * Meerdere rollen per gebruiker.
 *
 * Eén e-mailadres = één account, maar dat account mag tegelijk klant,
 * partner en beheerder zijn. `users.role` blijft de primaire rol; de
 * volledige set staat voortaan in `user_roles`.
 *
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
  `CREATE TABLE IF NOT EXISTS user_roles (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role text NOT NULL,
     granted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Deze index is de hele race-condition-bescherming: twee gelijktijdige
  // activaties kunnen nooit dezelfde rol dubbel toekennen.
  `CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_idx
     ON user_roles (user_id, role)`,
  `CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles (role)`,

  // Backfill: iedere bestaande gebruiker houdt zijn huidige rol.
  `INSERT INTO user_roles (user_id, role)
     SELECT id, role FROM users
   ON CONFLICT (user_id, role) DO NOTHING`,

  // E-mailadressen hoofdletterongevoelig uniek houden. Bestaande data is al
  // lowercase (alle schrijfpaden normaliseren), dit borgt het op DB-niveau.
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email))`,
];

let n = 0;
for (const s of STAPPEN) {
  await sql.query(s);
  n++;
}

const [{ count: rollen }] = await sql`SELECT count(*)::int AS count FROM user_roles`;
const verdeling = await sql`SELECT role, count(*)::int AS aantal
  FROM user_roles GROUP BY role ORDER BY role`;
const dubbel = await sql`SELECT user_id, count(*)::int AS aantal
  FROM user_roles GROUP BY user_id HAVING count(*) > 1`;

console.log(`${n} statements uitgevoerd.`);
console.log(`user_roles: ${rollen} rijen`);
for (const r of verdeling) console.log(`  ${r.role}: ${r.aantal}`);
console.log(`gebruikers met meerdere rollen: ${dubbel.length}`);
