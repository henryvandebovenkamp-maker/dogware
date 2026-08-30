import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  entityReady,
  legalEntity,
  legalFooterLine,
} from "../lib/legal-entity.ts";

/**
 * De facturerende partij.
 *
 * Een Nederlandse factuur hoort KvK- en btw-nummer te vermelden. Deze test
 * bewaakt dat ze er zijn, dat ze er geldig uitzien, en dat ze maar op één
 * plek staan — twee bronnen betekent vroeg of laat twee verschillende nummers
 * op twee documenten.
 */

describe("1. de gegevens zijn compleet", () => {
  it("heeft een KvK- en btw-nummer", () => {
    assert.notEqual(legalEntity.kvk.trim(), "");
    assert.notEqual(legalEntity.btw.trim(), "");
  });

  it("meldt niets meer als ontbrekend", () => {
    const status = entityReady();
    assert.deepEqual(status.missing, []);
    assert.equal(status.ok, true, "zolang dit false is toont de admin een waarschuwing");
  });
});

describe("2. de nummers hebben een geldige vorm", () => {
  it("KvK is acht cijfers", () => {
    assert.match(
      legalEntity.kvk,
      /^\d{8}$/,
      "een KvK-nummer is precies acht cijfers, zonder spaties of punten",
    );
  });

  it("btw is een Nederlands omzetbelastingnummer", () => {
    // NL + 9 tekens + B + 2 cijfers, de vorm die op een factuur hoort.
    assert.match(
      legalEntity.btw,
      /^NL[0-9A-Z]{9}B\d{2}$/,
      "verwacht de vorm NL123456789B01",
    );
  });

  it("bevat geen spaties", () => {
    for (const [veld, waarde] of [["kvk", legalEntity.kvk], ["btw", legalEntity.btw]] as const) {
      assert.doesNotMatch(waarde, /\s/, `${veld} hoort zonder spaties opgeslagen te worden`);
    }
  });
});

describe("3. ze komen automatisch op de documenten", () => {
  it("staan in de juridische ondertekst", () => {
    const regel = legalFooterLine();
    assert.ok(regel.includes(`KvK ${legalEntity.kvk}`), regel);
    assert.ok(regel.includes(`btw ${legalEntity.btw}`), regel);
  });

  it("noemen de facturerende partij, niet alleen het merk", () => {
    assert.ok(legalFooterLine().includes(legalEntity.name));
    assert.ok(legalFooterLine().startsWith("DogWare is een dienst van"));
  });
});
