import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  afspraakOverzicht,
  berekenAfspraak,
  euroInvoerNaarCenten,
  leesAfspraak,
  type AfspraakInvoer,
} from "../lib/betaalafspraak.ts";
import { regelingSluit } from "../lib/payment-plan.ts";

/**
 * Acceptatie: € 2.500 excl. btw, 21% btw — € 3.025 incl. btw — in elke
 * betaalregeling. Invoer gaat door dezelfde lezer als de server-action en de
 * live preview in de editor, dus wat hier klopt, klopt op alle drie de plekken.
 */

const BASIS = { freeMonths: 0, introDiscountPercent: 0, introDiscountMonths: 0 };
const invoer = (over: Partial<AfspraakInvoer> = {}): AfspraakInvoer => ({
  project: "2500",
  setup: "0",
  discountType: "none",
  discountValue: "0",
  vat: "21",
  depositPercent: "50",
  monthly: "180",
  paymentPlan: "50-50",
  installmentCount: "6",
  installmentStart: "bij-akkoord",
  installmentStartDate: "",
  ...over,
});
const reken = (over: Partial<AfspraakInvoer>) => {
  const { config, plan } = leesAfspraak(invoer(over), BASIS);
  return berekenAfspraak(config, plan);
};
const incl = (r: ReturnType<typeof reken>) => r.regeling.termijnen.map((t) => t.inclVatCents);
const som = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("€ 2.500 excl. btw, 21% btw", () => {
  it("de basis: € 2.500 + € 525 btw = € 3.025 incl. btw", () => {
    const { computed } = reken({});
    assert.equal(computed.netExVatCents, 250_000);
    assert.equal(computed.vatCents, 52_500);
    assert.equal(computed.totalInclVatCents, 302_500);
  });

  it("50/50: € 1.512,50 bij start en € 1.512,50 bij oplevering", () => {
    const r = reken({ paymentPlan: "50-50" });
    assert.equal(r.fout, null);
    assert.equal(r.regeling.soort, "50-50");
    assert.deepEqual(incl(r), [151_250, 151_250]);
    assert.deepEqual(r.regeling.termijnen.map((t) => t.moment), ["akkoord", "oplevering"]);
    assert.ok(regelingSluit(r.regeling));
  });

  it("50/50 volgt het ingestelde percentage (30/70), niet een vaste 50", () => {
    const r = reken({ paymentPlan: "50-50", depositPercent: "30" });
    assert.deepEqual(incl(r), [90_750, 211_750]);
    assert.equal(som(incl(r)), 302_500);
  });

  it("in één keer: één betaling van € 3.025,00 incl. btw", () => {
    const r = reken({ paymentPlan: "volledig" });
    assert.equal(r.regeling.soort, "volledig");
    assert.deepEqual(incl(r), [302_500]);
    assert.ok(regelingSluit(r.regeling));
  });

  it("5 termijnen: 5 × € 605,00 incl. btw, samen exact € 3.025,00", () => {
    const r = reken({ paymentPlan: "termijnen", installmentCount: "5" });
    assert.equal(r.fout, null);
    assert.equal(r.regeling.soort, "termijnen");
    assert.deepEqual(incl(r), [60_500, 60_500, 60_500, 60_500, 60_500]);
    assert.deepEqual(r.regeling.termijnen.map((t) => t.exVatCents), [50_000, 50_000, 50_000, 50_000, 50_000]);
    assert.equal(som(incl(r)), 302_500);
    assert.ok(regelingSluit(r.regeling));
  });

  it("6 termijnen: 5 × € 504,17 + € 504,15 — samen exact € 3.025,00", () => {
    const r = reken({ paymentPlan: "termijnen", installmentCount: "6" });
    assert.deepEqual(incl(r), [50_417, 50_417, 50_417, 50_417, 50_417, 50_415]);
    assert.equal(som(incl(r)), 302_500);
    assert.equal(som(r.regeling.termijnen.map((t) => t.exVatCents)), 250_000);
    assert.equal(som(r.regeling.termijnen.map((t) => t.vatCents)), 52_500);
    assert.ok(regelingSluit(r.regeling));
  });

  it("12 termijnen: 11 × € 252,08 + € 252,12 — samen exact € 3.025,00", () => {
    const r = reken({ paymentPlan: "termijnen", installmentCount: "12" });
    assert.deepEqual(incl(r), [...Array(11).fill(25_208), 25_212]);
    assert.equal(som(incl(r)), 302_500);
    assert.equal(som(r.regeling.termijnen.map((t) => t.exVatCents)), 250_000);
    assert.equal(som(r.regeling.termijnen.map((t) => t.vatCents)), 52_500);
    assert.ok(regelingSluit(r.regeling));
  });

  it("elk aantal van 2 t/m 36: termijnen incl. btw tellen exact op, alleen de laatste wijkt af", () => {
    for (let n = 2; n <= 36; n++) {
      const r = reken({ paymentPlan: "termijnen", installmentCount: String(n) });
      const delen = incl(r);
      assert.equal(delen.length, n);
      assert.equal(som(delen), 302_500, `n=${n}`);
      assert.ok(delen.slice(0, -1).every((d) => d === delen[0]), `n=${n}`);
      assert.ok(regelingSluit(r.regeling), `n=${n}`);
    }
  });

  for (const [n, verwachtIncl, verwachtEx] of [
    [2, [151_250, 151_250], [125_000, 125_000]],
    [3, [100_833, 100_833, 100_834], [83_333, 83_333, 83_334]],
    [5, [60_500, 60_500, 60_500, 60_500, 60_500], [50_000, 50_000, 50_000, 50_000, 50_000]],
    [6, [50_417, 50_417, 50_417, 50_417, 50_417, 50_415], [41_667, 41_667, 41_667, 41_667, 41_667, 41_665]],
    [12, [...Array(11).fill(25_208), 25_212], [...Array(11).fill(20_833), 20_837]],
  ] as const) {
    it(`${n} termijnen: netto € 2.500,00 + btw € 525,00 = € 3.025,00, per termijn én opgeteld`, () => {
      const r = reken({ paymentPlan: "termijnen", installmentCount: String(n) });
      const t = r.regeling.termijnen;
      assert.deepEqual(t.map((x) => x.inclVatCents), verwachtIncl);
      assert.deepEqual(t.map((x) => x.exVatCents), verwachtEx);
      assert.equal(som(t.map((x) => x.exVatCents)), 250_000, "som netto");
      assert.equal(som(t.map((x) => x.vatCents)), 52_500, "som btw");
      assert.equal(som(t.map((x) => x.inclVatCents)), 302_500, "som incl.");
      for (const x of t) {
        assert.equal(x.exVatCents + x.vatCents, x.inclVatCents, "elke termijn sluit op zichzelf");
        // De btw per termijn wijkt hooguit een paar cent af van 21% van het netto deel.
        assert.ok(Math.abs(x.vatCents - (x.exVatCents * 21) / 100) <= n, `btw termijn ${x.volgnummer}`);
      }
    });
  }

  it("eigenschap: voor veel bedragen, btw-percentages en aantallen sluiten netto, btw en incl. exact", () => {
    const bedragen = [100_00, 999_99, 1_234_56, 2_500_00, 3_333_33, 7_777_77, 12_345_67, 99_999_99];
    for (const netto of bedragen) {
      for (const btw of [0, 9, 21]) {
        for (const plan of ["50-50", "volledig", "termijnen"] as const) {
          for (const n of plan === "termijnen" ? [2, 3, 5, 6, 7, 11, 12, 24, 36] : [0]) {
            for (const aanbetaling of plan === "50-50" ? [50, 30, 33] : [50]) {
              const r = reken({
                project: (netto / 100).toFixed(2),
                vat: String(btw),
                paymentPlan: plan,
                installmentCount: String(n),
                depositPercent: String(aanbetaling),
              });
              const t = r.regeling.termijnen;
              const ctx = `netto=${netto} btw=${btw} ${plan} n=${n} dep=${aanbetaling}`;
              assert.equal(som(t.map((x) => x.exVatCents)), r.computed.netExVatCents, ctx);
              assert.equal(som(t.map((x) => x.vatCents)), r.computed.vatCents, ctx);
              assert.equal(som(t.map((x) => x.inclVatCents)), r.computed.totalInclVatCents, ctx);
              assert.ok(t.every((x) => x.exVatCents + x.vatCents === x.inclVatCents), ctx);
              assert.ok(regelingSluit(r.regeling), ctx);
            }
          }
        }
      }
    }
  });

  it("het abonnement staat los van de regeling en verandert er niet door", () => {
    for (const over of [
      { paymentPlan: "50-50" },
      { paymentPlan: "volledig" },
      { paymentPlan: "termijnen", installmentCount: "5" },
    ]) {
      const r = reken(over);
      assert.equal(r.computed.monthlyExVatCents, 18_000);
      assert.equal(som(incl(r)), 302_500, "geen maandbedrag in de termijnen");
    }
  });
});

