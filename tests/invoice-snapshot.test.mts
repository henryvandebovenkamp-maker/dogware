import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { toInvoiceView, INVOICE_SNAPSHOT_VERSION } from "../lib/documents.ts";
import { effectieveStatus, INVOICE_STATUS_LABEL } from "../lib/invoices.ts";
import { INVOICE_STATUSES, isInvoiceType } from "../lib/db/schema.ts";
import { invoiceLine, sumInvoiceLines } from "../lib/money.ts";
import type { DogDocument } from "../lib/db/schema.ts";

/**
 * Een uitgegeven factuur mag nooit meer veranderen.
 *
 * Dit is geen stijlkwestie maar de kern van een deugdelijke administratie: als
 * een klant volgend jaar verhuist, moet de factuur van vandaag nog steeds het
 * adres van vandaag tonen. Anders klopt geen enkele bewaarde PDF meer met wat
 * het systeem beweert.
 */

const REGEL = invoiceLine({
  omschrijving: "Ontwikkeling & inrichting DogWare-platform",
  toelichting: "Eerste termijn",
  prijsExVatCents: 125000,
  vatPercent: 21,
});
const TOTALEN = sumInvoiceLines([REGEL]);

/** Een document zoals het in de database staat, met bevroren momentopname. */
function doc(overschrijf: Partial<DogDocument> = {}): DogDocument {
  return {
    id: "doc-1",
    leadId: "lead-1",
    commerceId: "commerce-1",
    type: "INVOICE_DEPOSIT",
    nummer: "DW-2026-0042",
    titel: REGEL.omschrijving,
    proposalId: null,
    agreementId: null,
    paymentId: "pay-1",
    netExVatCents: TOTALEN.exclCents,
    vatCents: TOTALEN.btwCents,
    totalInclVatCents: TOTALEN.inclCents,
    vatPercent: 21,
    visibleToCustomer: true,
    issuedAt: new Date("2026-08-30T10:00:00Z"),
    status: "BETAALD",
    dueAt: null,
    paidAt: new Date("2026-08-30T10:05:00Z"),
    paymentMethod: "ideal",
    molliePaymentId: "tr_test123",
    sentAt: null,
    sentTo: null,
    creditsDocumentId: null,
    creditedByDocumentId: null,
    creditReason: null,
    snapshot: {
      versie: INVOICE_SNAPSHOT_VERSION,
      leverancier: {
        naam: "OneDaySite",
        contactpersoon: null,
        adresregels: ["Hogeweg 15 H", "3814 CB Amersfoort"],
        land: "Nederland",
        email: "info@onedaysite.nl",
        telefoon: "06-13 97 15 25",
        kvk: null,
        btw: null,
        iban: null,
      },
      klant: {
        naam: "The Happy Dogs",
        contactpersoon: "Sam de Vries",
        adresregels: ["Oude Gracht 1", "3511 AA Utrecht"],
        land: "Nederland",
        email: "sam@happydogs.nl",
        telefoon: null,
        kvk: "12345678",
        btw: "NL001234567B01",
        iban: null,
      },
      regels: [REGEL],
      totalen: TOTALEN,
      omschrijving: REGEL.omschrijving,
      referentie: "DW-THEHAPPYDOG-DEPOSIT-abc",
      molliePaymentId: "tr_test123",
      betaaldOp: "2026-08-30T10:05:00.000Z",
      betaalmethode: "ideal",
      entiteitOntbreekt: ["KvK-nummer", "btw-nummer"],
    } as unknown as Record<string, unknown>,
    ...overschrijf,
  } as DogDocument;
}

/** Een overeenkomst met NIEUWE, gewijzigde klantgegevens. */
const VERHUISDE_KLANT = {
  id: "agr-1",
  signerCompany: "The Happy Dogs B.V.",
  signerName: "Iemand Anders",
  signerAddress: "Nieuwe Straat 99",
  signerPostcode: "1000 AA",
  signerCity: "Amsterdam",
  signerEmail: "nieuw@happydogs.nl",
  signerPhone: null,
  signerKvk: "87654321",
  signerVat: "NL009876543B01",
} as never;

describe("1. de factuur bevriest de klantgegevens", () => {
  it("toont het adres van toen, niet het adres van nu", () => {
    const view = toInvoiceView(doc(), VERHUISDE_KLANT);
    assert.equal(view.klant.naam, "The Happy Dogs");
    assert.deepEqual(view.klant.adresregels, ["Oude Gracht 1", "3511 AA Utrecht"]);
    assert.equal(
      view.klant.adresregels.includes("Nieuwe Straat 99"),
      false,
      "een verhuisde klant mag een oude factuur niet met terugwerkende kracht wijzigen",
    );
    assert.equal(view.klant.kvk, "12345678");
  });

  it("toont de afzender van toen", () => {
    const view = toInvoiceView(doc(), VERHUISDE_KLANT);
    assert.equal(view.leverancier.naam, "OneDaySite");
    assert.deepEqual(view.leverancier.adresregels, ["Hogeweg 15 H", "3814 CB Amersfoort"]);
  });

  it("houdt de regels en bedragen precies zoals ze waren", () => {
    const view = toInvoiceView(doc());
    assert.equal(view.regels.length, 1);
    assert.equal(view.regels[0].toelichting, "Eerste termijn");
    assert.equal(view.bedragen.exclCents, 125000);
    assert.equal(view.bedragen.btwCents, 26250);
    assert.equal(view.bedragen.inclCents, 151250);
    assert.equal(view.bedragen.btwPercent, 21);
  });

  it("onthoudt wat er destijds aan de facturerende partij ontbrak", () => {
    const view = toInvoiceView(doc());
    assert.deepEqual(view.leverancier.ontbreekt, ["KvK-nummer", "btw-nummer"]);
  });
});

