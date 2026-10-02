import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIJS_KORT, TARIEVEN_FAQ, VANAF_PRIJS, vanafAanbod } from "@/lib/tarieven";

/**
 * Bewaking van de publieke prijscommunicatie.
 *
 * Het publieke bedrag is een vanafprijs voor een professionele website. Het
 * mag nooit als vaste prijs voor het hele platform terugkomen, en het mag
 * nooit in de voorstel- en betaalflow terechtkomen: een voorstel heeft altijd
 * zijn eigen, persoonlijke bedrag.
 */

const wortel = fileURLToPath(new URL("..", import.meta.url));

function bestanden(map: string): string[] {
  return readdirSync(join(wortel, map)).flatMap((naam) => {
    const pad = join(map, naam);
    return statSync(join(wortel, pad)).isDirectory() ? bestanden(pad) : [pad];
  });
}

describe("publieke prijs", () => {
  it("is € 599, als vanafprijs", () => {
    assert.equal(VANAF_PRIJS.bedrag, 599);
    assert.match(PRIJS_KORT, /vanaf € 599/);
    assert.match(TARIEVEN_FAQ[0].a, /vanaf € 599/);
  });

  it("staat in structured data als ondergrens, niet als vaste prijs", () => {
    const aanbod = vanafAanbod("https://example.org");
    assert.equal(aanbod["@type"], "AggregateOffer");
    assert.equal(aanbod.lowPrice, 599);
    assert.ok(!("price" in aanbod));
  });

  it("noemt nergens publiek nog € 2.500 als instapprijs", () => {
    const publiek = [
      "lib/tarieven.ts",
      "components/sections/pricing.tsx",
      "app/tarieven/page.tsx",
      "app/[slug]/page.tsx",
      "components/demo/experience.tsx",
    ];
    for (const b of publiek) {
      assert.ok(!/2[.,]?500/.test(readFileSync(join(wortel, b), "utf8")), `${b} noemt nog 2.500`);
    }
  });

  it("wordt niet gebruikt door de voorstel- en betaalflow", () => {
    const commercieel = [
      ...bestanden("components/commerce"),
      "app/actions/commerce.ts",
      "lib/money.ts",
      "lib/proposals.ts",
      "lib/payment-plan.ts",
      "lib/payment-schedule.ts",
      "lib/betaalafspraak.ts",
      "lib/agreement.ts",
      "lib/commerce.ts",
    ];
    for (const b of commercieel) {
      assert.ok(
        !readFileSync(join(wortel, b), "utf8").includes("@/lib/tarieven"),
        `${b} leest de publieke prijs; een voorstel hoort zijn eigen bedrag te hebben`,
      );
    }
  });
});
