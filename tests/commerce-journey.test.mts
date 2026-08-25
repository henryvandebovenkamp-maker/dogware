import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { JOURNEY_STAGES } from "../lib/db/schema.ts";
import {
  JOURNEY_PHASES,
  STAGE_KLANT_LABEL,
  STAGE_META,
  phaseIndexFor,
  stageIndex,
} from "../lib/journey-stages.ts";
import { nextAction, type JourneySnapshot } from "../lib/journey-next.ts";
import {
  ACTIVE_CONTRACT_VERSION,
  CONSENT_KEYS,
  CONTRACT_VERSIONS,
  buildAgreement,
  resolveContractVersion,
  type AgreementContext,
} from "../lib/agreement.ts";

/**
 * De journey zelf: volgorde, volgende stap, en de regels die niet mogen
 * schuiven. Geen database nodig — dit zijn allemaal pure beslissingen.
 */

const LEAD = "b9d22bef-c6bd-43eb-a858-6497e750a3ba";

const LEEG: JourneySnapshot = {
  stage: "demo-verstuurd",
  commerceStatus: "DRAFT",
  demoVerstuurd: true,
  demoLinksKlaar: true,
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
};

describe("1. de journey-stappen zijn compleet en consistent", () => {
  it("heeft voor elke stage een adminlabel en een klantlabel", () => {
    for (const s of JOURNEY_STAGES) {
      assert.ok(STAGE_META[s]?.label, `adminlabel ontbreekt voor ${s}`);
      assert.ok(STAGE_KLANT_LABEL[s], `klantlabel ontbreekt voor ${s}`);
    }
  });

  it("plaatst elke stage in precies één zichtbare fase", () => {
    for (const s of JOURNEY_STAGES) {
      const treffers = JOURNEY_PHASES.filter((p) =>
        (p.stages as readonly string[]).includes(s),
      );
      assert.equal(treffers.length, 1, `${s} zit in ${treffers.length} fases`);
    }
  });

  it("houdt de bestaande demo-stappen op hun oude plek", () => {
    // Bestaande aanvragen dragen deze waarden in de database; hun onderlinge
    // volgorde mag door de uitbreiding niet zijn omgedraaid.
    const oud = ["aangevraagd", "voorbereiden", "demo-verstuurd", "ingelogd", "bekeken", "feedback", "afspraak", "offerte", "akkoord", "gestart"] as const;
    for (let i = 1; i < oud.length; i++) {
      assert.ok(
        stageIndex(oud[i]) > stageIndex(oud[i - 1]),
        `${oud[i]} staat niet meer ná ${oud[i - 1]}`,
      );
    }
  });

  it("loopt de fases in oplopende volgorde mee met de stages", () => {
    let vorige = 0;
    for (const s of JOURNEY_STAGES) {
      const f = phaseIndexFor(s);
      assert.ok(f >= vorige, `fase springt terug bij ${s}`);
      vorige = f;
    }
  });
});

