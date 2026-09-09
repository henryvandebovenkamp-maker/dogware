#!/usr/bin/env node
/**
 * Integratietest: blijft de partner gekoppeld gedurende de hele klantreis?
 *
 * Draait tegen de echte database en ruimt alles wat het aanmaakt weer op.
 * Getoetst worden de garanties die niet in een pure test passen omdat ze in
 * SQL liggen: dat de koppeling bij de aanvraag staat (en dus een verwijderde
 * cookie overleeft), dat hij door alle twintig stages heen blijft staan, en
 * dat één aanvraag nooit twee keer commissie oplevert — ook niet wanneer een
 * betaling eerst mislukt en daarna alsnog slaagt.
 *
 * Gebruik:
 *   node --import ./tests/register-alias.mjs scripts/test-referral-journey.mjs
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const r of readFileSync(".env.local", "utf8").split("\n")) {
  const m = r.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

// Pas importeren nadat DATABASE_URL bekend is: de echte productiecode.
const { getPartnerCommission } = await import("../lib/partner-data.ts");
const { JOURNEY_STAGES } = await import("../lib/db/schema.ts");

const MERK = `journey-${Date.now()}`;
let ok = 0;
let fout = 0;
const check = (naam, geslaagd, extra = "") => {
  if (geslaagd) { ok++; console.log(`  ✓ ${naam}`); }
  else { fout++; console.log(`  ✗ ${naam} ${extra}`); }
};

const ids = { users: [], partners: [], leads: [] };

try {
  /* --- Opzet: een partner die een bezoeker binnenbrengt --- */
  const [pu] = await sql`INSERT INTO users (email, naam, role, status)
    VALUES (${`p-${MERK}@dogware-test.invalid`}, 'Test Partner', 'AFFILIATE_PARTNER', 'ACTIVE') RETURNING id`;
  ids.users.push(pu.id);
  const code = `JRN${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const [partner] = await sql`INSERT INTO partners (user_id, referral_code, commission_cents, status)
    VALUES (${pu.id}, ${code}, 50000, 'ACTIVE') RETURNING id`;
  ids.partners.push(partner.id);

  const [click] = await sql`INSERT INTO referral_clicks
    (partner_id, referral_code, visitor_id, landing_page, referrer, utm)
    VALUES (${partner.id}, ${code}, ${MERK}, '/hondenschool', 'https://www.google.com/search',
            ${JSON.stringify({ utm_source: "nieuwsbrief", utm_medium: "affiliate", utm_campaign: "september" })})
    RETURNING id, first_seen_at`;

  /* --- De aanvraag: hier wordt de herkomst server-side vastgelegd --- */
  const [lead] = await sql`INSERT INTO leads
    (bedrijfsnaam, naam, email, plaats, source, stage, status,
     affiliate_partner_id, referral_code_snapshot, referral_click_id,
     attribution_model, attributed_at,
     first_touch_partner_id, last_touch_partner_id,
     referral_first_seen_at, referral_landing_page, referral_referrer, utm)
    VALUES ('Blaf & Boffel', 'Kim Jansen', ${`k-${MERK}@dogware-test.invalid`}, 'Amersfoort',
            'referral', 'aangevraagd', 'nieuw',
            ${partner.id}, ${code}, ${click.id},
            'FIRST_TOUCH', now(),
            ${partner.id}, ${partner.id},
            ${click.first_seen_at}, '/hondenschool', 'https://www.google.com/search',
            ${JSON.stringify({ utm_source: "nieuwsbrief", utm_medium: "affiliate", utm_campaign: "september" })})
    RETURNING id`;
  ids.leads.push(lead.id);

  console.log("\nScenario 7 — de bezoeker wist zijn cookies");
  // Er is geen cookie in het spel: de koppeling zit in de rij zelf.
  const [naWissen] = await sql`SELECT affiliate_partner_id, referral_code_snapshot,
    referral_landing_page, utm FROM leads WHERE id = ${lead.id}`;
  check("partner staat bij de aanvraag", naWissen.affiliate_partner_id === partner.id);
  check("referralcode bewaard als momentopname", naWissen.referral_code_snapshot === code);
  check("landingspagina bewaard", naWissen.referral_landing_page === "/hondenschool");
  check("campagne bewaard, los van de partner", naWissen.utm?.utm_campaign === "september");

  console.log("\nScenario 8 — de aanvraag wordt klant, met voorstel en betalingen");
  const [commerce] = await sql`INSERT INTO commerce (lead_id, status, project_cents)
    VALUES (${lead.id}, 'DRAFT', 250000) RETURNING id`;

  let losgeraakt = null;
  for (const stage of JOURNEY_STAGES) {
    await sql`UPDATE leads SET stage = ${stage} WHERE id = ${lead.id}`;
    const [r] = await sql`SELECT affiliate_partner_id FROM leads WHERE id = ${lead.id}`;
    if (r.affiliate_partner_id !== partner.id) losgeraakt ??= stage;
  }
  check("partner blijft gekoppeld door alle 20 stages", losgeraakt === null, `(los bij ${losgeraakt})`);

  const [viaCommerce] = await sql`
    SELECT l.affiliate_partner_id FROM commerce c
    JOIN leads l ON l.id = c.lead_id WHERE c.id = ${commerce.id}`;
  check("ook vanuit de commerciële afspraak vindbaar", viaCommerce.affiliate_partner_id === partner.id);

  console.log("\nScenario 9 — betaling mislukt en wordt later opnieuw betaald");
  await sql`INSERT INTO payments (commerce_id, type, status, amount_cents)
    VALUES (${commerce.id}, 'DEPOSIT', 'FAILED', 125000)`;
  await sql`INSERT INTO payments (commerce_id, type, status, amount_cents)
    VALUES (${commerce.id}, 'DEPOSIT', 'PAID', 125000)`;
  const betalingen = await sql`SELECT status FROM payments WHERE commerce_id = ${commerce.id}`;
  check("er staan twee betaalpogingen", betalingen.length === 2);

  await sql`UPDATE leads SET stage = 'actief', status = 'klant geworden' WHERE id = ${lead.id}`;
  const commissie = await getPartnerCommission(partner.id, 50000);
  check("precies één verkochte aanvraag", commissie.verkocht === 1, JSON.stringify(commissie));
  check("commissie is één keer het bedrag", commissie.verdiendCents === 50000, JSON.stringify(commissie));

  console.log("\nAfgevallen aanvraag levert geen commissie op");
  await sql`UPDATE leads SET status = 'afgevallen' WHERE id = ${lead.id}`;
  const na = await getPartnerCommission(partner.id, 50000);
  check("teller staat weer op nul", na.verkocht === 0 && na.verdiendCents === 0, JSON.stringify(na));
} finally {
  for (const id of ids.leads) {
    await sql`DELETE FROM payments WHERE commerce_id IN (SELECT id FROM commerce WHERE lead_id = ${id})`;
    await sql`DELETE FROM commerce WHERE lead_id = ${id}`;
    await sql`DELETE FROM journey_events WHERE lead_id = ${id}`;
    await sql`DELETE FROM leads WHERE id = ${id}`;
  }
  for (const id of ids.partners) {
    await sql`DELETE FROM referral_clicks WHERE partner_id = ${id}`;
    await sql`DELETE FROM partners WHERE id = ${id}`;
  }
  for (const id of ids.users) await sql`DELETE FROM users WHERE id = ${id}`;
  console.log("\nTestdata opgeruimd.");
}

console.log(`\n${ok} geslaagd, ${fout} gefaald`);
process.exit(fout === 0 ? 0 : 1);
