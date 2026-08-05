#!/usr/bin/env node
/**
 * Testscript voor "bestaand account ook partner maken".
 *
 * Draait tegen de echte database en ruimt alles wat het aanmaakt weer op.
 * Test de garanties die in SQL liggen: geen tweede account, geen tweede
 * partnerprofiel, geen dubbele rol, ook niet bij twee gelijktijdige
 * activaties. Verstuurt geen e-mail.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const r of readFileSync(".env.local", "utf8").split("\n")) {
  const m = r.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

const MERK = `test-koppeling-${Date.now()}`;
const EMAIL = `${MERK}@dogware-test.invalid`;
let geslaagd = 0;
let gefaald = 0;

function check(naam, ok, extra = "") {
  if (ok) {
    geslaagd++;
    console.log(`  ✓ ${naam}`);
  } else {
    gefaald++;
    console.log(`  ✗ ${naam} ${extra}`);
  }
}

const code = () => `TST${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/** Zelfde INSERT-vorm als lib/partner-activation.ts gebruikt. */
const insertPartner = (userId) => sql`
  INSERT INTO partners (user_id, referral_code, commission_cents, status, invited_at)
  VALUES (${userId}, ${code()}, 50000, 'INVITED', now())
  ON CONFLICT DO NOTHING RETURNING id`;

const grantRole = (userId, rol) => sql`
  INSERT INTO user_roles (user_id, role) VALUES (${userId}, ${rol})
  ON CONFLICT (user_id, role) DO NOTHING RETURNING id`;