describe("de preview is dezelfde berekening als de server", () => {
  it("wisselen 50/50 → één keer → 5 → 6 → 12 termijnen verandert de preview meteen mee", () => {
    const toon = (over: Partial<AfspraakInvoer>) => {
      const { config, plan } = leesAfspraak(invoer(over), BASIS);
      return afspraakOverzicht(config, plan);
    };
    const a = toon({ paymentPlan: "50-50" });
    assert.equal(a.regeling.soort, "50-50");
    assert.deepEqual(a.regeling.termijnen.map((t) => nbsp(t.inclVat)), ["€ 1.512,50", "€ 1.512,50"]);

    const b = toon({ paymentPlan: "volledig" });
    assert.equal(b.regeling.soort, "volledig");
    assert.deepEqual(b.regeling.termijnen.map((t) => nbsp(t.inclVat)), ["€ 3.025,00"]);

    const c = toon({ paymentPlan: "termijnen", installmentCount: "5" });
    assert.equal(c.regeling.soort, "termijnen");
    assert.equal(c.regeling.aantal, 5);
    assert.ok(c.regeling.termijnen.every((t) => nbsp(t.inclVat) === "€ 605,00"));

    assert.equal(toon({ paymentPlan: "termijnen", installmentCount: "6" }).regeling.aantal, 6);
    assert.equal(toon({ paymentPlan: "termijnen", installmentCount: "12" }).regeling.aantal, 12);
    assert.equal(nbsp(c.total), "€ 3.025,00");
    assert.equal(nbsp(c.monthlyExVat), "€ 180,00");
  });

  it("opgeslagen waarden ('2500.00') en getypte waarden ('2500') geven dezelfde afspraak", () => {
    assert.deepEqual(
      leesAfspraak(invoer({ project: "2500.00", monthly: "180.00" }), BASIS),
      leesAfspraak(invoer({ project: "2500", monthly: "180" }), BASIS),
    );
  });

  it("bedragen worden als tekst gelezen, niet via een float", () => {
    assert.equal(euroInvoerNaarCenten("19.99"), 1_999);
    assert.equal(euroInvoerNaarCenten("0.29"), 29);
    assert.equal(euroInvoerNaarCenten("2500"), 250_000);
    assert.equal(euroInvoerNaarCenten("2500.5"), 250_050);
    assert.equal(euroInvoerNaarCenten("2.500,50"), 250_050);
    assert.equal(euroInvoerNaarCenten("2.500"), 250_000);
    assert.equal(euroInvoerNaarCenten(""), 0);
    assert.equal(euroInvoerNaarCenten("-5"), 0);
    assert.equal(euroInvoerNaarCenten("abc"), 0);
  });

  it("onbekende regeling wordt 50/50; een te groot aantal wordt afgekapt", () => {
    assert.equal(leesAfspraak(invoer({ paymentPlan: "iets" }), BASIS).plan.soort, "50-50");
    assert.equal(leesAfspraak(invoer({ paymentPlan: "termijnen", installmentCount: "99" }), BASIS).plan.aantal, 36);
  });
});