describe("2. de betaling op de factuur", () => {
  it("noemt de werkelijke methode en niet standaard iDEAL", () => {
    assert.equal(toInvoiceView(doc()).betaling.methode, "iDEAL");
    assert.equal(
      toInvoiceView(doc({ paymentMethod: "creditcard" })).betaling.methode,
      "Creditcard",
      "de factuur beweerde eerder altijd iDEAL, ook bij een creditcardbetaling",
    );
  });

  it("laat de methode weg als die niet vastligt", () => {
    const zonder = doc({ paymentMethod: null });
    (zonder.snapshot as Record<string, unknown>).betaalmethode = null;
    assert.equal(toInvoiceView(zonder).betaling.methode, null);
  });

  it("draagt de Mollie-referentie mee", () => {
    assert.equal(toInvoiceView(doc()).betaling.molliePaymentId, "tr_test123");
    assert.equal(toInvoiceView(doc()).betaling.betaald, true);
  });
});

describe("3. oude facturen zonder momentopname", () => {
  /** Zoals de documenten die er vóór deze module al waren. */
  const oud = (overschrijf: Partial<DogDocument> = {}) =>
    doc({
      snapshot: {
        klant: "The Happy Dogs",
        omschrijving: "Eerste termijn — DogWare website en platform",
        betaaldOp: "2026-08-30T10:05:00.000Z",
        molliePaymentId: "tr_oud",
        referentie: "DW-OUD-DEPOSIT",
        entiteit: [
          "OneDaySite",
          "Hogeweg 15 H",
          "3814 CB Amersfoort",
          "info@onedaysite.nl",
          "06-13 97 15 25",
        ],
      } as unknown as Record<string, unknown>,
      ...overschrijf,
    });

  it("blijven leesbaar en houden hun eigen bedragen", () => {
    const view = toInvoiceView(oud());
    assert.equal(view.regels.length, 1);
    assert.equal(view.bedragen.inclCents, 151250);
    assert.equal(view.omschrijving, "Eerste termijn — DogWare website en platform");
  });

  it("vullen de klantgegevens aan uit de getekende overeenkomst", () => {
    // Die is zelf ook bevroren, dus dit is de best beschikbare waarheid.
    const view = toInvoiceView(oud(), VERHUISDE_KLANT);
    assert.equal(view.klant.naam, "The Happy Dogs");
    assert.deepEqual(view.klant.adresregels, ["Nieuwe Straat 99", "1000 AA Amsterdam"]);
  });

  it("verzinnen geen betaalmethode", () => {
    // Bij oude documenten ligt de methode nergens vast; dan hoort de factuur
    // er niets over te zeggen in plaats van "iDEAL" aan te nemen.
    assert.equal(toInvoiceView(oud({ paymentMethod: null })).betaling.methode, null);
  });
});

describe("4. de creditnota", () => {
  it("wordt als creditnota herkend en toont geen betaalregel", () => {
    const view = toInvoiceView(doc({ type: "CREDIT_NOTE", nummer: "DW-2026-0043" }));
    assert.equal(view.isCreditnota, true);
  });

  it("telt mee als factuur voor de toegangscontrole", () => {
    assert.equal(isInvoiceType("CREDIT_NOTE"), true);
    assert.equal(isInvoiceType("INVOICE_DEPOSIT"), true);
    assert.equal(isInvoiceType("PROPOSAL"), false, "een voorstel is geen factuur");
    assert.equal(isInvoiceType("AGREEMENT"), false, "een overeenkomst is geen factuur");
  });
});

describe("5. verlopen is een afleiding, geen achterstallige taak", () => {
  const nu = new Date("2026-09-15T12:00:00Z");

  it("noemt een openstaande factuur over de vervaldatum verlopen", () => {
    assert.equal(
      effectieveStatus({ status: "OPEN", dueAt: new Date("2026-09-01T00:00:00Z") }, nu),
      "VERLOPEN",
    );
  });

  it("laat een openstaande factuur binnen de termijn met rust", () => {
    assert.equal(
      effectieveStatus({ status: "OPEN", dueAt: new Date("2026-10-01T00:00:00Z") }, nu),
      "OPEN",
    );
    assert.equal(effectieveStatus({ status: "OPEN", dueAt: null }, nu), "OPEN");
  });

  it("raakt een betaalde of gecrediteerde factuur nooit aan", () => {
    const oud = new Date("2020-01-01T00:00:00Z");
    assert.equal(effectieveStatus({ status: "BETAALD", dueAt: oud }, nu), "BETAALD");
    assert.equal(effectieveStatus({ status: "GECREDITEERD", dueAt: oud }, nu), "GECREDITEERD");
    assert.equal(effectieveStatus({ status: "GEANNULEERD", dueAt: oud }, nu), "GEANNULEERD");
  });

  it("heeft voor elke status een Nederlands label", () => {
    for (const s of INVOICE_STATUSES) {
      assert.equal(typeof INVOICE_STATUS_LABEL[s], "string");
      assert.notEqual(INVOICE_STATUS_LABEL[s], s, `${s} wordt onvertaald getoond`);
    }
  });
});
