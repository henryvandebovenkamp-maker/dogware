import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { JOURNEY_STAGES, type JourneyStage } from "../lib/db/schema.ts";
import {
  DIRECT_JOURNEY_PHASES,
  JOURNEY_PHASES,
  journeyPhasesFor,
  phaseIndexFor,
  phaseStateFor,
  stageMeta,
} from "../lib/journey-stages.ts";
import { nextAction, type JourneySnapshot } from "../lib/journey-next.ts";
import { leidAf } from "../lib/aanvragen.ts";
import {
  isDirectJourney,
  normalizeVariant,
  overeenkomstPoort,
  type PoortVoorstel,
} from "../lib/journey-variant.ts";
import { buildAgreement, consentLabels, type AgreementContext } from "../lib/agreement.ts";
import { leesDirecteKlant } from "../lib/direct-klant.ts";

/**
 * De tweede instroomroute: een directe klant, zonder voorbeeldwebsite.
 *
 * Wat hier vastligt is vooral wat NIET mag veranderen: de demo-route blijft
 * precies zoals hij was, en een directe klant komt nergens een demo tegen.
 * De pure beslissingen worden direct getoetst; de serveracties (die een
 * database nodig hebben) op hun broncode, in dezelfde stijl als
 * agreement-signing.test.mts.
 */

const LEAD = "4a1c7a0e-6c55-4f0e-9d4b-2f7d7c0f1e11";
const NU = new Date("2026-09-23T12:00:00Z");

const bron = (pad: string) => readFileSync(new URL(`../${pad}`, import.meta.url), "utf8");
const acties = bron("app/actions/commerce.ts");
const directActie = bron("app/actions/direct-klant.ts");
const agreementsLib = bron("lib/agreements.ts");
const commerceLib = bron("lib/commerce.ts");
const proposalsLib = bron("lib/proposals.ts");
const klantView = bron("components/commerce/customer-view.tsx");
const detailPagina = bron("app/admin/(portal)/leads/[id]/page.tsx");
const overeenkomstPagina = bron("app/traject/[token]/overeenkomst/page.tsx");

/** Het stuk broncode van één functie, tot de volgende export. */
function functie(src: string, naam: string): string {
  const start = src.indexOf(`export async function ${naam}`);
  assert.ok(start >= 0, `${naam} bestaat niet meer`);
  const rest = src.slice(start + 10);
  const eind = rest.search(/\nexport (async )?function /);
  return eind < 0 ? rest : rest.slice(0, eind);
}

function snapshot(over: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return {
    stage: "offerte",
    commerceStatus: "DRAFT",
    demoVerstuurd: false,
    demoLinksKlaar: false,
    heeftConcept: false,
    voorstelVerstuurd: false,
    voorstelBekeken: false,
    voorstelGeaccepteerd: false,
    overeenkomstGetekend: false,
    aanbetalingBetaald: false,
    opleveringKlaar: false,
    restbetalingBetaald: false,
    mandaatActief: false,
    live: false,
    heeftAbonnement: true,
    ...over,
  };
}

const DIRECT = (over: Partial<JourneySnapshot> = {}) => snapshot({ variant: "direct", ...over });

function voorstel(over: Partial<PoortVoorstel> = {}): PoortVoorstel {
  return {
    id: "p-1",
    status: "SENT",
    sentAt: new Date("2026-09-20T10:00:00Z"),
    acceptedAt: null,
    geldigTot: new Date("2026-10-20T23:59:59Z"),
    ...over,
  };
}

const VERBODEN_ACTIES = new Set(["demo-versturen", "demo-akkoord", "voorstel-herinneren"]);
const VERBODEN_WOORDEN = [/voorbeeld/i, /klant wil doorgaan/i, /voorstel accepteren/i, /\bdemo\b/i];

/* ----------------------------------------------------------------------- */

