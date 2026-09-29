import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { computeOneOff, DEFAULT_CONFIG, subscriptionStartLabel } from "../lib/money.ts";
import {
  ankerVoor,
  buildRegeling,
  isBetaalbaar,
  kalenderdagVan,
  normalizePlan,
  plusMaanden,
  regelingSluit,
  regelingStand,
  splitEvenly,
  termijnStatus,
  vanDatum,
  vervaldata,
  voortgang,
  type PlanConfig,
} from "../lib/payment-plan.ts";
import { buildAgreement, consentLabels, type AgreementContext } from "../lib/agreement.ts";
import { nextAction, type JourneySnapshot } from "../lib/journey-next.ts";
import { isUniekeSchending } from "../lib/db-errors.ts";

/**
 * De rekenlaag van de betaalregelingen.
 *
 * Geld is het enige waar een afrondingsfout meteen een echt probleem is. De
 * eerste case (€ 2.500 in 6 termijnen) staat er als voorbeeld in; de code
 * kent geen enkele klant.
 */

const oneOff = (projectCents: number, vatPercent = 21) =>
  computeOneOff({ ...DEFAULT_CONFIG, projectCents, vatPercent });
const plan = (soort: PlanConfig["soort"], aantal = 2): PlanConfig => ({
  soort,
  aantal,
  start: "bij-akkoord",
  startDatum: null,
});

describe("1. de voorbeelden uit de opdracht", () => {
  it("50/50: € 2.500 → € 1.250 + € 1.250 (excl.), gelijk aan de bestaande aanbetaling", () => {
    const c = oneOff(250_000);
    const { regeling } = buildRegeling(plan("50-50"), c, 21);
    assert.deepEqual(regeling.termijnen.map((t) => t.exVatCents), [125_000, 125_000]);
    assert.deepEqual(regeling.termijnen.map((t) => t.inclVatCents), [c.depositCents, c.finalCents]);
    assert.ok(regelingSluit(regeling));
  });

  it("volledig: € 2.500 → één betaling van € 2.500 (€ 3.025 incl.)", () => {
    const { regeling } = buildRegeling(plan("volledig"), oneOff(250_000), 21);
    assert.equal(regeling.termijnen.length, 1);
    assert.equal(regeling.termijnen[0].exVatCents, 250_000);
    assert.equal(regeling.termijnen[0].inclVatCents, 302_500);
  });

  it("3 termijnen: € 833,33 + € 833,33 + € 833,34", () => {
    const { regeling } = buildRegeling(plan("termijnen", 3), oneOff(250_000), 21);
    assert.deepEqual(regeling.termijnen.map((t) => t.exVatCents), [83_333, 83_333, 83_334]);
    assert.ok(regelingSluit(regeling));
  });

  it("6 termijnen: vijf keer € 416,67 en één keer € 416,65 — samen exact € 2.500", () => {
    const { ok, regeling } = buildRegeling(plan("termijnen", 6), oneOff(250_000), 21);
    assert.ok(ok);
    assert.deepEqual(regeling.termijnen.map((t) => t.exVatCents), [41_667, 41_667, 41_667, 41_667, 41_667, 41_665]);
    assert.equal(regeling.termijnen.reduce((s, t) => s + t.exVatCents, 0), 250_000);
    assert.equal(regeling.termijnen.reduce((s, t) => s + t.vatCents, 0), 52_500);
    assert.equal(regeling.termijnen.reduce((s, t) => s + t.inclVatCents, 0), 302_500);
  });
});

describe("2. afronding klopt altijd, ook bij rare bedragen", () => {
  it("elke kolom telt exact op, voor elk bedrag, aantal en btw-tarief", () => {
    const bedragen = [100_00, 999_99, 1_234_56, 2_500_00, 3_333_33, 12_345_67, 99_999_99];
    for (const bedrag of bedragen) {
      for (const vat of [0, 9, 21]) {
        for (const soort of ["50-50", "volledig"] as const) {
          const r = buildRegeling(plan(soort), oneOff(bedrag, vat), vat);
          assert.ok(regelingSluit(r.regeling), `${soort} ${bedrag} ${vat}%`);
        }
        for (let n = 2; n <= 36; n++) {
          const r = buildRegeling(plan("termijnen", n), oneOff(bedrag, vat), vat);
          assert.ok(regelingSluit(r.regeling), `termijnen ${n}× ${bedrag} ${vat}%`);
          if (r.ok) assert.ok(r.regeling.termijnen.every((t) => t.exVatCents > 0 && t.vatCents >= 0));
        }
      }
    }
  });

  it("splitEvenly verdeelt zonder cent verlies", () => {
    assert.deepEqual(splitEvenly(10_000, 3), [3_333, 3_333, 3_334]);
    assert.deepEqual(splitEvenly(100, 6), [17, 17, 17, 17, 17, 15]);
    assert.equal(splitEvenly(1, 1)[0], 1);
  });

  it("een termijn van een paar cent wordt geweigerd", () => {
    const r = buildRegeling(plan("termijnen", 12), oneOff(500), 21);
    assert.equal(r.ok, false);
    const leeg = buildRegeling(plan("termijnen", 6), oneOff(0), 21);
    assert.equal(leeg.ok, false);
  });
});

