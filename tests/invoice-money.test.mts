import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  betaalmethodeLabel,
  euroFromCents,
  invoiceLine,
  invoiceLineFromGross,
  negateInvoiceLine,
  sumInvoiceLines,
} from "../lib/money.ts";

/**
 * Het rekenwerk onder een factuur.
 *
 * Geld is de plek waar een afrondingsfout niet "een cent" kost maar een
 * onverklaarbaar verschil met de bankrekening. Alles rekent daarom in hele
 * centen; deze tests bewaken dat er nergens stiekem in euro's gerekend wordt.
 */

describe("1. een factuurregel", () => {
  it("rekent btw over de hele regel, niet per stuk", () => {
    /*
     * 3 × € 0,15 met 21% btw. Per stuk afgerond is de btw 3 × 3 = 9 cent
     * (want 3,15 → 3); over de regel is het 9 cent (45 × 0,21 = 9,45 → 9).
     * Bij 7 stuks lopen die twee wél uiteen, en dan moet de regel winnen.
     */
    const regel = invoiceLine({
      omschrijving: "Test",
      aantal: 7,
      prijsExVatCents: 15,
      vatPercent: 21,
    });
    assert.equal(regel.regelExVatCents, 105);
    assert.equal(regel.regelVatCents, 22, "105 × 21% = 22,05 → 22 cent");
    assert.equal(regel.regelInclVatCents, 127);
    assert.notEqual(
      regel.regelVatCents,
      7 * Math.round((15 * 21) / 100),
      "per stuk afronden zou 21 cent geven — dat is de fout die we voorkomen",
    );
  });

  it("levert altijd hele centen op", () => {
    for (const prijs of [1, 7, 33, 12345, 99999]) {
      const r = invoiceLine({ omschrijving: "x", prijsExVatCents: prijs, vatPercent: 21 });
      for (const bedrag of [r.regelExVatCents, r.regelVatCents, r.regelInclVatCents]) {
        assert.equal(Number.isInteger(bedrag), true, `${bedrag} is geen heel aantal centen`);
      }
    }
  });

  it("telt de aanbetaling uit het voorstel correct op", () => {
    // € 1.250,00 excl. btw → btw € 262,50 → totaal € 1.512,50
    const regel = invoiceLine({
      omschrijving: "Ontwikkeling & inrichting DogWare-platform",
      toelichting: "50% aanbetaling",
      prijsExVatCents: 125000,
      vatPercent: 21,
    });
    assert.equal(regel.regelVatCents, 26250);
    assert.equal(regel.regelInclVatCents, 151250);
    assert.equal(euroFromCents(regel.regelInclVatCents).replace(/ /g, " "), "€ 1.512,50");
  });

  it("houdt een lege toelichting leeg in plaats van een lege string", () => {
    assert.equal(invoiceLine({ omschrijving: "x", prijsExVatCents: 1, vatPercent: 21 }).toelichting, null);
    assert.equal(
      invoiceLine({ omschrijving: "x", toelichting: "   ", prijsExVatCents: 1, vatPercent: 21 })
        .toelichting,
      null,
    );
  });
});

describe("2. terugrekenen vanuit een betaald bedrag", () => {
  it("laat het totaal exact gelijk aan wat er betaald is", () => {
    /*
     * Dit is de belangrijkste eigenschap van de hele module. Mollie bevestigt
     * een bedrag INCLUSIEF btw; dat is het geld dat werkelijk binnenkwam. De
     * factuur mag daar nooit een cent naast zitten, ook niet als excl. + btw
     * bij afronding anders zou uitkomen.
     */
    for (const incl of [1, 99, 100, 151250, 21780, 33333, 7, 1234567]) {
      const regel = invoiceLineFromGross({
        omschrijving: "x",
        grossCents: incl,
        vatPercent: 21,
      });
      assert.equal(regel.regelInclVatCents, incl, `totaal week af bij ${incl}`);
      assert.equal(
        regel.regelExVatCents + regel.regelVatCents,
        incl,
        `excl + btw ≠ betaald bedrag bij ${incl}`,
      );
    }
  });

  it("rekent het maandabonnement goed terug", () => {
    // € 180,00 excl. btw + 21% = € 217,80 incl.
    const regel = invoiceLineFromGross({
      omschrijving: "DogWare maandabonnement — september 2026",
      grossCents: 21780,
      vatPercent: 21,
    });
    assert.equal(regel.regelExVatCents, 18000);
    assert.equal(regel.regelVatCents, 3780);
  });

  it("werkt ook bij 0% btw", () => {
    const regel = invoiceLineFromGross({ omschrijving: "x", grossCents: 5000, vatPercent: 0 });
    assert.equal(regel.regelExVatCents, 5000);
    assert.equal(regel.regelVatCents, 0);
  });
});

describe("3. totalen", () => {
  it("zijn de som van de regels", () => {
    const regels = [
      invoiceLine({ omschrijving: "a", prijsExVatCents: 125000, vatPercent: 21 }),
      invoiceLine({ omschrijving: "b", aantal: 2, prijsExVatCents: 18000, vatPercent: 21 }),
    ];
    const t = sumInvoiceLines(regels);
    assert.equal(t.exclCents, 125000 + 36000);
    assert.equal(t.btwCents, 26250 + 7560);
    assert.equal(t.inclCents, t.exclCents + t.btwCents);
    assert.equal(t.btwPercent, 21);
  });

  it("noemt geen btw-percentage als de tarieven verschillen", () => {
    const t = sumInvoiceLines([
      invoiceLine({ omschrijving: "a", prijsExVatCents: 1000, vatPercent: 21 }),
      invoiceLine({ omschrijving: "b", prijsExVatCents: 1000, vatPercent: 9 }),
    ]);
    assert.equal(t.btwPercent, null, "één percentage tonen zou onwaar zijn");
  });

  it("is nul bij geen regels", () => {
    const t = sumInvoiceLines([]);
    assert.equal(t.exclCents, 0);
    assert.equal(t.inclCents, 0);
  });
});

describe("4. de creditnota", () => {
  it("keert alle bedragen om en heft de factuur precies op", () => {
    const origineel = invoiceLine({
      omschrijving: "Ontwikkeling",
      prijsExVatCents: 125000,
      vatPercent: 21,
    });
    const credit = negateInvoiceLine(origineel);
    assert.equal(credit.regelInclVatCents, -151250);
    const samen = sumInvoiceLines([origineel, credit]);
    assert.equal(samen.exclCents, 0);
    assert.equal(samen.btwCents, 0);
    assert.equal(samen.inclCents, 0, "factuur plus creditnota hoort nul te zijn");
  });

  it("laat de omschrijving ongemoeid", () => {
    const r = invoiceLine({ omschrijving: "Ontwikkeling", prijsExVatCents: 100, vatPercent: 21 });
    assert.equal(negateInvoiceLine(r).omschrijving, "Ontwikkeling");
  });
});

describe("5. de betaalmethode", () => {
  it("vertaalt wat Mollie stuurt", () => {
    assert.equal(betaalmethodeLabel("ideal"), "iDEAL");
    assert.equal(betaalmethodeLabel("creditcard"), "Creditcard");
    assert.equal(betaalmethodeLabel("directdebit"), "SEPA-incasso");
  });

  it("verzint niets bij een onbekende of ontbrekende methode", () => {
    assert.equal(betaalmethodeLabel(null), null);
    assert.equal(betaalmethodeLabel(undefined), null);
    assert.equal(
      betaalmethodeLabel("iets_nieuws"),
      null,
      "liever geen methode op de factuur dan een verzonnen methode",
    );
  });
});
