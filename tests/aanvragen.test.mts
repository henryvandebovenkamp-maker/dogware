import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import {
  BAKJES,
  OPVOLGEN_NA_DAGEN,
  dagenTussen,
  leidAf,
  stagesVanBakje,
  telPerBakje,
  type AanvraagInput,
  type Bakje,
} from "@/lib/aanvragen";
import type { JourneySnapshot } from "@/lib/journey-next";

/**
 * De werkindeling van het aanvragenscherm.
 *
 * Het scherm moet één vraag beantwoorden: wie heeft vandaag mijn aandacht
 * nodig? Dat antwoord wordt hier afgeleid en niet ergens in een component
 * bij elkaar geraapt — vandaar dat het te testen valt zonder database.
 *
 * Wat hier vastligt:
 *   1. elke stage hoort in precies één bakje (een nieuwe stage kan niet
 *      stilletjes in een restcategorie verdwijnen);
 *   2. stilte na een verstuurde demo leidt tot opvolging, en reactie stopt dat;
 *   3. afgevallen en afgeronde aanvragen vragen nooit aandacht;
 *   4. de tellingen tellen op tot het totaal.
 */

const NU = new Date("2026-08-29T12:00:00Z");

/** Een snapshot waarin nog niets gebeurd is; per test aan te scherpen. */
function snapshot(over: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return {
    stage: "aangevraagd",
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

function aanvraag(over: Partial<AanvraagInput> = {}): AanvraagInput {
  const stage = over.stage ?? "aangevraagd";
  return {
    id: "11111111-1111-1111-1111-111111111111",
    stage,
    status: "nieuw",
    demoSentAt: null,
    laatsteContactAt: null,
    snapshot: snapshot({ stage }),
    ...over,
  };
}

/** Zoveel dagen geleden als een datum. */
function dagenGeleden(n: number): Date {
  return new Date(NU.getTime() - n * 24 * 60 * 60 * 1000);
}

describe("1. elke stage heeft precies één plek", () => {
  it("verdeelt alle twintig stages over de bakjes", () => {
    const gezien = new Set<JourneyStage>();
    for (const bakje of BAKJES) {
      for (const stage of stagesVanBakje(bakje)) {
        assert.ok(
          !gezien.has(stage),
          `${stage} zit in meer dan één bakje — dan telt hij dubbel in de balk.`,
        );
        gezien.add(stage);
      }
    }
    // "opvolgen" wordt afgeleid en heeft geen eigen stages; de rest dekt alles.
    assert.equal(
      gezien.size,
      JOURNEY_STAGES.length,
      "Niet elke stage heeft een bakje. Een nieuwe stage hoort in BAKJE_VOOR_STAGE.",
    );
  });

  it("houdt opvolgen leeg als stage-bakje, want het wordt afgeleid", () => {
    assert.deepEqual(stagesVanBakje("opvolgen"), []);
  });
});

describe("2. stilte na een verstuurde demo vraagt om opvolging", () => {
  const naDemo = (dagen: number, over: Partial<AanvraagInput> = {}) =>
    leidAf(
      aanvraag({
        stage: "demo-verstuurd",
        status: "demo verstuurd",
        demoSentAt: dagenGeleden(dagen),
        snapshot: snapshot({ stage: "demo-verstuurd", demoVerstuurd: true, demoLinksKlaar: true }),
        ...over,
      }),
      NU,
    );

  it("laat een verse demo met rust", () => {
    const a = naDemo(1);
    assert.equal(a.bakje, "demo-verstuurd");
    assert.equal(a.actieNodig, false);
  });

  it("vraagt na de wachttijd om opvolging", () => {
    const a = naDemo(OPVOLGEN_NA_DAGEN);
    assert.equal(a.bakje, "opvolgen");
    assert.equal(a.actieNodig, true);
    assert.match(a.reden, /nog geen reactie/);
    assert.equal(a.dagenSindsDemo, OPVOLGEN_NA_DAGEN);
  });

  it("stopt met opvolgen zodra er contact is geweest", () => {
    const a = naDemo(7, { laatsteContactAt: dagenGeleden(2) });
    assert.equal(a.bakje, "demo-verstuurd");
    assert.equal(a.actieNodig, false);
  });

  it("telt contact van vóór de demo niet mee", () => {
    // Het bevestigingsmailtje bij de aanvraag mag opvolging niet uitschakelen.
    const a = naDemo(7, { laatsteContactAt: dagenGeleden(9) });
    assert.equal(a.bakje, "opvolgen");
  });
});

describe("3. wat nooit om aandacht vraagt", () => {
  it("laat een afgevallen aanvraag met rust, ook na lange stilte", () => {
    const a = leidAf(
      aanvraag({
        stage: "demo-verstuurd",
        status: "afgevallen",
        demoSentAt: dagenGeleden(60),
        snapshot: snapshot({ stage: "demo-verstuurd", demoVerstuurd: true }),
      }),
      NU,
    );
    assert.equal(a.actieNodig, false);
    assert.equal(a.reden, "");
  });

  it("laat een actieve klant met rust", () => {
    const a = leidAf(
      aanvraag({
        stage: "actief",
        status: "klant geworden",
        demoSentAt: dagenGeleden(90),
        snapshot: snapshot({
          stage: "actief",
          demoVerstuurd: true,
          voorstelGeaccepteerd: true,
          overeenkomstGetekend: true,
          aanbetalingBetaald: true,
          restbetalingBetaald: true,
          mandaatActief: true,
          live: true,
        }),
      }),
      NU,
    );
    assert.equal(a.bakje, "klant");
    assert.equal(a.actieNodig, false);
  });
});

describe("4. de beheerder is aan zet", () => {
  it("markeert een nieuwe aanvraag als actie: het voorbeeld moet gemaakt", () => {
    const a = leidAf(aanvraag(), NU);
    assert.equal(a.bakje, "nieuw");
    assert.equal(a.actieNodig, true);
    assert.equal(a.actie.waitingOn, "admin");
  });

  it("markeert een klaarliggend concept-voorstel als actie", () => {
    const a = leidAf(
      aanvraag({
        stage: "offerte",
        status: "contact gehad",
        demoSentAt: dagenGeleden(10),
        laatsteContactAt: dagenGeleden(1),
        snapshot: snapshot({ stage: "offerte", demoVerstuurd: true, heeftConcept: true }),
      }),
      NU,
    );
    assert.equal(a.bakje, "voorstel");
    assert.equal(a.actieNodig, true);
  });

  it("laat een verstuurd voorstel wachten op de klant", () => {
    const a = leidAf(
      aanvraag({
        stage: "voorstel-verstuurd",
        status: "contact gehad",
        demoSentAt: dagenGeleden(14),
        laatsteContactAt: dagenGeleden(2),
        snapshot: snapshot({
          stage: "voorstel-verstuurd",
          demoVerstuurd: true,
          voorstelVerstuurd: true,
        }),
      }),
      NU,
    );
    assert.equal(a.bakje, "voorstel");
    assert.equal(a.actie.waitingOn, "klant");
    assert.equal(a.actieNodig, false);
  });
});

describe("5. de tellingen kloppen", () => {
  it("telt elke aanvraag precies één keer", () => {
    const bakjes: Bakje[] = ["nieuw", "nieuw", "opvolgen", "klant", "bouw"];
    const telling = telPerBakje(bakjes.map((bakje) => ({ bakje })));
    assert.equal(telling.nieuw, 2);
    assert.equal(telling.opvolgen, 1);
    assert.equal(telling.klant, 1);
    assert.equal(telling.bouw, 1);
    assert.equal(
      Object.values(telling).reduce((a, b) => a + b, 0),
      bakjes.length,
      "De balk mag nooit meer aanvragen tellen dan er zijn.",
    );
  });

  it("kent elk bakje, ook als het leeg is", () => {
    const telling = telPerBakje([]);
    for (const b of BAKJES) assert.equal(telling[b], 0);
  });
});

describe("6. dagen tellen zoals een mens dat doet", () => {
  it("rondt naar beneden af op hele dagen", () => {
    assert.equal(dagenTussen(new Date("2026-08-26T23:00:00Z"), NU), 2);
    assert.equal(dagenTussen(new Date("2026-08-29T11:00:00Z"), NU), 0);
  });
});