describe("1. de demo-route is ongewijzigd", () => {
  it("een normale demo-aanvraag begint nog steeds bij demo versturen", () => {
    const s = snapshot({ stage: "aangevraagd" });
    for (const v of [undefined, "demo"] as const) {
      const n = nextAction({ ...s, variant: v }, LEAD);
      assert.equal(n.cta?.action, "demo-versturen");
      assert.equal(n.cta?.label, "Voorbeeld klaarzetten");
    }
  });

  it("zonder route geeft de motor exact hetzelfde als met route 'demo'", () => {
    const toestanden: Partial<JourneySnapshot>[] = [
      { stage: "aangevraagd" },
      { stage: "demo-verstuurd", demoVerstuurd: true, demoLinksKlaar: true },
      { stage: "demo-akkoord", demoVerstuurd: true },
      { heeftConcept: true },
      { voorstelVerstuurd: true },
      { voorstelVerstuurd: true, voorstelGeaccepteerd: true },
      { overeenkomstGetekend: true, voorstelGeaccepteerd: true },
      { aanbetalingBetaald: true },
    ];
    for (const t of toestanden) {
      assert.deepEqual(
        nextAction(snapshot({ ...t, variant: "demo" }), LEAD),
        nextAction(snapshot(t), LEAD),
      );
    }
  });

  it("vraagt bij een verstuurd voorstel nog steeds om het akkoord van de klant", () => {
    const n = nextAction(snapshot({ voorstelVerstuurd: true }), LEAD);
    assert.equal(n.cta?.action, "voorstel-herinneren");
  });

  it("de demo-balk heeft nog exact dezelfde fases", () => {
    assert.deepEqual(
      journeyPhasesFor("demo").map((p) => p.label),
      ["Demo", "Voorstel", "Overeenkomst", "1e termijn", "Bouw", "Oplevering", "Live & actief"],
    );
    assert.equal(journeyPhasesFor(), JOURNEY_PHASES);
  });

  it("de contracttekst van een demo-klant is letterlijk gelijk gebleven", () => {
    const ctx: AgreementContext = {
      company: "Voorbeeld BV",
      modules: ["Website"],
      werkzaamheden: ["Ontwerp"],
      setupExclLabel: "€ 1.000,00",
      setupInclLabel: "€ 1.210,00",
      vatPercent: 21,
      monthlyExclLabel: "€ 49,00",
      monthlyInclLabel: "€ 59,29",
      depositLabel: "€ 605,00",
      depositPercent: 50,
      finalLabel: "€ 605,00",
      finalPercent: 50,
      freeMonths: 0,
      subscriptionStartLabel: "Na oplevering.",
    };
    const zonder = JSON.stringify(buildAgreement(ctx));
    assert.equal(zonder, JSON.stringify(buildAgreement({ ...ctx, opdrachtDocument: "voorstel" })));
    assert.match(zonder, /zoals omschreven in het voorstel/);
    assert.doesNotMatch(zonder, /opdrachtbevestiging/);
  });

  it("een demo-klant kan de overeenkomst NIET openen zonder apart voorstelakkoord", () => {
    for (const v of [undefined, null, "demo", "iets-onbekends"]) {
      const p = overeenkomstPoort(v, voorstel(), null, NU);
      assert.equal(p.ok, false, `route ${String(v)} mag niet overslaan`);
    }
    assert.equal(overeenkomstPoort("demo", voorstel({ acceptedAt: NU }), null, NU).ok, true);
  });

  it("een onbekende route is altijd demo — geen bestaande aanvraag verandert van route", () => {
    assert.equal(normalizeVariant(undefined), "demo");
    assert.equal(normalizeVariant(""), "demo");
    assert.equal(normalizeVariant("handmatig"), "demo");
    assert.equal(isDirectJourney("direct"), true);
  });

  it("bestaande aanvragen worden in de migratie als 'demo' vastgelegd", () => {
    const sqlBestand = bron("drizzle/0003_journey_variant.sql");
    assert.match(sqlBestand, /ADD COLUMN IF NOT EXISTS "journey_variant" text NOT NULL DEFAULT 'demo'/);
    assert.match(bron("lib/db/schema.ts"), /journeyVariant: text\("journey_variant"\)[\s\S]*?\.default\("demo"\)/);
  });
});

/* ----------------------------------------------------------------------- */

