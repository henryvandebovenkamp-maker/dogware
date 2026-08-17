#!/usr/bin/env node
/**
 * Kent de eigenaarrol DOGWARE_OWNER toe aan precies één bestaand account.
 *
 * Deze rol geeft toegang tot /hq (DogWare HQ) en staat volledig los van
 * SUPER_ADMIN: een beheerder komt er niet in, en de rol is nergens via het
 * beheerportaal toe te kennen. Dat is precies de bedoeling — hij hoort maar
 * op één plek vandaan te komen: deze bewuste handeling.
 *
 * Er staat met opzet geen e-mailadres, naam of id in de code. Het account
 * wordt op de commandoregel meegegeven en moet al bestaan.
 *
 * Gebruik:
 *   node scripts/grant-hq-owner.mjs "email@voorbeeld.nl"
 *   node scripts/grant-hq-owner.mjs "email@voorbeeld.nl" --intrekken
 *
 * Idempotent: opnieuw draaien verandert niets en meldt dat netjes.
 * Het script stopt bij geen resultaat, bij meerdere resultaten en bij een
 * account dat niet actief is. Er wordt nooit een account aangemaakt.
 *
 * Er is geen databasemigratie nodig: `user_roles.role` is een text-kolom,
 * geen enum, en de unieke index (user_id, role) maakt het toekennen
 * race-condition-veilig.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const OWNER_ROLE = "DOGWARE_OWNER";

const args = process.argv.slice(2);
const intrekken = args.includes("--intrekken");
const email = args.find((a) => !a.startsWith("--"));

if (!email) {
  console.error('Gebruik: node scripts/grant-hq-owner.mjs "email@voorbeeld.nl" [--intrekken]');
  process.exit(1);
}

/* ---------- Databaseverbinding (zelfde patroon als de andere scripts) ---------- */

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

if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(schoonEmail)) {
  console.error("Dat ziet er niet uit als een geldig e-mailadres. Gestopt.");
  process.exit(1);
}

/* ---------- 1. Precies één bestaand, actief account ---------- */

const gevonden = await sql`
  SELECT id, naam, status FROM users WHERE lower(email) = ${schoonEmail}
`;

if (gevonden.length === 0) {
  console.error(
    "Geen gebruiker met dit e-mailadres. Dit script maakt bewust geen account aan — " +
      "log eerst één keer normaal in, of gebruik scripts/create-admin.mjs. Gestopt.",
  );
  process.exit(1);
}
if (gevonden.length > 1) {
  console.error(
    `Meerdere accounts (${gevonden.length}) met dit e-mailadres gevonden. ` +
      "Dat hoort niet te kunnen en moet eerst uitgezocht worden. Gestopt.",
  );
  process.exit(1);
}

const gebruiker = gevonden[0];

if (gebruiker.status !== "ACTIVE") {
  console.error(
    `Account heeft status ${gebruiker.status} in plaats van ACTIVE. ` +
      "De eigenaarrol gaat alleen naar een actief account. Gestopt.",
  );
  process.exit(1);
}

/* ---------- 2. Toekennen of intrekken — idempotent ---------- */

// De unieke index user_roles_user_role_idx is de scheidsrechter, niet een
// eerdere SELECT: twee gelijktijdige runs leveren nooit een dubbele rol op.
const alHouders = await sql`
  SELECT user_id FROM user_roles WHERE role = ${OWNER_ROLE}
`;

if (intrekken) {
  const weg = await sql`
    DELETE FROM user_roles
    WHERE user_id = ${gebruiker.id} AND role = ${OWNER_ROLE}
    RETURNING id
  `;
  console.log(
    weg.length > 0
      ? `Eigenaarrol ingetrokken van ${gebruiker.naam}.`
      : `${gebruiker.naam} had de eigenaarrol al niet — niets gewijzigd.`,
  );
} else {
  // Eén eigenaar. Staat de rol al bij iemand anders, dan stoppen we.
  const anderen = alHouders.filter((r) => r.user_id !== gebruiker.id);
  if (anderen.length > 0) {
    console.error(
      `De eigenaarrol staat al bij een ander account (${anderen.length}). ` +
        "DogWare HQ kent één eigenaar. Trek die eerst in met --intrekken. Gestopt.",
    );
    process.exit(1);
  }

  const nieuw = await sql`
    INSERT INTO user_roles (user_id, role, granted_by_user_id)
    VALUES (${gebruiker.id}, ${OWNER_ROLE}, NULL)
    ON CONFLICT (user_id, role) DO NOTHING
    RETURNING id
  `;
  console.log(
    nieuw.length > 0
      ? `Eigenaarrol toegekend aan ${gebruiker.naam}.`
      : `${gebruiker.naam} had de eigenaarrol al — niets gewijzigd.`,
  );
}

/* ---------- 3. Registreren in het bestaande auditlogboek ---------- */

// Geen sessies, codes of tokens — alleen wát er gebeurde en bij welk account.
await sql`
  INSERT INTO activity_log (actor_user_id, action, object_type, object_id, new_value, reason)
  VALUES (
    NULL,
    ${intrekken ? "HQ_OWNER_REVOKED" : "HQ_OWNER_GRANTED"},
    'hq',
    ${gebruiker.id},
    ${JSON.stringify({ rol: OWNER_ROLE, via: "scripts/grant-hq-owner.mjs", model: null })}::jsonb,
    'Eigenaarrol DogWare HQ handmatig gewijzigd via serverscript'
  )
`;

/* ---------- 4. Eindstand tonen ---------- */

const eind = await sql`
  SELECT count(*)::int AS aantal FROM user_roles WHERE role = ${OWNER_ROLE}
`;
console.log(`Accounts met ${OWNER_ROLE}: ${eind[0].aantal}`);
console.log("Let op: /hq opent pas als óók HQ_ENABLED=true in de environment staat.");
