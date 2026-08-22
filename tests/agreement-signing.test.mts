import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AGREEMENT_STATUSES } from "../lib/db/schema.ts";

/**
 * De statusovergangen van de overeenkomst.
 *
 * Deze test bestaat door een fout die live ging: de contractpagina zet de
 * status bij openen van SENT naar VIEWED, terwijl het ondertekenen alleen op
 * SENT filterde. Omdat je een contract moet openen om het te kunnen tekenen,
 * faalde ondertekenen altijd — en de eerdere test miste het, omdat die de
 * serveractie rechtstreeks aanriep en de pagina oversloeg.
 *
 * Daarom controleren we hier de bron zelf: welke statussen de UPDATE accepteert
 * moet exact overeenkomen met de statussen die vóór ondertekening kunnen
 * voorkomen.
 */

const acties = readFileSync(new URL("../app/actions/commerce.ts", import.meta.url), "utf8");
const contractPagina = readFileSync(
  new URL("../app/traject/[token]/overeenkomst/page.tsx", import.meta.url),
  "utf8",
);

/** De statussen die de ondertekening-UPDATE accepteert. */
function geaccepteerdeStatussen(): string[] {
  const blok = acties.slice(acties.indexOf("export async function signAgreement"));
  const m = blok.match(/inArray\(\s*schema\.agreements\.status,\s*\[([^\]]+)\]/);
  assert.ok(m, "de ondertekening filtert niet meer op een lijst statussen");
  return m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

describe("1. ondertekenen accepteert elke nog-niet-getekende status", () => {
  const toegestaan = geaccepteerdeStatussen();

  it("accepteert VIEWED — de status die het openen van de pagina zet", () => {
    assert.ok(
      toegestaan.includes("VIEWED"),
      "een geopend contract kan niet meer ondertekend worden; dit was de live fout",
    );
  });

  it("accepteert ook SENT en DRAFT", () => {
    assert.ok(toegestaan.includes("SENT"));
    assert.ok(toegestaan.includes("DRAFT"));
  });

  it("accepteert NOOIT een reeds getekende of opgevolgde overeenkomst", () => {
    assert.ok(!toegestaan.includes("SIGNED"), "een getekend contract mag niet overschreven worden");
    assert.ok(!toegestaan.includes("SUPERSEDED"), "een opgevolgd contract mag niet getekend worden");
  });

  it("dekt precies alle statussen die vóór ondertekening bestaan", () => {
    const voorTekenen = AGREEMENT_STATUSES.filter((s) => s !== "SIGNED" && s !== "SUPERSEDED");
    assert.deepEqual(
      [...toegestaan].sort(),
      [...voorTekenen].sort(),
      "als er een status bijkomt, hoort die hier ook bij te staan",
    );
  });
});

describe("2. de contractpagina en het ondertekenen spreken dezelfde taal", () => {
  it("de status die de pagina bij openen zet, staat in de lijst van het ondertekenen", () => {
    const m = contractPagina.match(/status:\s*agreement\.status === "SENT" \? "(\w+)"/);
    assert.ok(m, "de pagina zet bij openen geen herkenbare status meer");
    assert.ok(
      geaccepteerdeStatussen().includes(m[1]),
      `de pagina zet "${m[1]}", maar ondertekenen accepteert die status niet`,
    );
  });

  it("de ondertekening blijft voorwaardelijk, zodat twee gelijktijdige pogingen niet allebei slagen", () => {
    const blok = acties.slice(acties.indexOf("export async function signAgreement"));
    assert.match(
      blok,
      /\.where\(\s*and\(/,
      "de UPDATE moet een voorwaarde houden; zonder guard kan een dubbele klik twee keer tekenen",
    );
  });
});