describe("2. de volgende stap van een directe klant", () => {
  it("wordt in geen enkele toestand naar de demo gestuurd", () => {
    const vlaggen: (keyof JourneySnapshot)[] = [
      "demoVerstuurd",
      "demoLinksKlaar",
      "heeftConcept",
      "voorstelVerstuurd",
      "voorstelBekeken",
    ];
    for (const stage of JOURNEY_STAGES) {
      for (let mask = 0; mask < 1 << vlaggen.length; mask++) {
        const over: Partial<JourneySnapshot> = { stage };
        vlaggen.forEach((v, i) => ((over as Record<string, unknown>)[v] = Boolean(mask & (1 << i))));
        const n = nextAction(DIRECT(over), LEAD);
        assert.ok(!VERBODEN_ACTIES.has(n.cta?.action ?? ""), `${stage}/${mask}: ${n.cta?.action}`);
        for (const w of VERBODEN_WOORDEN) {
          assert.doesNotMatch(`${n.situatie} ${n.volgende} ${n.cta?.label ?? ""}`, w, `${stage}/${mask}`);
        }
      }
    }
  });

  it("zonder concept: 'Opdrachtbevestiging maken'", () => {
    const n = nextAction(DIRECT(), LEAD);
    assert.equal(n.cta?.label, "Opdrachtbevestiging maken");
    assert.equal(n.cta?.href, `/admin/leads/${LEAD}/voorstel`);
    assert.equal(n.waitingOn, "admin");
  });

  it("met concept: 'Opdrachtbevestiging afmaken en versturen'", () => {
    const n = nextAction(DIRECT({ heeftConcept: true }), LEAD);
    assert.equal(n.cta?.label, "Opdrachtbevestiging afmaken en versturen");
    assert.equal(n.waitingOn, "admin");
  });

  it("verstuurd maar niet getekend: wachten op de klant, met de overeenkomstherinnering", () => {
    const n = nextAction(DIRECT({ stage: "overeenkomst", voorstelVerstuurd: true }), LEAD);
    assert.equal(n.waitingOn, "klant");
    assert.equal(n.cta?.action, "overeenkomst-herinneren");
    assert.equal(n.cta?.label, "Herinnering opdrachtbevestiging sturen");
  });

  it("na tekenen loopt hij dezelfde stappen als iedereen", () => {
    const getekend = { overeenkomstGetekend: true, voorstelVerstuurd: true, voorstelGeaccepteerd: true };
    assert.deepEqual(nextAction(DIRECT(getekend), LEAD), nextAction(snapshot(getekend), LEAD));
    const betaald = { ...getekend, aanbetalingBetaald: true };
    assert.equal(nextAction(DIRECT(betaald), LEAD).cta?.action, "oplevering-klaarzetten");
  });

  it("staat na aanmaken in het opdracht-bakje, niet in Nieuw of Demo maken", () => {
    const a = leidAf(
      {
        id: LEAD,
        stage: "offerte",
        status: "contact gehad",
        demoSentAt: null,
        laatsteContactAt: null,
        snapshot: DIRECT({ heeftConcept: true }),
      },
      NU,
    );
    assert.equal(a.bakje, "voorstel");
    assert.equal(a.actieNodig, true);
    assert.equal(a.actie.cta?.label, "Opdrachtbevestiging afmaken en versturen");
    assert.equal(stageMeta("offerte", "direct").korte, "Opdracht");
    assert.equal(stageMeta("offerte", "demo").korte, "Voorstel");
  });
});

/* ----------------------------------------------------------------------- */

describe("3. de journeybalk van een directe klant", () => {
  it("bevat nergens 'Demo'", () => {
    const labels = journeyPhasesFor("direct").map((p) => p.label);
    assert.deepEqual(labels, ["Opdracht", "Overeenkomst", "1e termijn", "Bouw", "Oplevering", "Live & actief"]);
    for (const l of labels) assert.doesNotMatch(l, /demo/i);
  });

  it("plaatst elke stage in precies één fase", () => {
    for (const s of JOURNEY_STAGES) {
      const n = DIRECT_JOURNEY_PHASES.filter((p) => (p.stages as readonly string[]).includes(s)).length;
      assert.equal(n, 1, `${s} zit in ${n} fases`);
    }
  });

  it("toont bij de start niets als al afgerond", () => {
    for (const stage of ["aangevraagd", "offerte"] as JourneyStage[]) {
      assert.equal(phaseIndexFor(stage, "direct"), 0);
      assert.equal(phaseStateFor(0, stage, "direct"), "current");
    }
    assert.equal(phaseStateFor(0, "overeenkomst", "direct"), "done");
    assert.equal(phaseStateFor(1, "overeenkomst", "direct"), "current");
  });

  it("wordt zowel in de admin als in het klantportaal met de route aangeroepen", () => {
    assert.match(detailPagina, /<JourneyBar current=\{lead\.stage\} variant=\{lead\.journeyVariant\}/);
    assert.match(klantView, /<JourneyBar current=\{stage\} variant=\{variant\} toon="klant"/);
  });
});

