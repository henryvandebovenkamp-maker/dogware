#!/usr/bin/env node
/**
 * Integratietest van de referralflow over echt HTTP.
 *
 * Draait tegen een lokale dev-server en de echte database, maakt twee
 * testpartners aan en ruimt alles weer op — ook wanneer een controle faalt.
 * Getoetst wordt wat je alleen in een echte browserreis ziet: dat de proxy de
 * juiste landingspagina doorgeeft, dat de cookie ondertekend en zonder
 * persoonsgegevens wordt gezet, en dat de eerste partnerlink eigenaar blijft
 * wanneer de bezoeker later rechtstreeks of via een andere partner terugkomt.
 *
 * Gebruik (AUTH_SECRET moet hetzelfde zijn als waarmee de server draait):
 *   AUTH_SECRET=<secret> npx next dev -p 3111
 *   AUTH_SECRET=<secret> node scripts/test-referral-flow.mjs
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { createHmac, timingSafeEqual } from "node:crypto";

for (const r of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = r.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);
const BASE = process.env.E2E_BASE ?? "http://localhost:3111";
const MERK = `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`;
const CODE_A = `${MERK}A`;
const CODE_B = `${MERK}B`;

let ok = 0, fout = 0;
const check = (naam, geslaagd, extra = "") => {
  if (geslaagd) { ok++; console.log(`  ✓ ${naam}`); }
  else { fout++; console.log(`  ✗ ${naam} ${extra}`); }
};

/** Leest de ondertekende cookie zoals de server dat doet. */
function leesRefCookie(waarde) {
  const [data, sig] = waarde.split(".");
  const payload = Buffer.from(data, "base64url").toString();
  const verwacht = createHmac("sha256", process.env.AUTH_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(verwacht);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("handtekening klopt niet");
  return JSON.parse(payload);
}

/** Minimale cookiejar: onthoudt naam=waarde over verzoeken heen. */
const jar = new Map();
function bewaar(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [nv] = c.split(";");
    const i = nv.indexOf("=");
    jar.set(nv.slice(0, i).trim(), nv.slice(i + 1));
  }
}
function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function bezoek(pad, opties = {}) {
  let url = new URL(pad, BASE);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { cookie: cookieHeader(), "user-agent": "Mozilla/5.0 (e2e-test)", ...(opties.headers ?? {}) },
    });
    bewaar(res);
    const loc = res.headers.get("location");
    if (!loc) return res;
    url = new URL(loc, url);
  }
  throw new Error("te veel redirects");
}

const partnerIds = [];
const userIds = [];
async function maakPartner(code) {
  const [u] = await sql`INSERT INTO users (email, naam, role, status)
    VALUES (${`${code.toLowerCase()}@dogware-test.invalid`}, ${`Test ${code}`}, 'AFFILIATE_PARTNER', 'ACTIVE') RETURNING id`;
  const [p] = await sql`INSERT INTO partners (user_id, referral_code, commission_cents, status, bedrijfsnaam)
    VALUES (${u.id}, ${code}, 50000, 'ACTIVE', ${`Test ${code}`}) RETURNING id`;
  userIds.push(u.id); partnerIds.push(p.id);
  return p.id;
}

try {
  const A = await maakPartner(CODE_A);
  const B = await maakPartner(CODE_B);

  console.log("\nScenario 1 — bezoek via de partnerlink op de homepage");
  await bezoek(`/?ref=${CODE_A.toLowerCase()}&utm_source=nieuwsbrief&utm_medium=affiliate&utm_campaign=september&utm_verzonnen=kwaad`, {
    headers: { referer: "https://www.google.com/search?q=iets+persoonlijks" },
  });
  const klik1 = await sql`SELECT * FROM referral_clicks WHERE partner_id = ${A}`;
  check("één klik geregistreerd", klik1.length === 1, `(${klik1.length})`);
  check("landingspagina is de echte pagina, niet /p/CODE", klik1[0]?.landing_page === "/", `(${klik1[0]?.landing_page})`);
  check("utm bewaard", klik1[0]?.utm?.utm_source === "nieuwsbrief" && klik1[0]?.utm?.utm_campaign === "september");
  check("verzonnen utm-sleutel geweigerd", klik1[0]?.utm?.utm_verzonnen === undefined);
  check("verwijzer zonder zoekopdracht", klik1[0]?.referrer === "https://www.google.com/search", `(${klik1[0]?.referrer})`);
  const c1 = leesRefCookie(jar.get("dw_ref"));
  check("cookie wijst naar partner A", c1.p === A);
  check("cookie bevat geen persoonsgegevens", Object.keys(c1).sort().join() === "c,k,lc,lk,lp,lt,p,t,v");

  console.log("\nScenario 3 — daarna rechtstreeks naar de site");
  await bezoek("/");
  await bezoek("/demo");
  const c2 = leesRefCookie(jar.get("dw_ref"));
  check("first touch blijft partner A", c2.p === A && c2.t === c1.t);

  console.log("\nScenario 10 — dezelfde link nog eens openen");
  await bezoek(`/demo?ref=${CODE_A.toLowerCase()}`);
  const klik2 = await sql`SELECT * FROM referral_clicks WHERE partner_id = ${A}`;
  check("geen tweede klikrecord binnen het dedupe-venster", klik2.length === 1, `(${klik2.length})`);
  const c3 = leesRefCookie(jar.get("dw_ref"));
  check("eerste aanraking onveranderd", c3.p === A && c3.t === c1.t);

  console.log("\nScenario 4 — later via een ándere partnerlink");
  await bezoek(`/?ref=${CODE_B.toLowerCase()}`);
  const c4 = leesRefCookie(jar.get("dw_ref"));
  check("first touch blijft partner A", c4.p === A && c4.t === c1.t);
  check("partner B wordt als last touch bewaard", c4.lp === B);
  check("klik van B is wél geregistreerd", (await sql`SELECT * FROM referral_clicks WHERE partner_id = ${B}`).length === 1);

  console.log("\nScenario 5 — een code die niet bestaat");
  const voor = (await sql`SELECT count(*)::int n FROM referral_clicks`)[0].n;
  const res = await bezoek("/?ref=bestaatnietxyz");
  check("bezoeker krijgt gewoon een pagina", res.status === 200, `(${res.status})`);
  check("geen klik weggeschreven", (await sql`SELECT count(*)::int n FROM referral_clicks`)[0].n === voor);
  const c5 = leesRefCookie(jar.get("dw_ref"));
  check("bestaande koppeling ongemoeid", c5.p === A && c5.lp === B);

  console.log("\nScenario 6 — partner A wordt geblokkeerd");
  await sql`UPDATE partners SET status = 'BLOCKED' WHERE id = ${A}`;
  const voorB = (await sql`SELECT count(*)::int n FROM referral_clicks WHERE partner_id = ${A}`)[0].n;
  await bezoek(`/?ref=${CODE_A.toLowerCase()}`);
  check("een geblokkeerde partnerlink registreert niets meer",
    (await sql`SELECT count(*)::int n FROM referral_clicks WHERE partner_id = ${A}`)[0].n === voorB);
} finally {
  await sql`DELETE FROM referral_clicks WHERE partner_id = ANY(${partnerIds})`;
  await sql`DELETE FROM partners WHERE id = ANY(${partnerIds})`;
  await sql`DELETE FROM users WHERE id = ANY(${userIds})`;
  console.log("\nTestdata opgeruimd.");
}

console.log(`\n${ok} geslaagd, ${fout} gefaald`);
process.exit(fout === 0 ? 0 : 1);