describe("2. de volgende stap volgt de werkelijkheid, niet de stage", () => {
  it("begint bij het versturen van het voorbeeld", () => {
    const n = nextAction(
      { ...LEEG, stage: "aangevraagd", demoVerstuurd: false, demoLinksKlaar: false },
      LEAD,
    );
    assert.equal(n.cta?.action, "demo-versturen");
    assert.equal(n.cta?.href, `/admin/leads/${LEAD}#voorbeeld`);
    assert.equal(n.waitingOn, "admin");
  });

  it("blijft op versturen staan zolang de mail niet weg is, ook met links", () => {
    const n = nextAction(
      { ...LEEG, stage: "voorbereiden", demoVerstuurd: false, demoLinksKlaar: true },
      LEAD,
    );
    assert.equal(n.cta?.action, "demo-versturen");
    assert.match(n.volgende, /demolink en de inloglink/i);
  });

  it("stuurt niemand terug naar de demo zodra de klant wil doorgaan", () => {
    const n = nextAction(
      { ...LEEG, stage: "demo-akkoord", demoVerstuurd: false, demoLinksKlaar: false },
      LEAD,
    );
    assert.equal(n.cta?.action, "voorstel-maken");
  });

  it("vraagt eerst om 'klant wil doorgaan'", () => {
    const n = nextAction(LEEG, LEAD);
    assert.equal(n.cta?.action, "demo-akkoord");
    assert.equal(n.waitingOn, "klant");
  });

  it("stuurt na demo-akkoord naar het maken van het voorstel", () => {
    const n = nextAction({ ...LEEG, stage: "demo-akkoord" }, LEAD);
    assert.equal(n.cta?.action, "voorstel-maken");
    assert.equal(n.cta?.href, `/admin/leads/${LEAD}/voorstel`);
    assert.equal(n.waitingOn, "admin");
  });

  it("wacht na versturen op de klant", () => {
    const n = nextAction({ ...LEEG, stage: "voorstel-verstuurd", voorstelVerstuurd: true }, LEAD);
    assert.equal(n.waitingOn, "klant");
    assert.equal(n.cta?.action, "voorstel-herinneren");
  });

  it("wijst na acceptatie op de overeenkomst, niet op betalen", () => {
    const n = nextAction(
      { ...LEEG, voorstelVerstuurd: true, voorstelGeaccepteerd: true },
      LEAD,
    );
    assert.match(n.situatie, /overeenkomst/i);
    assert.equal(n.cta?.action, "overeenkomst-herinneren");
  });

  it("geeft na de aanbetaling de oplevering als volgende adminstap", () => {
    const n = nextAction(
      {
        ...LEEG,
        voorstelVerstuurd: true,
        voorstelGeaccepteerd: true,
        overeenkomstGetekend: true,
        aanbetalingBetaald: true,
      },
      LEAD,
    );
    assert.equal(n.cta?.action, "oplevering-klaarzetten");
    assert.equal(n.waitingOn, "admin");
  });

  it("zet de website pas live als het mandaat er is", () => {
    const basis: JourneySnapshot = {
      ...LEEG,
      voorstelVerstuurd: true,
      voorstelGeaccepteerd: true,
      overeenkomstGetekend: true,
      aanbetalingBetaald: true,
      opleveringKlaar: true,
      restbetalingBetaald: true,
    };
    assert.equal(
      nextAction(basis, LEAD).cta?.action,
      "restbetaling-herinneren",
      "zonder mandaat wordt er niet live gezet",
    );
    assert.equal(nextAction({ ...basis, mandaatActief: true }, LEAD).cta?.action, "livegang");
  });

  it("mag zonder abonnement wel live zonder mandaat", () => {
    const n = nextAction(
      {
        ...LEEG,
        heeftAbonnement: false,
        voorstelVerstuurd: true,
        voorstelGeaccepteerd: true,
        overeenkomstGetekend: true,
        aanbetalingBetaald: true,
        opleveringKlaar: true,
        restbetalingBetaald: true,
      },
      LEAD,
    );
    assert.equal(n.cta?.action, "livegang");
  });

  it("is klaar zodra alles rond is", () => {
    const n = nextAction(
      {
        ...LEEG,
        voorstelVerstuurd: true,
        voorstelGeaccepteerd: true,
        overeenkomstGetekend: true,
        aanbetalingBetaald: true,
        opleveringKlaar: true,
        restbetalingBetaald: true,
        mandaatActief: true,
        live: true,
      },
      LEAD,
    );
    assert.equal(n.cta, null);
    assert.equal(n.waitingOn, "niemand");
  });

  it("laat een teruggezette stage de betaalde werkelijkheid niet overschrijven", () => {
    const n = nextAction(
      {
        ...LEEG,
        stage: "aangevraagd", // handmatig teruggezet
        voorstelVerstuurd: true,
        voorstelGeaccepteerd: true,
        overeenkomstGetekend: true,
        aanbetalingBetaald: true,
      },
      LEAD,
    );
    assert.equal(n.cta?.action, "oplevering-klaarzetten");
  });
});

