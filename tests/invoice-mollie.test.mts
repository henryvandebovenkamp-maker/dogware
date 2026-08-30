import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { schema } from "../lib/db/index.ts";

/**
 * Eén betaling, één factuur.
 *
 * Mollie stuurt zijn webhook meerdere keren — bij een geslaagde betaling, bij
 * een statuswijziging, en opnieuw wanneer wij een 500 teruggeven. Dat mag
 * nooit een tweede factuur, een tweede mail of een tweede tijdlijnregel
 * opleveren. Deze test bewaakt de grendels die dat garanderen.
 */

const commerce = readFileSync(new URL("../lib/commerce.ts", import.meta.url), "utf8");
const documenten = readFileSync(new URL("../lib/documents.ts", import.meta.url), "utf8");
const webhook = readFileSync(
  new URL("../app/api/mollie/webhook/route.ts", import.meta.url),
  "utf8",
);
const migratie = readFileSync(new URL("../scripts/migrate-facturen.mjs", import.meta.url), "utf8");

describe("1. de webhook blijft de bron van waarheid", () => {
  it("haalt de status op bij Mollie en vertrouwt het verzoek niet", () => {
    assert.match(commerce, /getMolliePayment\(molliePaymentId\)/);
    assert.match(webhook, /processPaymentByMollieId\(id\)/);
    assert.doesNotMatch(
      webhook,
      /form\.get\("status"\)/,
      "een status uit de request overnemen zou iedereen laten bepalen wat betaald is",
    );
  });

  it("legt de werkelijke betaalmethode vast", () => {
    assert.match(
      commerce,
      /method:\s*\n?\s*\(mollie as unknown as \{ method\?: string \| null \}\)\.method/,
      "zonder deze regel kan de factuur de betaalmethode niet waarheidsgetrouw tonen",
    );
  });
});

describe("2. dubbele verwerking is afgegrendeld", () => {
  it("claimt de afhandeling atomair", () => {
    assert.match(commerce, /isNull\(schema\.payments\.processedAt\)/);
    assert.match(commerce, /if \(geclaimd\.length === 0\) return/);
  });

  it("stopt meteen als er al volledig is afgehandeld", () => {
    assert.match(commerce, /if \(payment\.processedAt && payment\.status === "PAID"\) return/);
  });

  it("registreert de factuur vóór de bevestigingsmail", () => {
    const factuurPositie = commerce.indexOf("registerInvoiceForPayment");
    const mailPositie = commerce.indexOf('mailAndLog(lead, "deposit-received"');
    assert.ok(factuurPositie > -1 && mailPositie > -1);
    assert.ok(
      factuurPositie < mailPositie,
      "de klant mag nooit een bevestiging krijgen van iets dat administratief niet vastligt",
    );
  });
});

describe("3. één factuur per betaling", () => {
  it("kijkt eerst of er al een factuur is", () => {
    assert.match(documenten, /const bestaand = await documentForPayment\(input\.paymentId\)/);
  });

  it("wordt uiteindelijk door de database afgedwongen", () => {
    // De controle hierboven is niet genoeg: twee gelijktijdige webhooks kunnen
    // er allebei langs. De unieke index is de laatste grendel.
    const index = schema.documents;
    assert.ok(index, "de documents-tabel hoort te bestaan");
    assert.match(migratie, /CREATE UNIQUE INDEX IF NOT EXISTS documents_payment_idx/);
    assert.match(migratie, /WHERE payment_id IS NOT NULL/);
  });

  it("geeft bij een botsing de bestaande factuur terug in plaats van een nieuwe", () => {
    assert.match(
      documenten,
      /documents_payment_idx\/i\.test\(msg\) && input\.paymentId/,
      "opnieuw proberen na deze botsing zou alsnog een duplicaat maken",
    );
  });

  it("logt de factuur maar één keer op de tijdlijn", () => {
    assert.match(
      documenten,
      /if \(doc && !bestond\)/,
      "een tweede webhook hoort geen tweede tijdlijnregel op te leveren",
    );
  });
});

describe("4. een mislukte betaling maakt geen factuur", () => {
  it("verlaat de verwerking voordat de gevolgen worden uitgevoerd", () => {
    const uitstap = commerce.indexOf('if (nieuweStatus !== "PAID")');
    const claim = commerce.indexOf("isNull(schema.payments.processedAt)");
    assert.ok(uitstap > -1 && claim > -1);
    assert.ok(
      uitstap < claim,
      "een mislukte of geannuleerde betaling hoort de factuurregistratie niet te bereiken",
    );
  });

  it("zet de journey niet terug bij een mislukking", () => {
    assert.match(commerce, /Bewust géén nieuwe status/);
  });
});

describe("5. de migratie is veilig om te draaien", () => {
  it("voegt alleen toe en gooit niets weg", () => {
    assert.doesNotMatch(migratie, /DROP\s+(TABLE|COLUMN)/i);
    assert.doesNotMatch(migratie, /DELETE\s+FROM/i);
    assert.doesNotMatch(migratie, /TRUNCATE/i);
  });

  it("is herhaalbaar", () => {
    const toevoegingen = migratie.match(/ALTER TABLE \w+ ADD COLUMN/g) ?? [];
    assert.ok(toevoegingen.length > 0, "er horen kolommen toegevoegd te worden");
    assert.equal(
      (migratie.match(/ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS/g) ?? []).length,
      toevoegingen.length,
      "elke kolom hoort met IF NOT EXISTS te worden toegevoegd",
    );
    assert.match(migratie, /CREATE INDEX IF NOT EXISTS/);
  });

  it("verzint geen betaalmethode voor oude facturen", () => {
    assert.match(
      migratie,
      /liever geen methode op een oude\s*\n?\s*\*?\s*factuur dan een verzonnen methode/,
    );
    assert.doesNotMatch(
      migratie,
      /SET payment_method = 'ideal'/,
      "een niet te reconstrueren methode mag niet worden ingevuld",
    );
  });
});
