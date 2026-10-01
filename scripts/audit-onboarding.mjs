#!/usr/bin/env node
/**
 * Read-only controle van de commerciële onboarding van ALLE dossiers.
 *
 * Wijzigt niets. Er staan uitsluitend SELECT-queries in, en ze lopen in een
 * READ ONLY-transactie: zelfs een vergissing in dit bestand kan de database
 * niet veranderen.
 *
 * Per dossier: waar staat het (voorstel, overeenkomst, betalingen), en welke
 * inconsistenties kunnen een klant onterecht blokkeren. De regels hier zijn
 * dezelfde als in de applicatie (lib/proposal-geldigheid.ts): een voorstel
 * verloopt alleen vóór acceptatie, aan het einde van de geldigheidsdag in
 * Nederlandse tijd.
 *
 * Gebruik:
 *   node scripts/audit-onboarding.mjs            # alleen dossiers met een bevinding
 *   node scripts/audit-onboarding.mjs --alles    # alle dossiers met een voorstel
 *   node scripts/audit-onboarding.mjs --json     # machineleesbaar
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
const alles = process.argv.includes("--alles");
const alsJson = process.argv.includes("--json");
const nu = new Date();

/* ---------------------------------------------- dezelfde regels als de app */

const TZ = "Europe/Amsterdam";
function kalenderdag(moment) {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(moment);
  const deel = (t) => d.find((x) => x.type === t)?.value ?? "";
  return `${deel("year")}-${deel("month")}-${deel("day")}`;
}
function offsetMinuten(moment) {
  const d = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(moment);
  const deel = (t) => Number(d.find((x) => x.type === t)?.value ?? 0);
  const alsUtc = Date.UTC(deel("year"), deel("month") - 1, deel("day"), deel("hour"), deel("minute"), deel("second"));
  return Math.round((alsUtc - Math.floor(moment.getTime() / 1000) * 1000) / 60_000);
}
function eindeVanDag(dag) {
  const [j, m, d] = dag.split("-").map(Number);
  const gok = Date.UTC(j, m - 1, d, 23, 59, 59, 999);
  return new Date(gok - offsetMinuten(new Date(gok)) * 60_000);
}
const geaccepteerd = (p) => Boolean(p.accepted_at) || p.status === "ACCEPTED";
const verlopen = (p) =>
  !geaccepteerd(p) && p.geldig_tot && eindeVanDag(kalenderdag(new Date(p.geldig_tot))) < nu;
const dag = (v) => (v ? new Date(v).toLocaleString("nl-NL", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }) : "—");
const euro = (c) => `€ ${(c / 100).toFixed(2).replace(".", ",")}`;

/* ------------------------------------------------------------- uitlezen -- */

const [leads, commerce, proposals, agreements, payments, installments, indexen] = await sql.transaction(
  [
    sql`SELECT id, bedrijfsnaam, naam, email, stage, status, journey_variant FROM leads`,
    sql`SELECT id, lead_id, status, accepted_at, portal_token IS NOT NULL AS heeft_portaal,
               delivery_ready_at, live_at, mandate_activated_at, monthly_cents
          FROM commerce`,
    sql`SELECT id, commerce_id, version, status, sent_at, created_at, geldig_tot,
               accepted_at, accepted_name, first_viewed_at, view_count
          FROM proposals ORDER BY version`,
    sql`SELECT id, commerce_id, proposal_id, proposal_version, status, signed_at, created_at,
               (pricing ? 'betaalregeling') AS heeft_regeling
          FROM agreements ORDER BY created_at`,
    sql`SELECT id, commerce_id, type, status, amount_cents, mollie_payment_id, created_at,
               paid_at, processed_at, installment_id, agreement_id, failure_reason
          FROM payments ORDER BY created_at`,
    sql`SELECT commerce_id, agreement_id, volgnummer, aantal, status, plan FROM payment_installments`,
    sql`SELECT indexname FROM pg_indexes WHERE tablename IN ('payments', 'payment_installments')`,
  ],
  { readOnly: true },
);

const perCommerce = (rijen, id) => rijen.filter((r) => r.commerce_id === id);
const resultaat = [];

