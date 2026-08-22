import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  computeOneOff,
  computeOutstanding,
  euroFromCents,
  firstChargeDate,
  mayChargeSubscription,
  subscriptionSchedule,
  type CommercialConfig,
} from "../lib/money.ts";

/** Intl zet een harde spatie na het euroteken; die willen we niet meetesten. */
const eur = (cents: number) => euroFromCents(cents).replace(/\u00a0/g, " ");

/**
 * De bedragen van de commerciële journey.
 *
 * Deze test bestaat omdat geld het enige is waar een afrondingsfout meteen een
 * echt probleem is. De casus van The Happy Dogs staat er expliciet in, maar
 * uitsluitend als voorbeeld — de code zelf kent geen enkele klant.
 */

const HAPPY_DOGS: CommercialConfig = {
  projectCents: 250_000, // € 2.500 excl. btw
  setupCents: 0,
  discountType: "none",
  discountValue: 0,
  vatPercent: 21,
  depositPercent: 50,
  monthlyCents: 18_000, // € 180 excl. btw
  freeMonths: 0,
  introDiscountPercent: 0,
  introDiscountMonths: 0,
};

describe("1. de afspraak van € 2.500 excl. btw met 50/50", () => {
  const r = computeOneOff(HAPPY_DOGS);

  it("rekent 21% btw over € 2.500", () => {
    assert.equal(r.netExVatCents, 250_000);
    assert.equal(r.vatCents, 52_500);
    assert.equal(r.totalInclVatCents, 302_500);
    assert.equal(eur(r.totalInclVatCents), "€ 3.025,00");
  });

  it("splitst het totaal incl. btw netjes in twee helften", () => {
    assert.equal(r.depositCents, 151_250);
    assert.equal(r.finalCents, 151_250);
    assert.equal(r.depositCents + r.finalCents, r.totalInclVatCents);
  });

  it("leidt het tweede percentage af en laat het nooit los invoeren", () => {
    assert.equal(r.depositPercent, 50);
    assert.equal(r.finalPercent, 50);
  });

  it("berekent het maandbedrag incl. btw", () => {
    assert.equal(r.monthlyExVatCents, 18_000);
    assert.equal(r.monthlyVatCents, 3_780);
    assert.equal(r.monthlyInclVatCents, 21_780);
    assert.equal(eur(r.monthlyInclVatCents), "€ 217,80");
  });
});

describe("2. de twee termijnen tellen altijd op tot het totaal", () => {
  it("ook bij een oneven percentage en een oneven bedrag", () => {
    for (const pct of [0, 1, 33, 50, 67, 99, 100]) {
      for (const bedrag of [1, 99, 12_345, 250_000, 999_999]) {
        const r = computeOneOff({ ...HAPPY_DOGS, projectCents: bedrag, depositPercent: pct });
        assert.equal(
          r.depositCents + r.finalCents,
          r.totalInclVatCents,
          `termijnen lopen uiteen bij ${bedrag} cent en ${pct}%`,
        );
        assert.ok(r.finalCents >= 0, "de tweede termijn mag nooit negatief zijn");
      }
    }
  });
});

describe("3. korting werkt vóór de btw", () => {
  it("trekt een vast bedrag van het subtotaal af", () => {
    const r = computeOneOff({ ...HAPPY_DOGS, discountType: "amount", discountValue: 50_000 });
    assert.equal(r.discountCents, 50_000);
    assert.equal(r.netExVatCents, 200_000);
    assert.equal(r.vatCents, 42_000);
    assert.equal(r.totalInclVatCents, 242_000);
  });

  it("past een percentage toe en kan nooit onder nul komen", () => {
    const r = computeOneOff({ ...HAPPY_DOGS, discountType: "percent", discountValue: 200 });
    assert.equal(r.netExVatCents, 0, "een korting van >100% wordt afgekapt op het subtotaal");
    assert.equal(r.totalInclVatCents, 0);
  });

  it("kan met een kortingsbedrag groter dan het project geen negatief totaal maken", () => {
    const r = computeOneOff({ ...HAPPY_DOGS, discountType: "amount", discountValue: 999_999_99 });
    assert.equal(r.netExVatCents, 0);
    assert.equal(r.depositCents, 0);
    assert.equal(r.finalCents, 0);
  });
});

describe("4. het openstaande bedrag volgt wat er werkelijk betaald is", () => {
  it("is na de eerste termijn precies de tweede termijn", () => {
    const r = computeOneOff(HAPPY_DOGS);
    assert.equal(computeOutstanding(HAPPY_DOGS, r.depositCents), r.finalCents);
  });

  it("is nul na volledige betaling en wordt nooit negatief", () => {
    assert.equal(computeOutstanding(HAPPY_DOGS, 302_500), 0);
    assert.equal(computeOutstanding(HAPPY_DOGS, 999_999), 0);
  });

  it("valt terug op het volledige bedrag als er niets betaald is", () => {
    assert.equal(computeOutstanding(HAPPY_DOGS, 0), 302_500);
  });
});

describe("5. het abonnementsschema", () => {
  it("rekent gratis maanden en introkorting correct door", () => {
    const plan = subscriptionSchedule(
      { ...HAPPY_DOGS, freeMonths: 2, introDiscountPercent: 50, introDiscountMonths: 2 },
      6,
    );
    assert.equal(plan[0].amountInclVatCents, 0, "maand 1 gratis");
    assert.equal(plan[1].amountInclVatCents, 0, "maand 2 gratis");
    assert.equal(plan[2].amountInclVatCents, 10_890, "maand 3 met 50% korting");
    assert.equal(plan[4].amountInclVatCents, 21_780, "maand 5 volledig tarief");
  });
});

describe("6. het abonnement mag niet te vroeg incasseren", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");

  it("incasseert niet zonder startdatum", () => {
    assert.equal(
      mayChargeSubscription({ now: new Date("2030-01-01"), startAt: null, freeMonths: 0 }),
      false,
    );
  });

  it("incasseert niet vóór de startdatum", () => {
    assert.equal(
      mayChargeSubscription({ now: new Date("2026-08-31"), startAt: start, freeMonths: 0 }),
      false,
    );
  });

  it("incasseert wel vanaf de startdatum", () => {
    assert.equal(
      mayChargeSubscription({ now: new Date("2026-09-01"), startAt: start, freeMonths: 0 }),
      true,
    );
  });

  it("schuift de eerste incasso op met het aantal gratis maanden", () => {
    assert.equal(
      mayChargeSubscription({ now: new Date("2026-10-01"), startAt: start, freeMonths: 2 }),
      false,
      "met 2 gratis maanden mag er in oktober nog niet geïncasseerd worden",
    );
    assert.equal(
      mayChargeSubscription({ now: new Date("2026-11-01"), startAt: start, freeMonths: 2 }),
      true,
    );
  });
});

describe("7. de startdatum van het abonnement volgt de gekozen regel", () => {
  const basis = new Date(2026, 7, 22); // 22 augustus 2026

  it("start bij 'na-oplevering' op het referentiemoment zelf", () => {
    assert.equal(firstChargeDate("na-oplevering", basis).getTime(), basis.getTime());
  });

  it("start bij 'eerste-volgende-maand' op de eerste van de volgende maand", () => {
    const d = firstChargeDate("eerste-volgende-maand", basis);
    assert.equal(d.getMonth(), 8, "september");
    assert.equal(d.getDate(), 1);
  });

  it("gebruikt bij 'handmatig' de opgegeven datum", () => {
    const gekozen = new Date(2027, 0, 15);
    assert.equal(firstChargeDate("handmatig", basis, gekozen).getTime(), gekozen.getTime());
  });
});