try {
  /* --- Opzet: een websiteaanvrager met een aanvraag en een journey --- */
  const [user] = await sql`
    INSERT INTO users (email, naam, role, status)
    VALUES (${EMAIL}, 'Test Aanvrager', 'CUSTOMER', 'ACTIVE') RETURNING id`;
  await grantRole(user.id, "CUSTOMER");

  // Een affiliate via wie deze persoon ooit binnenkwam.
  const [affUser] = await sql`
    INSERT INTO users (email, naam, role, status)
    VALUES (${`aff-${MERK}@dogware-test.invalid`}, 'Test Affiliate', 'AFFILIATE_PARTNER', 'ACTIVE')
    RETURNING id`;
  const affCode = code();
  const [aff] = await sql`
    INSERT INTO partners (user_id, referral_code, commission_cents, status)
    VALUES (${affUser.id}, ${affCode}, 50000, 'ACTIVE') RETURNING id`;

  const [lead] = await sql`
    INSERT INTO leads (bedrijfsnaam, naam, email, plaats, affiliate_partner_id,
                       referral_code_snapshot, attribution_model, source, stage, status)
    VALUES ('Test Hondenschool', 'Test Aanvrager', ${EMAIL}, 'Utrecht', ${aff.id},
            ${affCode}, 'LAST_VALID_REFERRAL', 'affiliate', 'demo-verstuurd', 'demo verstuurd')
    RETURNING id`;
  await sql`INSERT INTO journey_events (lead_id, kind, label)
            VALUES (${lead.id}, 'email_sent', 'Voorbeeld verstuurd')`;

  console.log("\n5. E-mailadres met hoofdletters of spaties wordt herkend");
  const rommelig = `  ${EMAIL.toUpperCase()}  `;
  const genormaliseerd = rommelig.trim().toLowerCase();
  const gevonden = await sql`SELECT id FROM users WHERE lower(email) = ${genormaliseerd}`;
  check("hetzelfde account gevonden", gevonden.length === 1 && gevonden[0].id === user.id);

  console.log("\n2. Bestaande websiteaanvrager wordt partner");
  const rolNieuw = await grantRole(user.id, "AFFILIATE_PARTNER");
  const p1 = await insertPartner(user.id);
  check("partnerrol toegevoegd", rolNieuw.length === 1);
  check("partnerprofiel aangemaakt", p1.length === 1);
  const rollen = await sql`SELECT role FROM user_roles WHERE user_id = ${user.id} ORDER BY role`;
  check(
    "klantrol behouden naast partnerrol",
    rollen.map((r) => r.role).join(",") === "AFFILIATE_PARTNER,CUSTOMER",
    JSON.stringify(rollen),
  );
  const [{ c: aantalUsers }] = await sql`
    SELECT count(*)::int c FROM users WHERE lower(email) = ${EMAIL}`;
  check("geen tweede gebruikersaccount", aantalUsers === 1, `gevonden: ${aantalUsers}`);

  console.log("\n7. Bestaande aanvraag en journey blijven intact");
  const [naLead] = await sql`SELECT * FROM leads WHERE id = ${lead.id}`;
  const [{ c: events }] = await sql`
    SELECT count(*)::int c FROM journey_events WHERE lead_id = ${lead.id}`;
  check("aanvraag bestaat nog", Boolean(naLead));
  check("stage ongewijzigd", naLead.stage === "demo-verstuurd", naLead?.stage);
  check("tijdlijn ongewijzigd", events === 1, `events: ${events}`);

  console.log("\n   Referral/affiliate blijft los van de nieuwe partnerrol");
  check("oorspronkelijke affiliate behouden", naLead.affiliate_partner_id === aff.id);
  check("referral-snapshot behouden", naLead.referral_code_snapshot === affCode);
  check("bron behouden", naLead.source === "affiliate");
  const [eigen] = await sql`SELECT referral_code FROM partners WHERE user_id = ${user.id}`;
  check("eigen partnercode staat los van de affiliatecode", eigen.referral_code !== affCode);

  console.log("\n4. Bestaande partner wordt nogmaals ingevoerd");
  const p2 = await insertPartner(user.id);
  const rol2 = await grantRole(user.id, "AFFILIATE_PARTNER");
  check("geen tweede partnerprofiel", p2.length === 0);
  check("geen dubbele rol", rol2.length === 0);

  console.log("\n6. Twee gelijktijdige activaties maken geen duplicaten");
  const [gelijktijdig] = await sql`
    INSERT INTO users (email, naam, role, status)
    VALUES (${`race-${MERK}@dogware-test.invalid`}, 'Test Race', 'CUSTOMER', 'ACTIVE')
    RETURNING id`;
  const [rA, rB] = await Promise.all([
    insertPartner(gelijktijdig.id),
    insertPartner(gelijktijdig.id),
  ]);
  const [gA, gB] = await Promise.all([
    grantRole(gelijktijdig.id, "AFFILIATE_PARTNER"),
    grantRole(gelijktijdig.id, "AFFILIATE_PARTNER"),
  ]);
  const [{ c: profielen }] = await sql`
    SELECT count(*)::int c FROM partners WHERE user_id = ${gelijktijdig.id}`;
  const [{ c: rolRijen }] = await sql`
    SELECT count(*)::int c FROM user_roles
    WHERE user_id = ${gelijktijdig.id} AND role = 'AFFILIATE_PARTNER'`;
  check("precies één partnerprofiel", profielen === 1, `gevonden: ${profielen}`);
  check("precies één rolrij", rolRijen === 1, `gevonden: ${rolRijen}`);
  check(
    "maar één van beide activaties claimt de aanmaak",
    rA.length + rB.length === 1 && gA.length + gB.length === 1,
  );

  console.log("\n8. Referral-link wordt maar één keer aangemaakt");
  const codes = await sql`SELECT referral_code FROM partners WHERE user_id = ${user.id}`;
  check("één referralcode per partner", codes.length === 1);

  console.log("\n   Databaseconstraints doen hun werk");
  let dubbelEmailGeweigerd = false;
  try {
    await sql`INSERT INTO users (email, naam, role) VALUES (${EMAIL}, 'Kopie', 'CUSTOMER')`;
  } catch {
    dubbelEmailGeweigerd = true;
  }
  check("tweede account met hetzelfde e-mailadres geweigerd", dubbelEmailGeweigerd);

  let hoofdletterGeweigerd = false;
  try {
    await sql`INSERT INTO users (email, naam, role)
              VALUES (${EMAIL.toUpperCase()}, 'Kopie', 'CUSTOMER')`;
  } catch {
    hoofdletterGeweigerd = true;
  }
  check("zelfde adres met hoofdletters ook geweigerd", hoofdletterGeweigerd);

  /* --- Opruimen --- */
  await sql`DELETE FROM journey_events WHERE lead_id = ${lead.id}`;
  await sql`DELETE FROM leads WHERE id = ${lead.id}`;
  await sql`DELETE FROM activity_log WHERE actor_user_id IN (${user.id}, ${affUser.id}, ${gelijktijdig.id})`;
  await sql`DELETE FROM partners WHERE user_id IN (${user.id}, ${affUser.id}, ${gelijktijdig.id})`;
  await sql`DELETE FROM users WHERE id IN (${user.id}, ${affUser.id}, ${gelijktijdig.id})`;
  const [{ c: rest }] = await sql`
    SELECT count(*)::int c FROM users WHERE email LIKE ${`%${MERK}%`}`;
  console.log(`\nOpgeruimd (${rest} testrijen over).`);
} catch (err) {
  gefaald++;
  console.error("\nOnverwachte fout:", err.message);
}

console.log(`\n${geslaagd} geslaagd, ${gefaald} gefaald.`);
process.exit(gefaald === 0 ? 0 : 1);
