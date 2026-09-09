import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  kenToe,
  mergeTouch,
  normalizeReferralCode,
  parseReferralCookie,
  partnerCanRefer,
  resterendeSeconden,
  schoneLandingspagina,
  schoneUtm,
  schoneVerwijzer,
  vensterOpen,
  type PartnerToestand,
  type ReferralCookie,
  type Touch,
} from "../lib/referral-attributie.ts";
import type { PartnerStatus } from "../lib/db/schema.ts";
import { REFERRAL_WINDOW_DAYS, REFERRAL_WINDOW_MS } from "../lib/referral-config.ts";
import { commissieFase } from "../lib/commissie.ts";

/**
 * Referral-attributie.
 *
 * De regel die hier bewaakt wordt is commercieel, niet technisch: de partner
 * die een bezoeker binnenbracht houdt die aanbreng, ook als de bezoeker pas
 * weken later — rechtstreeks, of via een andere partnerlink — een demo
 * aanvraagt. Gaat dat stuk, dan verdwijnt er stilletjes geld van iemands
 * rekening zonder dat een foutmelding het verraadt.
 *
 * De scenario's hieronder zijn de reis van een echte bezoeker, in de volgorde
 * waarin die zich voordoet.
 */

const DAG = 86_400_000;
const T0 = Date.parse("2026-09-09T10:00:00Z");

const DEBBY: Touch = {
  partnerId: "11111111-1111-1111-1111-111111111111",
  referralCode: "DEBBY01",
  clickId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  at: T0,
};
const SANNE: Touch = {
  partnerId: "22222222-2222-2222-2222-222222222222",
  referralCode: "SANNE02",
  clickId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  at: T0 + 3 * DAG,
};

/** De rondgang die de cookie in het echt maakt: schrijven, lezen, teruglezen. */
function heenEnWeer(cookie: ReferralCookie): ReferralCookie {
  const gelezen = parseReferralCookie(JSON.stringify(cookie));
  assert.ok(gelezen, "cookie moet leesbaar terugkomen");
  return gelezen;
}

describe("het attributievenster", () => {
  it("staat standaard op 60 dagen", () => {
    assert.equal(REFERRAL_WINDOW_DAYS, 60);
  });

  it("telt vanaf het eerste bezoek en verlengt niet bij een volgend bezoek", () => {
    const eerste = mergeTouch(null, DEBBY);
    const later = mergeTouch(eerste, { ...DEBBY, at: T0 + 30 * DAG });

    // De vervaldatum ligt nog steeds 60 dagen na de eerste aanraking.
    assert.equal(later.t, T0);
    const overNa30Dagen = resterendeSeconden(later, T0 + 30 * DAG);
    assert.equal(overNa30Dagen, (REFERRAL_WINDOW_MS - 30 * DAG) / 1000);
  });

  it("laat de koppeling vervallen zodra het venster voorbij is", () => {
    const cookie = mergeTouch(null, DEBBY);
    assert.equal(vensterOpen(cookie, T0 + 59 * DAG), true);
    assert.equal(vensterOpen(cookie, T0 + 61 * DAG), false);
    assert.equal(resterendeSeconden(cookie, T0 + 61 * DAG), 0);
  });
});

describe("scenario 1 — bezoek via de partnerlink, meteen een demo aanvragen", () => {
  it("koppelt de aanvraag aan die partner", () => {
    const cookie = heenEnWeer(mergeTouch(null, DEBBY));
    assert.equal(cookie.p, DEBBY.partnerId);
    assert.equal(cookie.c, "DEBBY01");
    assert.equal(cookie.k, DEBBY.clickId);
    assert.equal(vensterOpen(cookie, T0 + 60_000), true);
  });
});

describe("scenario 2 en 3 — de bezoeker komt later rechtstreeks terug", () => {
  it("houdt de partner vast, ook zeven dagen later", () => {
    const cookie = heenEnWeer(mergeTouch(null, DEBBY));
    // Een rechtstreeks bezoek raakt de cookie niet aan; hij wordt alleen gelezen.
    assert.equal(vensterOpen(cookie, T0 + 7 * DAG), true);
    assert.equal(cookie.p, DEBBY.partnerId);
  });

  it("houdt de partner vast tot en met de laatste dag van het venster", () => {
    const cookie = mergeTouch(null, DEBBY);
    assert.equal(vensterOpen(cookie, T0 + REFERRAL_WINDOW_MS), true);
  });
});

describe("scenario 4 — een tweede partnerlink", () => {
  it("laat de eerste partner eigenaar en bewaart de tweede als last touch", () => {
    const cookie = heenEnWeer(mergeTouch(mergeTouch(null, DEBBY), SANNE));

    assert.equal(cookie.p, DEBBY.partnerId, "first touch blijft van Debby");
    assert.equal(cookie.t, T0);
    assert.equal(cookie.lp, SANNE.partnerId, "Sanne is wel de laatste aanraking");
    assert.equal(cookie.lt, SANNE.at);
  });

  it("begint pas opnieuw wanneer het venster van de eerste verlopen is", () => {
    const laat = { ...SANNE, at: T0 + 70 * DAG };
    const cookie = mergeTouch(mergeTouch(null, DEBBY), laat);
    assert.equal(cookie.p, SANNE.partnerId, "na 70 dagen is de reis opnieuw begonnen");
    assert.equal(cookie.t, laat.at);
  });
});