/* ----------------------------------------------------------------------- */

describe("4. versturen: de overeenkomst staat meteen klaar", () => {
  const send = functie(acties, "sendProposal");
  const directTak = send.slice(send.indexOf("if (direct) {"), send.indexOf('await setStage(leadId, "voorstel-verstuurd"'));

  it("bevriest de versie via markProposalSent en registreert het PROPOSAL-document", () => {
    assert.ok(send.indexOf("markProposalSent(draft, commerce)") < send.indexOf("if (direct) {"));
    assert.ok(send.indexOf('type: "PROPOSAL"') < send.indexOf("if (direct) {"));
  });

  it("maakt direct de overeenkomst bij precies die versie en zet de stage op overeenkomst", () => {
    assert.match(directTak, /ensureAgreement\(commerce, lead, sent\)/);
    assert.match(directTak, /agreement\.proposalId !== sent\.id/);
    assert.match(directTak, /setStage\(leadId, "overeenkomst"/);
    assert.match(directTak, /"agreement_ready"/);
  });

  it("stuurt de agreement-ready mail met een link naar de overeenkomst, en géén proposal-sent", () => {
    assert.match(directTak, /mailAndLog\(lead, "agreement-ready", \{\}, link \? `\$\{link\}\/overeenkomst`/);
    assert.doesNotMatch(directTak, /proposal-sent/);
    assert.ok(directTak.includes("return gelukt"), "de directe tak moet eindigen vóór de demo-mail");
  });

  it("zet bij versturen GEEN fictief akkoord", () => {
    assert.doesNotMatch(directTak, /ACCEPTED|acceptedAt|PROPOSAL_ACCEPTED/);
  });

  it("een dubbele klik verstuurt niet dubbel: het concept wordt atomair geclaimd", () => {
    const mps = functie(proposalsLib, "markProposalSent");
    assert.match(mps, /eq\(schema\.proposals\.status, "DRAFT"\)/);
    assert.match(mps, /if \(!sent\) return null/);
    assert.ok(mps.indexOf('"DRAFT"') < mps.indexOf('"SUPERSEDED"'), "eerst claimen, dan pas opvolgen");
    assert.match(mps, /ne\(schema\.proposals\.id, sent\.id\)/, "nooit de zojuist verstuurde versie opvolgen");
    assert.match(send, /if \(!sent\) return FOUT/);
  });

  it("weigert een nieuwe versie zodra er al getekend is", () => {
    assert.match(send, /direct && isSigned\(await getCurrentAgreement\(commerce\.id\)\)/);
  });
});

/* ----------------------------------------------------------------------- */

describe("5. openen en ondertekenen zonder apart voorstelakkoord", () => {
  it("een directe klant kan de overeenkomst openen zodra de opdracht verstuurd is", () => {
    assert.equal(overeenkomstPoort("direct", voorstel(), null, NU).ok, true);
    assert.equal(overeenkomstPoort("direct", voorstel({ status: "VIEWED" }), null, NU).ok, true);
  });

  it("maar niet vóór versturen, en niet bij een concept of opgevolgde versie", () => {
    assert.equal(overeenkomstPoort("direct", null, null, NU).ok, false);
    assert.equal(overeenkomstPoort("direct", voorstel({ sentAt: null }), null, NU).ok, false);
    assert.equal(overeenkomstPoort("direct", voorstel({ status: "DRAFT" }), null, NU).ok, false);
    assert.equal(overeenkomstPoort("direct", voorstel({ status: "SUPERSEDED" }), null, NU).ok, false);
  });

  it("de overeenkomst moet bij precies die versie horen en mag niet opgevolgd zijn", () => {
    const p = voorstel();
    assert.equal(overeenkomstPoort("direct", p, { proposalId: p.id, status: "SENT" }, NU).ok, true);
    assert.equal(overeenkomstPoort("direct", p, { proposalId: "p-oud", status: "SENT" }, NU).ok, false);
    assert.equal(overeenkomstPoort("direct", p, { proposalId: p.id, status: "SUPERSEDED" }, NU).ok, false);
  });

  it("een verlopen opdrachtbevestiging kan niet meer getekend worden", () => {
    const p = voorstel({ geldigTot: new Date("2026-09-01T00:00:00Z") });
    assert.equal(overeenkomstPoort("direct", p, null, NU).ok, false);
  });

  it("de contractpagina en de ondertekenactie gebruiken dezelfde poortwachter", () => {
    assert.match(overeenkomstPagina, /overeenkomstPoort\(lead\.journeyVariant, proposal\)/);
    const sign = functie(acties, "signAgreement");
    assert.match(sign, /overeenkomstPoort\(lead\.journeyVariant, proposal\)/);
    assert.doesNotMatch(sign, /if \(!proposal\?\.acceptedAt\) return FOUT/, "geen harde voorstelcheck meer die direct blokkeert");
  });

  it("het losse voorstelakkoord blijft dicht voor een directe klant", () => {
    const accept = functie(acties, "acceptProposal");
    const guard = accept.indexOf("isDirectJourney(lead.journeyVariant)");
    assert.ok(guard > 0 && guard < accept.indexOf('status: "ACCEPTED"'));
  });

  it("het klantportaal toont een directe klant nooit het naamveld of 'Ja, ik ga akkoord'", () => {
    const directKaart = klantView.indexOf("if (voorstel.direct) {");
    assert.ok(directKaart > 0);
    assert.ok(directKaart < klantView.indexOf("Ja, ik ga akkoord met dit voorstel"));
    assert.ok(directKaart > klantView.indexOf("if (status.getekend) {"), "na tekenen volgt de betaalkaart");
    const kaart = klantView.slice(directKaart, klantView.indexOf("/* Geaccepteerd → overeenkomst tekenen */"));
    assert.match(kaart, /Je opdrachtbevestiging staat klaar/);
    assert.match(kaart, /Bekijk en onderteken de opdrachtbevestiging/);
    assert.match(kaart, /\/traject\/\$\{voorstel\.token\}\/overeenkomst/);
    assert.doesNotMatch(kaart, /acceptProposal|setNaam/);
  });
});

/* ----------------------------------------------------------------------- */

describe("6. ondertekenen legt het echte akkoord vast", () => {
  const helper = functie(agreementsLib, "acceptProposalBySignature");
  const sign = functie(acties, "signAgreement");

  it("zet het voorstel op ACCEPTED met moment, naam en vingerafdruk van de handtekening", () => {
    assert.match(helper, /status: "ACCEPTED"/);
    assert.match(helper, /acceptedAt: moment/);
    assert.match(helper, /const moment = agreement\.signedAt/);
    assert.match(helper, /acceptedName: agreement\.signerName/);
    assert.match(helper, /acceptedIpHash: agreement\.signedIpHash/);
    assert.match(helper, /acceptedUserAgent: agreement\.signedUserAgent/);
  });

  it("alleen voor een getekende overeenkomst bij precies die versie, en maar één keer", () => {
    assert.match(helper, /agreement\.status !== "SIGNED"/);
    assert.match(helper, /agreement\.proposalId !== proposal\.id/);
    assert.match(helper, /isNull\(schema\.proposals\.acceptedAt\)/);
    assert.match(helper, /inArray\(schema\.proposals\.status, \["SENT", "VIEWED"\]\)/);
  });

  it("gebeurt pas ná de handtekening en vóór de stap naar de aanbetaling", () => {
    const getekend = sign.indexOf('status: "SIGNED"');
    const akkoord = sign.indexOf("direct && (await acceptProposalBySignature(definitief, proposal))");
    const aanbetaling = sign.indexOf('setStage(lead.id, "aanbetaling"');
    assert.ok(getekend > 0 && akkoord > getekend && aanbetaling > akkoord);
  });

  it("de bestaande gevolgen van tekenen blijven: DEPOSIT_PENDING, document, mail", () => {
    assert.match(sign, /setCommerceStatus\(commerce\.id, "DEPOSIT_PENDING"\)/);
    assert.match(sign, /type: "AGREEMENT"/);
    assert.match(sign, /mailAndLog\(lead, "agreement-signed"/);
  });

  it("een gelijktijdige tweede poging verstuurt niets opnieuw", () => {
    const blok = sign.slice(sign.indexOf("if (!signed) {"), sign.indexOf("const definitief = signed;"));
    assert.match(blok, /return OK\(\)/);
    assert.doesNotMatch(blok, /mailAndLog|registerDocument|setStage/);
  });
});

/* ----------------------------------------------------------------------- */

describe("7. betalen en bouwen", () => {
  const betaal = commerceLib.slice(commerceLib.indexOf("async function onPaymentPaid"));
  const start = acties.slice(acties.indexOf("async function startPaymentInternal"));

  it("zonder ondertekening kan geen eerste termijn gestart worden", () => {
    const poort = start.indexOf("if (!isSigned(agreement))");
    const aanmaken = start.indexOf("createMolliePayment(");
    assert.ok(poort > 0 && aanmaken > poort);
    assert.ok(start.indexOf("if (!proposal?.acceptedAt)") < aanmaken);
  });

  it("het bedrag komt uit de bevroren overeenkomst, nooit uit de browser", () => {
    assert.match(start, /const snap = agreementPricing\(agreement\)/);
    assert.match(start, /amountCents = snap\.computed\.depositCents/);
    assert.match(acties, /kind: "deposit" \| "final",\n\): Promise<CommerceState>/);
  });

  it("na de eerste betaling start de bestaande bouwfase — voor beide routes dezelfde code", () => {
    const deposit = betaal.slice(betaal.indexOf('payment.type === "DEPOSIT"'), betaal.indexOf('payment.type === "FINAL_PAYMENT"'));
    assert.match(deposit, /status: "BUILDING"/);
    assert.match(deposit, /setStage\(lead\.id, "gestart"/);
    assert.match(deposit, /ensureBuildTasks\(lead\.id\)/);
    assert.match(deposit, /"deposit-received"/);
    assert.doesNotMatch(commerceLib, /journeyVariant/, "de betaalverwerking kent geen aparte route");
  });
});

/* ----------------------------------------------------------------------- */

describe("8. de akkoordverklaringen", () => {
  const labels = consentLabels({
    setupExclLabel: "€ 2.000,00",
    depositLabel: "€ 1.210,00",
    depositPercent: 50,
    finalLabel: "€ 1.210,00",
    finalPercent: 50,
    monthlyExclLabel: "€ 79,00",
    versionLabel: "DogWare-voorwaarden 1.0",
    opdrachtDocument: "opdrachtbevestiging",
  });

  it("het maandbedrag blijft onderdeel van de akkoordverklaringen", () => {
    assert.match(labels.agreesMaandbedrag, /€ 79,00 excl\. btw/);
  });

  it("dekken opdracht, investering, 50%/50%, voorwaarden en bevoegdheid", () => {
    assert.match(labels.agreesOpdracht, /opdrachtbevestiging/);
    assert.match(labels.agreesInvestering, /€ 2\.000,00/);
    assert.match(labels.agreesTermijnen, /50% .* nu en 50% .* bij oplevering/);
    assert.ok(labels.agreesVoorwaarden && labels.agreesBevoegd);
  });

  it("de contracttekst van een directe klant verwijst naar de opdrachtbevestiging", () => {
    const tekst = JSON.stringify(
      buildAgreement({
        company: "X",
        modules: [],
        werkzaamheden: [],
        setupExclLabel: "€ 1,00",
        setupInclLabel: "€ 1,21",
        vatPercent: 21,
        monthlyExclLabel: "€ 1,00",
        monthlyInclLabel: "€ 1,21",
        depositLabel: "€ 0,61",
        depositPercent: 50,
        finalLabel: "€ 0,60",
        finalPercent: 50,
        freeMonths: 0,
        subscriptionStartLabel: "Na oplevering.",
        opdrachtDocument: "opdrachtbevestiging",
      }),
    );
    assert.match(tekst, /zoals omschreven in de opdrachtbevestiging/);
    assert.doesNotMatch(tekst, /voorstel/);
  });
});

/* ----------------------------------------------------------------------- */

describe("9. nieuwe klant toevoegen", () => {
  const actie = functie(directActie, "createDirectCustomer");

  it("vereist admin-auth vóór er iets gebeurt", () => {
    assert.ok(actie.indexOf("getAdminActor()") < actie.indexOf("insert(schema.leads)"));
    assert.match(actie, /if \(!actor\) return/);
  });

  it("maakt dezelfde lead-rij, als directe klant, commercieel bij de opdracht", () => {
    assert.match(actie, /source: "handmatig"/);
    assert.match(actie, /journeyVariant: "direct"/);
    assert.match(actie, /stage: "offerte"/);
    assert.match(actie, /ensureCommerce\(lead\.id\)/);
    assert.match(actie, /createOrGetDraft\(commerce, lead, actor\.id\)/);
    assert.match(actie, /"Directe klant handmatig toegevoegd"/);
    assert.match(actie, /action: "DIRECT_CUSTOMER_CREATED"/);
  });

  it("gaat meteen naar de opdrachtbevestiging", () => {
    assert.match(actie, /redirect\(`\/admin\/leads\/\$\{lead\.id\}\/voorstel`\)/);
  });

  it("maakt geen tweede dossier voor een bekend e-mailadres (en neemt geen partnercookie van de beheerder over)", () => {
    assert.match(actie, /lower\(\$\{schema\.leads\.email\}\) = \$\{k\.email\}/);
    assert.doesNotMatch(actie, /affiliatePartnerId|referral|cookies\(/i);
  });

  it("vraagt alleen de korte gegevens; website is optioneel", () => {
    const leeg = leesDirecteKlant(new Map());
    assert.equal(leeg.ok, false);
    if (!leeg.ok) {
      assert.deepEqual(Object.keys(leeg.fouten).sort(), ["bedrijfsnaam", "email", "naam", "plaats", "telefoon"]);
    }
    const goed = leesDirecteKlant(
      new Map([
        ["bedrijfsnaam", "  Kwispel  Hoeve "],
        ["naam", "Sam Jansen"],
        ["email", "Sam@Voorbeeld.NL "],
        ["telefoon", "06 12345678"],
        ["plaats", "Utrecht"],
      ]),
    );
    assert.equal(goed.ok, true);
    if (goed.ok) {
      assert.equal(goed.waarden.email, "sam@voorbeeld.nl");
      assert.equal(goed.waarden.bedrijfsnaam, "Kwispel Hoeve");
      assert.equal(goed.waarden.website, "");
    }
    const fout = leesDirecteKlant(new Map([["email", "geen-adres"]]));
    assert.equal(!fout.ok && Boolean(fout.fouten.email), true);
  });

  it("de detailpagina toont een directe klant geen demosectie", () => {
    const tak = detailPagina.slice(detailPagina.indexOf("{direct ? ("), detailPagina.indexOf(") : ("));
    assert.match(tak, /Directe klant/);
    assert.match(tak, /BouwpromptKnop/);
    assert.doesNotMatch(tak, /DemoPanel|demoDomain|demoPortalUrl|Demo versturen/);
  });

  it("demo-mails worden geweigerd voor een directe klant, ook via een directe POST", () => {
    const journey = bron("app/actions/journey.ts");
    for (const naam of ["previewDemoMail", "sendDemoTestMail", "sendDemo"]) {
      assert.match(functie(journey, naam), /isDirectJourney\(lead\.journeyVariant\)/, naam);
    }
    assert.match(functie(acties, "markDemoAccepted"), /isDirectJourney\(ctx\.lead\.journeyVariant\)/);
  });
});