describe("3. de overeenkomst en haar versiebeheer", () => {
  const CTX: AgreementContext = {
    company: "The Happy Dogs",
    modules: ["Website", "Klantenportaal"],
    werkzaamheden: ["Ontwerp en opbouw"],
    setupExclLabel: "€ 2.500,00",
    setupInclLabel: "€ 3.025,00",
    vatPercent: 21,
    monthlyExclLabel: "€ 180,00",
    monthlyInclLabel: "€ 217,80",
    depositLabel: "€ 1.512,50",
    depositPercent: 50,
    finalLabel: "€ 1.512,50",
    finalPercent: 50,
    freeMonths: 0,
    subscriptionStartLabel: "De incasso start na oplevering.",
  };

  it("noemt OneDaySite als contractpartij en DogWare als platform", () => {
    const tekst = JSON.stringify(buildAgreement(CTX));
    assert.match(tekst, /OneDaySite/, "de juridische partij moet genoemd worden");
    assert.match(tekst, /DogWare/, "het merk hoort er ook in te staan");
    assert.match(tekst, /Amersfoort/, "het vestigingsadres hoort in de aanhef");
  });

  it("zet de echte bedragen in het financiële hoofdstuk", () => {
    const tekst = JSON.stringify(buildAgreement(CTX));
    assert.match(tekst, /2\.500,00/);
    assert.match(tekst, /1\.512,50/);
    assert.match(tekst, /180,00/);
  });

  it("scheidt het inhoudelijke akkoord op het maandbedrag van de technische incasso", () => {
    const tekst = JSON.stringify(buildAgreement(CTX));
    assert.match(
      tekst,
      /technisch geactiveerd bij de betaling van de tweede termijn/,
      "het onderscheid mandaat-akkoord vs. mandaat-activatie moet expliciet in de tekst staan",
    );
  });

  it("voegt afwijkende afspraken toe als eigen hoofdstuk", () => {
    const zonder = buildAgreement(CTX);
    const met = buildAgreement({ ...CTX, bijzonderheden: "Eerste jaar geen prijsverhoging." });
    assert.equal(met.length, zonder.length + 1);
    assert.match(JSON.stringify(met), /geen prijsverhoging/);
  });

  it("valt bij een onbekende versie terug op de oudste, niet de nieuwste", () => {
    assert.equal(resolveContractVersion("bestaat-niet").id, CONTRACT_VERSIONS[0].id);
    assert.equal(resolveContractVersion(null).id, CONTRACT_VERSIONS[0].id);
  });

  it("kent de actieve versie", () => {
    assert.ok(CONTRACT_VERSIONS.some((v) => v.id === ACTIVE_CONTRACT_VERSION));
  });
});

describe("4. de akkoordpunten dekken alles wat de klant moet weten", () => {
  it("vraagt apart om opdracht, investering, termijnen, maandbedrag, voorwaarden en bevoegdheid", () => {
    assert.deepEqual(
      [...CONSENT_KEYS].sort(),
      [
        "agreesBevoegd",
        "agreesInvestering",
        "agreesMaandbedrag",
        "agreesOpdracht",
        "agreesTermijnen",
        "agreesVoorwaarden",
      ],
    );
  });
});

describe("5. geen enkele klant zit in de generieke code", () => {
  const bestanden = [
    "lib/commerce.ts",
    "lib/proposals.ts",
    "lib/agreements.ts",
    "lib/agreement.ts",
    "lib/money.ts",
    "lib/journey-next.ts",
    "lib/journey-stages.ts",
    "lib/documents.ts",
    "lib/portal-access.ts",
    "app/actions/commerce.ts",
  ];

  it("noemt Miranda, The Happy Dogs of een organisatie-ID nergens", () => {
    for (const f of bestanden) {
      const inhoud = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
      assert.doesNotMatch(inhoud, /miranda/i, `${f} noemt een klantnaam`);
      assert.doesNotMatch(inhoud, /happy\s*dogs/i, `${f} noemt een klantnaam`);
      assert.doesNotMatch(
        inhoud,
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        `${f} bevat een hardcoded id`,
      );
    }
  });

  it("hardcodeert geen bedragen van één klant", () => {
    for (const f of bestanden) {
      const inhoud = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
      assert.doesNotMatch(inhoud, /250_?000|2500\b/, `${f} bevat een vast projectbedrag`);
      assert.doesNotMatch(inhoud, /18_?000\b/, `${f} bevat een vast maandbedrag`);
    }
  });
});