describe("scenario 10 — dezelfde bezoeker opent dezelfde link opnieuw", () => {
  it("levert geen tweede eerste-aanraking op", () => {
    const eerste = mergeTouch(null, DEBBY);
    const opnieuw = mergeTouch(eerste, { ...DEBBY, at: T0 + 2 * DAG });

    assert.equal(opnieuw.p, DEBBY.partnerId);
    assert.equal(opnieuw.t, T0, "de eerste aanraking blijft het startpunt");
    assert.equal(opnieuw.lp, DEBBY.partnerId);
    assert.equal(opnieuw.lt, T0 + 2 * DAG, "alleen het laatste bezoek schuift op");
  });
});

describe("een cookie uit de vorige versie", () => {
  it("blijft gelden en telt als eerste aanraking", () => {
    // Zo zag de cookie eruit vóór first touch: één aanraking, geen versie.
    const oud = JSON.stringify({ p: DEBBY.partnerId, c: "DEBBY01", k: DEBBY.clickId, t: T0 });
    const cookie = parseReferralCookie(oud);
    assert.ok(cookie);
    assert.equal(cookie.p, DEBBY.partnerId);
    assert.equal(cookie.lp, DEBBY.partnerId, "zonder last touch is de eerste ook de laatste");
    assert.equal(cookie.t, T0);
  });

  it("neemt een nieuwe partner niet over als last touch overschrijving", () => {
    const oud = parseReferralCookie(
      JSON.stringify({ p: DEBBY.partnerId, c: "DEBBY01", k: null, t: T0 }),
    );
    assert.ok(oud);
    const na = mergeTouch(oud, SANNE);
    assert.equal(na.p, DEBBY.partnerId);
  });
});

describe("een cookie die niet klopt", () => {
  it("levert geen attributie op in plaats van een fout", () => {
    for (const rommel of [
      "",
      "geen json",
      "{}",
      '{"p":"","c":"X","t":1}',
      '{"p":"id","c":"X"}',
      '{"p":"id","c":"X","t":"morgen"}',
      "[1,2,3]",
      "null",
    ]) {
      assert.equal(parseReferralCookie(rommel), null, `moet null zijn: ${rommel}`);
    }
  });
});

describe("scenario 5 — een code die niet bestaat", () => {
  it("wordt herkend als onbruikbaar en levert nooit een halve code op", () => {
    // Vorm eerst: alleen wat op een code lijkt komt langs de database.
    assert.equal(normalizeReferralCode("debby"), "DEBBY");
    assert.equal(normalizeReferralCode("  debby  "), "DEBBY");
    for (const onzin of ["", "a", "ab", "../etc", "code met spatie", "<script>"]) {
      assert.equal(normalizeReferralCode(onzin), null, `moet geweigerd worden: ${onzin}`);
    }
  });
});

describe("wat we van een bezoek bewaren", () => {
  it("neemt alleen de vaste utm-parameters over, begrensd", () => {
    const params = new URLSearchParams({
      utm_source: "nieuwsbrief",
      utm_medium: "affiliate",
      utm_campaign: "september",
      // Een zelfbedachte sleutel mag geen kolom in onze database worden.
      utm_verzonnen: "kwaad",
      ref: "DEBBY01",
    });
    params.set("utm_term", "x".repeat(500));

    const utm = schoneUtm(params);
    assert.deepEqual(Object.keys(utm ?? {}).sort(), [
      "utm_campaign",
      "utm_medium",
      "utm_source",
      "utm_term",
    ]);
    assert.equal(utm?.utm_source, "nieuwsbrief");
    assert.equal(utm?.utm_term?.length, 120);
  });

  it("bewaart niets wanneer er geen campagne in de link staat", () => {
    assert.equal(schoneUtm(new URLSearchParams({ ref: "DEBBY01" })), null);
    assert.equal(schoneUtm(undefined), null);
  });

  it("accepteert alleen een intern pad als landingspagina", () => {
    assert.equal(schoneLandingspagina("/hondenschool"), "/hondenschool");
    assert.equal(schoneLandingspagina("/"), "/");
    assert.equal(schoneLandingspagina("//kwaadaardig.nl"), null);
    assert.equal(schoneLandingspagina("https://kwaadaardig.nl"), null);
    assert.equal(schoneLandingspagina("/pad\\met\\backslash"), null);
    assert.equal(schoneLandingspagina(null), null);
  });

  it("houdt de zoekopdracht uit de verwijzende bron", () => {
    assert.equal(
      schoneVerwijzer("https://www.google.com/search?q=iets+persoonlijks"),
      "https://www.google.com/search",
    );
    assert.equal(schoneVerwijzer("javascript:alert(1)"), null);
    assert.equal(schoneVerwijzer("geen url"), null);
    assert.equal(schoneVerwijzer(null), null);
  });

  it("zet niets persoonlijks in de cookie", () => {
    const cookie = mergeTouch(mergeTouch(null, DEBBY), SANNE);
    // Alleen id's, codes en tijdstippen — geen naam, e-mail of landingspagina.
    assert.deepEqual(Object.keys(cookie).sort(), [
      "c", "k", "lc", "lk", "lp", "lt", "p", "t", "v",
    ]);
  });
});

