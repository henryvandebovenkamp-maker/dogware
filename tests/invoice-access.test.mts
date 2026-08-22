import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Wie mag welke factuur zien?
 *
 * Een factuurnummer is raadbaar (DW-2026-0004 volgt op 0003). De sleutel van de
 * klantomgeving alleen is dus niet genoeg: er moet óók gecontroleerd worden dat
 * de factuur bij dát traject hoort. Zonder die tweede controle kan iedereen met
 * een eigen geldige link de facturen van andere klanten oplopen.
 */

const klantPagina = readFileSync(
  new URL("../app/traject/[token]/factuur/[nummer]/page.tsx", import.meta.url),
  "utf8",
);
const adminPagina = readFileSync(
  new URL("../app/admin/(portal)/leads/[id]/factuur/[nummer]/page.tsx", import.meta.url),
  "utf8",
);
const documenten = readFileSync(new URL("../lib/documents.ts", import.meta.url), "utf8");

describe("1. de klantroute", () => {
  it("controleert eerst de sleutel van de klantomgeving", () => {
    assert.match(klantPagina, /resolvePortal\(token\)/);
    assert.match(klantPagina, /if \(!ctx\) notFound\(\)/);
  });

  it("controleert dat de factuur bij dit traject hoort", () => {
    assert.match(
      klantPagina,
      /factuur\.commerceId !== ctx\.commerce\.id/,
      "zonder deze controle is elk factuurnummer op te vragen met een geldige eigen sleutel",
    );
  });

  it("wordt nooit gecachet — het is een persoonlijk document", () => {
    assert.match(klantPagina, /dynamic = "force-dynamic"/);
  });
});

describe("2. de adminroute", () => {
  it("eist een beheerderssessie", () => {
    assert.match(adminPagina, /await requireAdmin\(\)/);
  });

  it("controleert dat de factuur bij deze aanvraag hoort", () => {
    assert.match(
      adminPagina,
      /factuur\.leadId !== id/,
      "ook een beheerder hoort een factuur onder de juiste aanvraag te openen",
    );
  });
});

describe("3. alleen facturen zijn opvraagbaar", () => {
  it("weigert documenten die geen factuur zijn", () => {
    assert.match(
      documenten,
      /if \(!doc\.type\.startsWith\("INVOICE"\)\) return null/,
      "een voorstel of overeenkomst hoort niet via de factuurroute te lekken",
    );
  });
});

describe("4. de factuur voert de juiste partij", () => {
  const view = readFileSync(new URL("../components/commerce/invoice-view.tsx", import.meta.url), "utf8");

  it("noemt de leverancier, niet alleen het merk", () => {
    assert.match(view, /leverancier\.naam/);
    assert.match(view, /DogWare is een dienst van/);
  });

  it("toont KvK en btw zodra ze bekend zijn", () => {
    assert.match(view, /leverancier\.kvk/);
    assert.match(view, /leverancier\.btw/);
  });

  it("houdt de interne waarschuwing weg bij de klant", () => {
    assert.match(
      view,
      /toonInterneWaarschuwing = false/,
      "de melding over ontbrekende KvK/btw is voor de beheerder, niet voor de klant",
    );
    assert.match(view, /toonInterneWaarschuwing && /);
  });

  it("laat navigatie en knoppen van het papier weg", () => {
    assert.match(view, /print:hidden/);
  });
});
