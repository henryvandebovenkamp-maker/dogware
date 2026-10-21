#!/usr/bin/env node
/**
 * Kent de financiële bevoegdheid FINANCE_APPROVER toe aan één bestaande
 * beheerder (of trekt hem in).
 *
 * Wie deze bevoegdheid heeft, mag een voorbereide partneruitbetaling
 * goedkeuren en als uitbetaald markeren. Een beheerder zonder deze rol kan een
 * uitbetaling alleen voorbereiden. De rol is bewust nergens via het
 * beheerportaal toe te kennen: hij komt alleen van deze bewuste handeling.
 *
 * Gebruik:
 *   node scripts/grant-finance-role.mjs "email@voorbeeld.nl"
 *   node scripts/grant-finance-role.mjs "email@voorbeeld.nl" --intrekken
 *
 * Idempotent. Stopt bij geen of meerdere accounts, bij een account dat niet
 * actief is en bij een account zonder beheerdersrol. Maakt nooit een account aan.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const FINANCE_ROLE = "FINANCE_APPROVER";

const args = process.argv.slice(2);
const intrekken = args.includes("--intrekken");
const email = args.find((a) => !a.startsWith("--"));

if (!email) {
  console.error('Gebruik: node scripts/grant-finance-role.mjs "email@voorbeeld.nl" [--intrekken]');
  process.exit(1);
}

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
const schoonEmail = email.trim().toLowerCase();

const gevonden = await sql`
  SELECT u.id, u.naam, u.status,
         EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'SUPER_ADMIN')
           OR u.role = 'SUPER_ADMIN' AS is_admin
  FROM users u WHERE lower(u.email) = ${schoonEmail}
`;
if (gevonden.length !== 1) {
  console.error(
    gevonden.length === 0
      ? "Geen gebruiker met dit e-mailadres. Dit script maakt bewust geen account aan. Gestopt."
      : `Meerdere accounts (${gevonden.length}) met dit e-mailadres. Gestopt.`,
  );
  process.exit(1);
}
const gebruiker = gevonden[0];

if (!intrekken) {
  if (gebruiker.status !== "ACTIVE") {
    console.error(`Account heeft status ${gebruiker.status}; alleen een actief account. Gestopt.`);
    process.exit(1);
  }
  if (!gebruiker.is_admin) {
    console.error("Dit account is geen beheerder. Financiële bevoegdheid alleen voor beheerders. Gestopt.");
    process.exit(1);
  }
}

const resultaat = intrekken
  ? await sql`DELETE FROM user_roles WHERE user_id = ${gebruiker.id} AND role = ${FINANCE_ROLE} RETURNING id`
  : await sql`
      INSERT INTO user_roles (user_id, role, granted_by_user_id)
      VALUES (${gebruiker.id}, ${FINANCE_ROLE}, NULL)
      ON CONFLICT (user_id, role) DO NOTHING
      RETURNING id
    `;

console.log(
  resultaat.length > 0
    ? `${intrekken ? "Ingetrokken bij" : "Toegekend aan"} ${gebruiker.naam}.`
    : `${gebruiker.naam} ${intrekken ? "had de bevoegdheid al niet" : "had de bevoegdheid al"} — niets gewijzigd.`,
);

if (resultaat.length > 0) {
  await sql`
    INSERT INTO activity_log (actor_user_id, action, object_type, object_id, new_value, reason)
    VALUES (
      NULL,
      ${intrekken ? "FINANCE_ROLE_REVOKED" : "FINANCE_ROLE_GRANTED"},
      'user',
      ${gebruiker.id},
      ${JSON.stringify({ rol: FINANCE_ROLE, via: "scripts/grant-finance-role.mjs" })}::jsonb,
      'Financiële bevoegdheid handmatig gewijzigd via serverscript'
    )
  `;
}

const eind = await sql`SELECT count(*)::int AS aantal FROM user_roles WHERE role = ${FINANCE_ROLE}`;
console.log(`Accounts met ${FINANCE_ROLE}: ${eind[0].aantal}`);