/** De partnerlijst zoals getValidAttribution die uit de database haalt. */
function partners(...rijen: PartnerToestand[]): Map<string, PartnerToestand> {
  return new Map(rijen.map((r) => [r.id, r]));
}

const debbyRij = (status: PartnerStatus): PartnerToestand => ({
  id: DEBBY.partnerId,
  status,
  referralCode: "DEBBY01",
});
const sanneRij = (status: PartnerStatus): PartnerToestand => ({
  id: SANNE.partnerId,
  status,
  referralCode: "SANNE02",
});

describe("wie de aanvraag krijgt", () => {
  const beide = mergeTouch(mergeTouch(null, DEBBY), SANNE);

  it("geeft hem aan de partner die de bezoeker binnenbracht", () => {
    const uitkomst = kenToe(beide, partners(debbyRij("ACTIVE"), sanneRij("ACTIVE")));
    assert.equal(uitkomst?.partnerId, DEBBY.partnerId);
    assert.equal(uitkomst?.model, "FIRST_TOUCH");
    assert.equal(uitkomst?.clickId, DEBBY.clickId);
  });

  it("laat een net uitgenodigde partner meteen meedoen", () => {
    const alleen = mergeTouch(null, DEBBY);
    assert.equal(kenToe(alleen, partners(debbyRij("INVITED")))?.model, "FIRST_TOUCH");
  });

  it("gebruikt de code uit de database, niet die uit de cookie", () => {
    // De partner is hernoemd sinds het bezoek; de aanvraag moet de nieuwe
    // code vastleggen, anders klopt de snapshot niet meer met de partner.
    const hernoemd = { ...debbyRij("ACTIVE"), referralCode: "DEBBY99" };
    assert.equal(kenToe(beide, partners(hernoemd, sanneRij("ACTIVE")))?.referralCode, "DEBBY99");
  });
});

describe("scenario 6 — de partner is inmiddels gedeactiveerd", () => {
  it("kent niets toe wanneer er geen andere geldige aanbrenger is", () => {
    const alleen = mergeTouch(null, DEBBY);
    for (const status of ["PAUSED", "BLOCKED", "ENDED"] as const) {
      assert.equal(partnerCanRefer(status), false, status);
      assert.equal(kenToe(alleen, partners(debbyRij(status))), null, status);
    }
  });

  it("kent niets toe wanneer de partner helemaal verdwenen is", () => {
    assert.equal(kenToe(mergeTouch(null, DEBBY), partners()), null);
  });

  it("schuift door naar de laatste geldige partnerlink als die er is", () => {
    const beide = mergeTouch(mergeTouch(null, DEBBY), SANNE);
    const uitkomst = kenToe(beide, partners(debbyRij("BLOCKED"), sanneRij("ACTIVE")));
    assert.equal(uitkomst?.partnerId, SANNE.partnerId);
    assert.equal(uitkomst?.model, "LAST_VALID_REFERRAL");
    assert.equal(uitkomst?.clickId, SANNE.clickId, "dan hoort ook die klik erbij");
  });

  it("schuift niet door naar dezelfde geblokkeerde partner", () => {
    // Eén partner, twee bezoeken: de terugval mag hem niet alsnog binnenlaten.
    const zelfde = mergeTouch(mergeTouch(null, DEBBY), { ...DEBBY, at: T0 + DAG });
    assert.equal(kenToe(zelfde, partners(debbyRij("BLOCKED"))), null);
  });
});

describe("scenario 9 — een mislukte betaling die later alsnog slaagt", () => {
  it("levert nooit twee keer commissie op, want de fase hangt aan de aanvraag", () => {
    // De fase volgt de journey van de aanvraag, niet het aantal betaalpogingen.
    assert.equal(commissieFase("aanbetaling", "klant geworden"), "gereserveerd");
    assert.equal(commissieFase("gestart", "klant geworden"), "verdiend");
    // Twee keer dezelfde stage lezen geeft twee keer hetzelfde antwoord.
    assert.equal(
      commissieFase("gestart", "klant geworden"),
      commissieFase("gestart", "klant geworden"),
    );
  });

  it("laat een afgevallen aanvraag nergens meer meetellen", () => {
    assert.equal(commissieFase("gestart", "afgevallen"), "vervallen");
    assert.equal(commissieFase("aangevraagd", "nieuw"), "geen");
  });

  it("blijft meetellen tot en met de laatste stap van de journey", () => {
    for (const stage of ["gestart", "revisies", "oplevering", "restbetaling", "mandaat", "live", "actief"] as const) {
      assert.equal(commissieFase(stage, "klant geworden"), "verdiend", stage);
    }
  });
});
