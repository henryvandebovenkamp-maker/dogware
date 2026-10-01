import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  eindeVanDag,
  isKalenderdatum,
  isVoorstelVerlopen,
  kalenderdag,
  nieuweGeldigheid,
  standaardGeldigTot,
  vervaltOp,
} from "../lib/proposal-geldigheid.ts";
import { overeenkomstPoort } from "../lib/journey-variant.ts";
import { nextAction, type JourneySnapshot } from "../lib/journey-next.ts";

/**
 * De geldigheid van een voorstel — de regel achter de live fout waarbij een
 * klant "Dit voorstel is verlopen" zag en niet verder kon.
 *
 *  - Een geldigheidsdatum is een Nederlandse kalenderdag, tot en met 23:59.
 *  - Alleen een nog NIET geaccepteerd voorstel kan verlopen. Na acceptatie
 *    speelt de datum geen enkele rol meer: overeenkomst, ondertekening en
 *    betaling kijken er nooit naar.
 */

const OPEN = { status: "VIEWED", acceptedAt: null };

describe("een geldigheidsdatum is een Nederlandse kalenderdag", () => {
  it("einde van de dag in de zomer: 23:59:59.999 CEST = 21:59:59.999 UTC", () => {
    assert.equal(eindeVanDag("2026-09-30")?.toISOString(), "2026-09-30T21:59:59.999Z");
  });

  it("einde van de dag in de winter: 23:59:59.999 CET = 22:59:59.999 UTC", () => {
    assert.equal(eindeVanDag("2026-12-15")?.toISOString(), "2026-12-15T22:59:59.999Z");
  });

  it("rond de zomertijdwissel klopt de dag ook", () => {
    assert.equal(eindeVanDag("2026-03-29")?.toISOString(), "2026-03-29T21:59:59.999Z");
    assert.equal(eindeVanDag("2026-10-25")?.toISOString(), "2026-10-25T22:59:59.999Z");
  });

  it("de kalenderdag van een laat UTC-tijdstip is in Nederland al de volgende dag", () => {
    assert.equal(kalenderdag(new Date("2026-09-30T22:30:00Z")), "2026-10-01");
    assert.equal(kalenderdag(new Date("2026-09-30T21:30:00Z")), "2026-09-30");
  });

  it("onzin is geen datum", () => {
    assert.equal(isKalenderdatum("2026-02-30"), false);
    assert.equal(isKalenderdatum("30-09-2026"), false);
    assert.equal(isKalenderdatum(""), false);
    assert.equal(eindeVanDag("2026-13-01"), null);
  });

  it("een nieuw voorstel is standaard geldig tot het einde van de dag, over 30 dagen", () => {
    const nu = new Date("2026-08-31T08:15:00Z");
    assert.equal(standaardGeldigTot(nu).toISOString(), "2026-09-30T21:59:59.999Z");
  });
});

describe("verlopen vóór acceptatie", () => {
  // Opgeslagen zoals de oude code het deed: aanmaakmoment + 30 dagen, midden op de dag.
  const geldigTot = new Date("2026-09-30T08:15:00Z");

  it("de klant krijgt de hele dag die op zijn scherm staat", () => {
    assert.equal(vervaltOp({ geldigTot })?.toISOString(), "2026-09-30T21:59:59.999Z");
    assert.equal(isVoorstelVerlopen({ ...OPEN, geldigTot }, new Date("2026-09-30T20:00:00Z")), false);
  });

  it("na middernacht (Nederlandse tijd) is een niet-geaccepteerd voorstel verlopen", () => {
    assert.equal(isVoorstelVerlopen({ ...OPEN, geldigTot }, new Date("2026-09-30T22:00:01Z")), true);
    assert.equal(isVoorstelVerlopen({ ...OPEN, geldigTot }, new Date("2026-10-01T10:00:00Z")), true);
  });

  it("zonder geldigheidsdatum verloopt een voorstel nooit", () => {
    assert.equal(isVoorstelVerlopen({ ...OPEN, geldigTot: null }, new Date("2030-01-01")), false);
  });
});

describe("een geaccepteerd voorstel verloopt nooit", () => {
  const geldigTot = new Date("2026-09-30T08:15:00Z");
  const jarenLater = new Date("2029-01-01T00:00:00Z");

  it("niet op acceptatiemoment", () => {
    const p = { status: "ACCEPTED", acceptedAt: new Date("2026-09-30T19:00:00Z"), geldigTot };
    assert.equal(isVoorstelVerlopen(p, jarenLater), false);
  });

  it("ook niet als alleen de status het zegt, of alleen het moment", () => {
    assert.equal(isVoorstelVerlopen({ status: "ACCEPTED", acceptedAt: null, geldigTot }, jarenLater), false);
    assert.equal(
      isVoorstelVerlopen({ status: "VIEWED", acceptedAt: new Date("2026-09-29"), geldigTot }, jarenLater),
      false,
    );
  });
});

