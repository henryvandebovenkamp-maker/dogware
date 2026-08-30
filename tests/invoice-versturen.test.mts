import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isGeldigEmail } from "../lib/invoices.ts";

/**
 * Versturen van een factuur — aan de klant, of als kopie naar een ander adres.
 *
 * Het verschil tussen die twee is administratief, niet cosmetisch. "Verstuurd"
 * betekent dat de KLANT zijn factuur heeft gekregen. Een kopie naar de
 * boekhouder mag die stand nooit veranderen, anders beweert de administratie
 * iets dat niet gebeurd is.
 */

const service = readFileSync(new URL("../lib/invoices.ts", import.meta.url), "utf8");
const acties = readFileSync(
  new URL("../app/admin/(portal)/facturen/actions.ts", import.meta.url),
  "utf8",
);
const ui = readFileSync(
  new URL("../app/admin/(portal)/facturen/[nummer]/factuur-acties.tsx", import.meta.url),
  "utf8",
);
const commerce = readFileSync(new URL("../lib/commerce.ts", import.meta.url), "utf8");

describe("1. een kopie is geen verzending aan de klant", () => {
  it("zet sentAt/sentTo alleen bij een echte klantverzending", () => {
    const blok = service.slice(service.indexOf("if (!kopie) {"));
    const sentAtPositie = service.indexOf("sentAt: new Date()");
    assert.ok(sentAtPositie > -1, "sentAt hoort ergens gezet te worden");
    assert.ok(
      sentAtPositie > service.indexOf("if (!kopie) {"),
      "sentAt mag uitsluitend binnen de niet-kopie-tak gezet worden",
    );
    assert.match(blok, /sentTo: ontvanger/);
  });

  it("logt een kopie als interne tijdlijnregel", () => {
    assert.match(service, /"invoice_copy_sent"/);
    const kopieBlok = service.slice(service.indexOf('"invoice_copy_sent"'));
    assert.match(
      kopieBlok.slice(0, 400),
      /internal: true/,
      "een kopie naar de boekhouder is geen klantcommunicatie",
    );
  });

  it("houdt de auditregels uit elkaar", () => {
    assert.match(service, /kopie \? "invoice\.copy_sent" : "invoice\.sent"/);
  });

  it("legt de werkelijke ontvanger vast in het e-maillogboek", () => {
    assert.match(commerce, /ontvanger,/);
    assert.match(commerce, /soort: isKopie \? `\$\{type\} \(kopie\)` : type/);
  });
});

describe("2. de link in een kopie lekt het traject niet", () => {
  it("wijst standaard naar de beheeromgeving", () => {
    assert.match(
      service,
      /if \(!opts\.kopie \|\| opts\.publiekeLink\) return invoiceLinkForCustomer\(doc\)/,
      "een kopie hoort niet standaard de persoonlijke klantlink mee te sturen",
    );
    assert.match(service, /\/admin\/facturen\/\$\{encodeURIComponent\(doc\.nummer\)\}/);
  });

  it("stuurt de openbare link alleen na een expliciete keuze", () => {
    assert.match(service, /publiekeLink: opts\.publiekeLink === true/);
    assert.match(acties, /formData\.get\("publiekeLink"\) === "on"/);
  });

  it("waarschuwt de beheerder zichtbaar in de interface", () => {
    assert.match(ui, /zonder inloggen toegang tot het hele traject/);
    assert.match(ui, /name="publiekeLink"/);
  });

  it("staat standaard uit", () => {
    assert.match(
      ui,
      /useState\(false\)/,
      "de openbare link hoort een bewuste keuze te zijn, geen standaardstand",
    );
  });
});

describe("3. het adres wordt gecontroleerd", () => {
  it("accepteert normale adressen", () => {
    for (const adres of ["henry@dog-connect.nl", "a.b+c@voorbeeld.co.uk", "info@x.nl"]) {
      assert.equal(isGeldigEmail(adres), true, `${adres} hoort geldig te zijn`);
    }
  });

  it("weigert onzin", () => {
    for (const adres of ["", "  ", "geen-adres", "a@b", "a@b.c", "twee@apen@nl.nl", "a b@c.nl"]) {
      assert.equal(isGeldigEmail(adres), false, `${adres} hoort geweigerd te worden`);
    }
  });

  it("wordt server-side afgedwongen, niet alleen in het formulier", () => {
    assert.match(service, /if \(naar && !isGeldigEmail\(naar\)\)/);
  });
});

describe("4. toegang", () => {
  it("controleert de beheerdersrol in elke actie", () => {
    const acties_ = acties.match(/export async function \w+/g) ?? [];
    assert.equal(acties_.length, 3, "versturen, kopie versturen en crediteren");
    assert.equal(
      (acties.match(/await getAdminActor\(\)/g) ?? []).length,
      acties_.length,
      "elke server action hoort zelf de rol te controleren",
    );
  });

  it("weigert nog steeds een concept te versturen", () => {
    assert.match(service, /doc\.status === "CONCEPT"/);
  });
});