for (const c of commerce) {
  const lead = leads.find((l) => l.id === c.lead_id);
  const ps = perCommerce(proposals, c.id);
  const as = perCommerce(agreements, c.id);
  const bs = perCommerce(payments, c.id);
  const ts = perCommerce(installments, c.id);
  if (ps.length === 0 && as.length === 0 && bs.length === 0) continue;

  const direct = lead?.journey_variant === "direct";
  // Zoals getActiveProposal: het geaccepteerde, anders het laatst verstuurde.
  const actief =
    [...ps].reverse().find((p) => p.status === "ACCEPTED") ??
    [...ps].reverse().find((p) => p.status === "SENT" || p.status === "VIEWED") ??
    null;
  const getekend = as.filter((a) => a.status === "SIGNED");
  const huidigeOvereenkomst = getekend.at(-1) ?? as.at(-1) ?? null;
  const eersteBetaald = bs.some((b) => b.type === "DEPOSIT" && b.status === "PAID");

  const fase = eersteBetaald
    ? "eerste termijn betaald"
    : bs.some((b) => b.type === "DEPOSIT" && ["OPEN", "PENDING", "CREATED"].includes(b.status))
      ? "betaling in afwachting"
      : bs.some((b) => b.type === "DEPOSIT" && ["FAILED", "EXPIRED", "CANCELED"].includes(b.status))
        ? "betaling mislukt/afgebroken (nog niet betaald)"
        : getekend.length
          ? "getekend, eerste termijn open"
          : actief && geaccepteerd(actief)
            ? "voorstel geaccepteerd, overeenkomst klaar om te tekenen"
            : actief
              ? "voorstel open"
              : ps.some((p) => p.status === "DRAFT")
                ? "alleen concept"
                : "—";

  const bevindingen = [];
  const vind = (code, tekst, ernst = "blokkeert") => bevindingen.push({ code, ernst, tekst });

  if (actief && verlopen(actief)) {
    vind(
      "VERLOPEN_VOOR_ACCEPTATIE",
      `${direct ? "Opdrachtbevestiging" : "Voorstel"} v${actief.version} verlopen (geldig t/m ${dag(actief.geldig_tot)}), niet geaccepteerd. Oplossing: "Geldigheid verlengen" in de admin.`,
    );
  }
  for (const p of ps) {
    if (p.status === "ACCEPTED" && !p.accepted_at) vind("ACCEPTED_ZONDER_DATUM", `Voorstel v${p.version} staat op ACCEPTED zonder acceptatiemoment.`);
    if (p.accepted_at && p.status !== "ACCEPTED") vind("DATUM_ZONDER_ACCEPTED", `Voorstel v${p.version} heeft een acceptatiemoment maar status ${p.status}.`, "controleren");
  }
  if (ps.filter((p) => p.status === "ACCEPTED").length > 1) vind("MEERDERE_GEACCEPTEERD", "Meer dan één geaccepteerde voorstelversie.", "controleren");
  if (!direct && actief?.accepted_at && !as.some((a) => a.proposal_id === actief.id)) {
    vind("GEACCEPTEERD_ZONDER_OVEREENKOMST", `Voorstel v${actief.version} geaccepteerd maar er is geen overeenkomst bij die versie (ontstaat bij openen van de overeenkomstpagina).`, "herstelt zichzelf");
  }
  if (huidigeOvereenkomst && huidigeOvereenkomst.status !== "SIGNED" && actief && huidigeOvereenkomst.proposal_id !== actief.id) {
    vind("OVEREENKOMST_ANDERE_VERSIE", `Openstaande overeenkomst hoort bij v${huidigeOvereenkomst.proposal_version}, actief voorstel is v${actief.version} (wordt bij openen vervangen).`, "herstelt zichzelf");
  }
  if (getekend.length > 1) vind("MEERDERE_GETEKEND", `${getekend.length} getekende overeenkomsten.`, "controleren");
  for (const a of getekend) {
    const p = ps.find((x) => x.id === a.proposal_id);
    if (p && !p.accepted_at) vind("GETEKEND_VOORSTEL_NIET_GEACCEPTEERD", `Getekende overeenkomst bij v${a.proposal_version}, maar dat voorstel heeft geen acceptatie (herstelt bij een nieuwe tekenpoging; betalen weigert zolang).`);
    if (a.heeft_regeling && !ts.some((t) => t.agreement_id === a.id)) vind("GETEKEND_ZONDER_SCHEMA", "Getekend met betaalregeling, maar zonder betaalschema (ontstaat bij openen van het portaal).", "herstelt zichzelf");
  }
  for (const b of bs) {
    const leeftijdMin = (nu - new Date(b.created_at)) / 60_000;
    if (b.status === "CREATED" && !b.mollie_payment_id && leeftijdMin > 2) vind("BETALING_ONDERBROKEN", `${b.type} ${euro(b.amount_cents)} hangt op CREATED zonder Mollie-id sinds ${dag(b.created_at)} (wordt nu bij een nieuwe poging vrijgegeven).`, "herstelt zichzelf");
    if (["OPEN", "PENDING"].includes(b.status) && leeftijdMin > 24 * 60) vind("BETALING_LANG_OPEN", `${b.type} ${euro(b.amount_cents)} staat sinds ${dag(b.created_at)} op ${b.status} (${b.mollie_payment_id}). Webhook gemist? Wordt bij terugkeer/nieuwe poging bij Mollie gecontroleerd.`, "controleren");
    if (b.status === "PAID" && !b.processed_at) vind("BETAALD_NIET_VERWERKT", `${b.type} ${euro(b.amount_cents)} is PAID maar niet verwerkt (geen factuur/vervolgstap).`);
    if (b.failure_reason?.startsWith("Bedrag wijkt af")) vind("BEDRAG_WIJKT_AF", `${b.type}: ${b.failure_reason}`);
    if (["DEPOSIT", "FINAL_PAYMENT", "INSTALLMENT"].includes(b.type) && !b.agreement_id) vind("BETALING_ZONDER_OVEREENKOMST", `${b.type} ${euro(b.amount_cents)} zonder gekoppelde overeenkomst.`, "controleren");
  }
  if (bs.filter((b) => b.type === "DEPOSIT" && b.status === "PAID").length > 1) vind("DUBBEL_BETAALD", "Meer dan één betaalde eerste termijn.");
  if (eersteBetaald && ["DRAFT", "PROPOSAL_SENT", "PROPOSAL_ACCEPTED", "DEPOSIT_PENDING"].includes(c.status)) {
    vind("STATUS_ACHTER", `Eerste termijn betaald, maar commerce-status is ${c.status}.`, "controleren");
  }

  resultaat.push({
    bedrijfsnaam: lead?.bedrijfsnaam ?? "(onbekend)",
    naam: lead?.naam ?? "",
    leadId: c.lead_id,
    route: direct ? "direct" : "demo",
    stage: lead?.stage,
    commerceStatus: c.status,
    fase,
    voorstellen: ps.map((p) => ({
      versie: p.version,
      status: p.status,
      aangemaakt: dag(p.created_at),
      verstuurd: dag(p.sent_at),
      geldigTot: dag(p.geldig_tot),
      geaccepteerd: p.accepted_at ? `${dag(p.accepted_at)} door ${p.accepted_name ?? "?"}` : "nee",
      verlopen: verlopen(p) ? "ja" : "nee",
    })),
    overeenkomst: huidigeOvereenkomst
      ? { status: huidigeOvereenkomst.status, bijVersie: huidigeOvereenkomst.proposal_version, getekend: dag(huidigeOvereenkomst.signed_at) }
      : null,
    betalingen: bs.map((b) => `${b.type} ${euro(b.amount_cents)} ${b.status} (${dag(b.created_at)})`),
    bevindingen,
  });
}

