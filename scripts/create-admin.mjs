#!/usr/bin/env node
/**
 * Eenmalig een SUPER_ADMIN aanmaken. DogWare is volledig wachtwoordloos:
 * de beheerder logt daarna in via Magic Link/Code op /admin/login.
 *
 * Gebruik:
 *   node scripts/create-admin.mjs "email@voorbeeld.nl" "Volledige Naam"
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const [email, naam] = process.argv.slice(2);
if (!email || !naam) {
  console.error('Gebruik: node scripts/create-admin.mjs "email" "Naam"');
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
const cleanEmail = email.trim().toLowerCase();

const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail}`;
if (existing.length > 0) {
  await sql`
    UPDATE users
    SET role = 'SUPER_ADMIN', status = 'ACTIVE', failed_logins = 0, locked_until = NULL
    WHERE email = ${cleanEmail}`;
  console.log(`Bestaand account ${cleanEmail} bijgewerkt naar SUPER_ADMIN.`);
} else {
  await sql`
    INSERT INTO users (email, naam, role, status)
    VALUES (${cleanEmail}, ${naam}, 'SUPER_ADMIN', 'ACTIVE')`;
  console.log(`SUPER_ADMIN aangemaakt: ${cleanEmail}`);
}
console.log("Inloggen: /admin/login → e-mailadres invullen → Magic Link/Code.");