describe("3. de keuze komt alleen als keuze binnen", () => {
  it("onbekend of leeg is altijd de bestaande 50/50", () => {
    assert.equal(normalizePlan({}).soort, "50-50");
    assert.equal(normalizePlan({ soort: "gratis" }).soort, "50-50");
  });

  it("het aantal termijnen is vrij, maar begrensd", () => {
    assert.equal(normalizePlan({ soort: "termijnen", aantal: 7 }).aantal, 7);
    assert.equal(normalizePlan({ soort: "termijnen", aantal: 1 }).aantal, 2);
    assert.equal(normalizePlan({ soort: "termijnen", aantal: 999 }).aantal, 36);
    assert.equal(normalizePlan({ soort: "termijnen", aantal: "abc" }).aantal, 6);
  });

  it("een onmogelijke startdatum valt terug op ‘bij ondertekening’", () => {
    const p = normalizePlan({ soort: "termijnen", aantal: 6, start: "datum", startDatum: "2026-02-30" });
    assert.equal(p.start, "bij-akkoord");
    assert.equal(p.startDatum, null);
  });
});

describe("4. kalendermaanden, geen dertig dagen", () => {
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

  it("31 januari + 1, 2, 3 maanden = eind februari, 31 maart, 30 april", () => {
    const start = vanDatum("2026-01-31");
    assert.deepEqual([1, 2, 3].map((n) => iso(plusMaanden(start, n))), ["2026-02-28", "2026-03-31", "2026-04-30"]);
    assert.equal(iso(plusMaanden(vanDatum("2028-01-31"), 1)), "2028-02-29", "schrikkeljaar");
  });

  it("over de jaargrens en de zomertijd heen blijft het dezelfde kalenderdag", () => {
    const start = vanDatum("2026-10-15");
    const reeks = Array.from({ length: 6 }, (_, i) => plusMaanden(start, i));
    assert.deepEqual(reeks.map(iso), ["2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15", "2027-03-15"]);
    for (const d of reeks) {
      assert.equal(d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", day: "numeric" }), "15");
    }
  });

  it("de vervaldata van een schema: eerste bij ondertekening, daarna maandelijks", () => {
    const { regeling } = buildRegeling(plan("termijnen", 6), oneOff(250_000), 21);
    const data = vervaldata(regeling, ankerVoor(regeling, new Date("2026-10-15T09:30:00Z")));
    assert.deepEqual(data.map(iso), ["2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15", "2027-03-15"]);
  });

  it("bij 50/50 hangt de tweede termijn aan de oplevering", () => {
    const { regeling } = buildRegeling(plan("50-50"), oneOff(250_000), 21);
    const data = vervaldata(regeling, vanDatum("2026-10-15"));
    assert.equal(data[1], null);
  });

  it("een vaste startdatum telt, maar nooit vóór de ondertekening", () => {
    const p = { start: "datum" as const, startDatum: "2026-11-01" };
    assert.equal(iso(ankerVoor(p, new Date("2026-10-15T10:00:00Z"))), "2026-11-01");
    assert.equal(iso(ankerVoor(p, new Date("2026-11-20T10:00:00Z"))), "2026-11-20");
  });

  it("de ondertekendag is de Nederlandse kalenderdag", () => {
    // 23:30 UTC op 15 oktober is in Nederland al 16 oktober.
    assert.equal(iso(kalenderdagVan(new Date("2026-10-15T23:30:00Z"))), "2026-10-16");
  });
});

describe("5. statussen volgen uit de kalender", () => {
  const due = vanDatum("2026-12-15");
  const op = (dag: string) => new Date(`${dag}T12:00:00Z`);

  it("gepland → te betalen (14 dagen vooraf) → te laat (een week erna)", () => {
    const t = { status: "GEPLAND" as const, dueAt: due };
    assert.equal(termijnStatus(t, op("2026-11-20")), "gepland");
    assert.equal(termijnStatus(t, op("2026-12-01")), "te-betalen");
    assert.equal(termijnStatus(t, op("2026-12-22")), "te-betalen");
    assert.equal(termijnStatus(t, op("2026-12-23")), "te-laat");
  });

  it("betaald blijft betaald; een mislukte poging is zichtbaar; oplevering wacht", () => {
    assert.equal(termijnStatus({ status: "BETAALD", dueAt: due }, op("2027-06-01")), "betaald");
    assert.equal(termijnStatus({ status: "GEPLAND", dueAt: due, laatstePoging: "FAILED" }, op("2026-12-10")), "mislukt");
    assert.equal(termijnStatus({ status: "GEPLAND", dueAt: null }), "wacht-op-oplevering");
  });

  it("betalen gaat op volgorde: termijn 3 niet vóór termijn 2", () => {
    const alle = [
      { volgnummer: 1, status: "BETAALD" as const, dueAt: vanDatum("2026-10-15") },
      { volgnummer: 2, status: "GEPLAND" as const, dueAt: vanDatum("2026-11-15") },
      { volgnummer: 3, status: "GEPLAND" as const, dueAt: vanDatum("2026-12-15") },
    ];
    const nu = op("2026-12-10");
    assert.equal(isBetaalbaar(alle[1], alle, nu), true);
    assert.equal(isBetaalbaar(alle[2], alle, nu), false);
  });

  it("de voortgang: 2 van 6 betaald → € 833,34 betaald, € 1.666,66 open, volgende € 416,67", () => {
    const { regeling } = buildRegeling(plan("termijnen", 6), oneOff(250_000), 21);
    const data = vervaldata(regeling, vanDatum("2026-10-15"));
    const termijnen = regeling.termijnen.map((t, i) => ({
      ...t,
      status: (i < 2 ? "BETAALD" : "GEPLAND") as "BETAALD" | "GEPLAND",
      dueAt: data[i],
    }));
    const v = voortgang(termijnen, op("2026-11-20"));
    assert.equal(v.betaaldAantal, 2);
    assert.equal(v.betaaldExCents, 83_334);
    assert.equal(v.openExCents, 166_666);
    assert.equal(v.volgende?.exVatCents, 41_667);
    assert.equal(v.volgende?.volgnummer, 3);
    assert.equal(v.volledigBetaald, false);
  });
});

describe("6. de overeenkomst: 50/50 blijft letterlijk gelijk", () => {
  const basis: AgreementContext = {
    company: "Voorbeeld",
    modules: ["Website"],
    werkzaamheden: ["Bouwen"],
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
    subscriptionStartLabel: "De incasso van het maandbedrag start na oplevering van het project.",
  };

  it("zonder regeling of met 50/50: exact dezelfde tekst als vóór deze wijziging", () => {
    const oud = JSON.stringify(buildAgreement(basis, "dw-1.0"));
    const vijftig = JSON.stringify(
      buildAgreement({ ...basis, betaalregeling: { soort: "50-50", aantal: 2, eersteMoment: "na ondertekening", schema: [] } }, "dw-1.0"),
    );
    assert.equal(vijftig, oud);
    assert.match(oud, /De website gaat live nadat de tweede termijn is voldaan\./);
    assert.match(oud, /Hiervan is 50% \(€ 1\.512,50 inclusief btw\) verschuldigd bij het aangaan/);
    assert.match(oud, /geactiveerd bij de betaling van de tweede termijn/);
  });

  it("bij termijnen staat het schema in artikel 6.1 en staat het abonnement er los van", () => {
    const tekst = JSON.stringify(
      buildAgreement(
        {
          ...basis,
          betaalregeling: {
            soort: "termijnen",
            aantal: 6,
            eersteMoment: "na ondertekening",
            schema: ["termijn 1 van 6: € 416,67 exclusief btw (€ 504,17 inclusief btw), na ondertekening"],
          },
        },
        "dw-1.0",
      ),
    );
    assert.match(tekst, /in zes maandelijkse termijnen/);
    assert.match(tekst, /Betaalschema: termijn 1 van 6: € 416,67/);
    assert.match(tekst, /staat los van deze termijnen/);
    assert.doesNotMatch(tekst, /tweede termijn is voldaan/);
  });

  it("het akkoordvinkje noemt de gekozen regeling", () => {
    const labels = (r?: AgreementContext["betaalregeling"]) =>
      consentLabels({
        setupExclLabel: "€ 2.500,00",
        setupInclLabel: "€ 3.025,00",
        depositLabel: "€ 1.512,50",
        depositPercent: 50,
        finalLabel: "€ 1.512,50",
        finalPercent: 50,
        monthlyExclLabel: "€ 180,00",
        versionLabel: "v1",
        betaalregeling: r,
      }).agreesTermijnen;
    assert.match(labels(), /betaling in twee termijnen: 50%/);
    assert.match(labels({ soort: "volledig", aantal: 1, eersteMoment: "na ondertekening", schema: [] }), /in één keer \(€ 3\.025,00 incl\. btw\)/);
    assert.match(labels({ soort: "termijnen", aantal: 6, eersteMoment: "na ondertekening", schema: [] }), /in 6 maandelijkse termijnen/);
  });

  it("de startregel van het abonnement blijft bij 50/50 letterlijk gelijk", () => {
    assert.equal(
      subscriptionStartLabel("na-laatste-betaling"),
      "De incasso van het maandbedrag start na ontvangst van de tweede termijn.",
    );
    assert.match(subscriptionStartLabel("na-laatste-betaling", null, "termijnen"), /laatste termijn/);
  });
});

describe("7. de volgende stap voor de beheerder", () => {
  const basis: JourneySnapshot = {
    stage: "gestart",
    variant: "direct",
    commerceStatus: "BUILDING",
    demoVerstuurd: false,
    demoLinksKlaar: false,
    heeftConcept: false,
    voorstelVerstuurd: true,
    voorstelBekeken: true,
    voorstelGeaccepteerd: true,
    overeenkomstGetekend: true,
    aanbetalingBetaald: true,
    opleveringKlaar: true,
    restbetalingBetaald: false,
    mandaatActief: false,
    live: false,
    heeftAbonnement: true,
  };

  it("50/50 (en zonder schema) geeft exact dezelfde uitkomst als voorheen", () => {
    const zonder = nextAction(basis, "x");
    assert.deepEqual(nextAction({ ...basis, regeling: null }, "x"), zonder);
    assert.deepEqual(
      nextAction({ ...basis, regeling: { soort: "50-50", aantal: 2, betaaldAantal: 1, teLaatAantal: 0, allesBetaald: false, volgende: { volgnummer: 2, teLaat: false } } }, "x"),
      zonder,
    );
    assert.equal(zonder.cta?.action, "restbetaling-herinneren");
  });

  it("termijnen na oplevering: live zetten, ook met termijnen die nog lopen", () => {
    const stand = { soort: "termijnen" as const, aantal: 6, betaaldAantal: 3, teLaatAantal: 0, allesBetaald: false, volgende: { volgnummer: 4, teLaat: false } };
    const n = nextAction({ ...basis, mandaatActief: true, regeling: stand }, "x");
    assert.equal(n.cta?.action, "livegang");
    const live = nextAction({ ...basis, mandaatActief: true, live: true, regeling: stand }, "x");
    assert.equal(live.waitingOn, "niemand");
    assert.match(live.situatie, /3 van 6 termijnen betaald/);
  });

  it("een termijn te laat gaat voor alles", () => {
    const stand = { soort: "termijnen" as const, aantal: 6, betaaldAantal: 2, teLaatAantal: 1, allesBetaald: false, volgende: { volgnummer: 3, teLaat: true } };
    assert.equal(nextAction({ ...basis, live: true, mandaatActief: true, regeling: stand }, "x").cta?.action, "termijn-herinneren");
  });

  it("regelingStand leest het schema zoals het in de database staat", () => {
    const rijen = [
      { volgnummer: 1, aantal: 3, plan: "termijnen" as const, status: "BETAALD" as const, dueAt: vanDatum("2026-01-01") },
      { volgnummer: 2, aantal: 3, plan: "termijnen" as const, status: "GEPLAND" as const, dueAt: vanDatum("2026-02-01") },
      { volgnummer: 3, aantal: 3, plan: "termijnen" as const, status: "GEPLAND" as const, dueAt: vanDatum("2026-03-01") },
    ];
    const s = regelingStand(rijen, new Date("2026-02-20T12:00:00Z"));
    assert.deepEqual(s, { soort: "termijnen", aantal: 3, betaaldAantal: 1, teLaatAantal: 1, allesBetaald: false, volgende: { volgnummer: 2, teLaat: true } });
    assert.equal(regelingStand([]), null);
  });
});

describe("8. databasefouten herkennen door de Drizzle-verpakking heen", () => {
  it("vindt de unieke index in `cause`, niet in de melding", () => {
    const pg = Object.assign(new Error('duplicate key value violates unique constraint "documents_payment_idx"'), {
      code: "23505",
      constraint: "documents_payment_idx",
    });
    const drizzle = Object.assign(new Error("Failed query: insert into documents ..."), { cause: pg });
    assert.equal(isUniekeSchending(drizzle), true);
    assert.equal(isUniekeSchending(drizzle, "documents_payment_idx"), true);
    assert.equal(isUniekeSchending(drizzle, "documents_nummer_idx"), false);
    assert.equal(isUniekeSchending(new Error("timeout")), false);
  });
});