const indexNamen = indexen.map((i) => i.indexname);
const verplichteIndexen = ["payments_mollie_idx", "payments_installment_active_idx", "payment_installments_agreement_seq_idx"];
const ontbrekend = verplichteIndexen.filter((i) => !indexNamen.includes(i));

if (alsJson) {
  console.log(JSON.stringify({ moment: nu.toISOString(), ontbrekendeIndexen: ontbrekend, dossiers: resultaat }, null, 2));
  process.exit(0);
}

console.log(`Onboarding-audit — ${dag(nu)} (read-only)\n`);
console.log(ontbrekend.length ? `⚠ Ontbrekende unieke indexen: ${ontbrekend.join(", ")}` : "✓ Alle idempotentie-indexen op betalingen aanwezig.");
console.log("");

const fases = new Map();
for (const r of resultaat) fases.set(r.fase, (fases.get(r.fase) ?? 0) + 1);
console.log("Dossiers per fase:");
for (const [f, n] of fases) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log("");

const metBevinding = resultaat.filter((r) => r.bevindingen.length > 0);
console.log(`${metBevinding.length} van ${resultaat.length} dossiers met een bevinding.\n`);

for (const r of alles ? resultaat : metBevinding) {
  console.log(`■ ${r.bedrijfsnaam} — ${r.naam} [${r.route}] · stage ${r.stage} · ${r.commerceStatus}`);
  console.log(`  lead ${r.leadId} · fase: ${r.fase}`);
  for (const v of r.voorstellen) {
    console.log(`  v${v.versie} ${v.status.padEnd(10)} aangemaakt ${v.aangemaakt} · verstuurd ${v.verstuurd} · geldig t/m ${v.geldigTot} · verlopen ${v.verlopen} · geaccepteerd ${v.geaccepteerd}`);
  }
  if (r.overeenkomst) console.log(`  overeenkomst ${r.overeenkomst.status} bij v${r.overeenkomst.bijVersie} · getekend ${r.overeenkomst.getekend}`);
  for (const b of r.betalingen) console.log(`  betaling ${b}`);
  for (const b of r.bevindingen) console.log(`  → [${b.ernst}] ${b.code}: ${b.tekst}`);
  console.log("");
}