describe("verlengen: alleen naar vandaag of later, en niet onbeperkt", () => {
  const nu = new Date("2026-10-01T09:00:00Z");

  it("vandaag mag, en wordt het einde van vandaag", () => {
    const r = nieuweGeldigheid("2026-10-01", nu);
    assert.ok(r.ok);
    assert.equal(r.geldigTot.toISOString(), "2026-10-01T21:59:59.999Z");
  });

  it("gisteren mag niet", () => {
    const r = nieuweGeldigheid("2026-09-30", nu);
    assert.equal(r.ok, false);
  });

  it("verder dan een jaar mag niet; een ongeldige datum ook niet", () => {
    assert.equal(nieuweGeldigheid("2027-10-02", nu).ok, false);
    assert.equal(nieuweGeldigheid("2027-10-01", nu).ok, true);
    assert.equal(nieuweGeldigheid("morgen", nu).ok, false);
  });
});

describe("de poortwachter van de overeenkomst negeert de datum na acceptatie", () => {
  const verlopenDatum = new Date("2026-09-30T08:15:00Z");
  const nu = new Date("2026-10-01T10:00:00Z");
  const basis = { id: "p1", sentAt: new Date("2026-08-31"), geldigTot: verlopenDatum };

  it("demo: geaccepteerd vóór de vervaldatum → de dag erna gewoon tekenen", () => {
    const p = { ...basis, status: "ACCEPTED" as const, acceptedAt: new Date("2026-09-30T19:00:00Z") };
    assert.deepEqual(overeenkomstPoort("demo", p, null, nu), { ok: true });
  });

  it("direct: getekend (= geaccepteerd) → de datum doet er niet meer toe", () => {
    const p = { ...basis, status: "ACCEPTED" as const, acceptedAt: new Date("2026-09-30T19:00:00Z") };
    assert.deepEqual(overeenkomstPoort("direct", p, { proposalId: "p1", status: "SIGNED" }, nu), { ok: true });
  });

  it("direct: niet getekend en verlopen → menselijke melding, geen 'proposal expired'", () => {
    const p = { ...basis, status: "VIEWED" as const, acceptedAt: null };
    const r = overeenkomstPoort("direct", p, null, nu);
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.reden : "", /niet meer actief.*contact/);
  });

  it("direct: niet getekend maar de laatste geldige dag is nog bezig → tekenen mag", () => {
    const p = { ...basis, status: "VIEWED" as const, acceptedAt: null };
    assert.deepEqual(overeenkomstPoort("direct", p, null, new Date("2026-09-30T21:00:00Z")), { ok: true });
  });
});

describe("de admin ziet een verlopen voorstel als eigen actie", () => {
  const basis: JourneySnapshot = {
    stage: "voorstel-verstuurd",
    commerceStatus: "PROPOSAL_SENT",
    demoVerstuurd: true,
    demoLinksKlaar: true,
    heeftConcept: false,
    voorstelVerstuurd: true,
    voorstelBekeken: true,
    voorstelGeaccepteerd: false,
    overeenkomstGetekend: false,
    aanbetalingBetaald: false,
    opleveringKlaar: false,
    restbetalingBetaald: false,
    mandaatActief: false,
    live: false,
    heeftAbonnement: true,
  };

  it("verlopen → beheerder aan zet met 'Geldigheid verlengen', niet 'herinnering sturen'", () => {
    const a = nextAction({ ...basis, voorstelVerlopen: true }, "lead-1");
    assert.equal(a.waitingOn, "admin");
    assert.equal(a.cta?.action, "geldigheid-verlengen");
    assert.equal(a.cta?.href, "/admin/leads/lead-1#voorstel");
  });

  it("ook voor een directe klant", () => {
    const a = nextAction({ ...basis, variant: "direct", voorstelVerlopen: true }, "lead-1");
    assert.equal(a.cta?.action, "geldigheid-verlengen");
  });

  it("geaccepteerd gaat altijd vóór verlopen", () => {
    const a = nextAction({ ...basis, voorstelGeaccepteerd: true, voorstelVerlopen: true }, "lead-1");
    assert.equal(a.cta?.action, "overeenkomst-herinneren");
  });

  it("zonder het nieuwe veld verandert er niets voor bestaande aanroepen", () => {
    assert.equal(nextAction(basis, "lead-1").cta?.action, "voorstel-herinneren");
  });
});
