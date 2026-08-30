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
const accountPagina = readFileSync(
  new URL("../app/account/facturen/[nummer]/page.tsx", import.meta.url),
  "utf8",
);
const adminDetail = readFileSync(
  new URL("../app/admin/(portal)/facturen/[nummer]/page.tsx", import.meta.url),
  "utf8",
);
const adminActies = readFileSync(
  new URL("../app/admin/(portal)/facturen/actions.ts", import.meta.url),
  "utf8",
);
const facturenService = readFileSync(new URL("../lib/invoices.ts", import.meta.url), "utf8");

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
      /if \(!isInvoiceType\(doc\.type\)\) return null/,
      "een voorstel of overeenkomst hoort niet via de factuurroute te lekken",
    );
  });
});

describe("5. de klantroute in het account", () => {
  it("eist een ingelogde klant", () => {
    assert.match(accountPagina, /requireRole\("CUSTOMER"/);
  });

  it("laat de eigendomscontrole door de servicelaag doen", () => {
    assert.match(
      accountPagina,
      /invoiceForUser\(user\.id, /,
      "de pagina mag nooit op factuurnummer alleen zoeken — nummers lopen op en zijn te raden",
    );
    assert.match(accountPagina, /if \(!factuur\) notFound\(\)/);
  });

  it("wordt nooit gecachet", () => {
    assert.match(accountPagina, /dynamic = "force-dynamic"/);
  });

  it("beperkt de zoekopdracht server-side tot de eigen aanvragen", () => {
    // De query zelf moet op leadId filteren; een controle achteraf is te laat
    // als iemand de query hergebruikt.
    assert.match(facturenService, /export async function invoiceForUser/);
    const body = facturenService.slice(
      facturenService.indexOf("export async function invoiceForUser"),
    );
    assert.match(body, /eigenLeads\(userId\)/);
    assert.match(body, /leads\.map\(\(l\) => l\.id\)/);
    assert.match(
      body,
      /visibleToCustomer, true/,
      "interne documenten horen niet in het klantportaal",
    );
  });

  it("koppelt eigendom aan het account en niet aan het e-mailadres", () => {
    assert.match(
      facturenService,
      /eq\(schema\.leads\.demoCustomerUserId, userId\)/,
      "matchen op e-mailadres zou toegang tot facturen te makkelijk maken",
    );
  });
});

describe("6. de administratie in de admin", () => {
  it("eist een beheerderssessie op de detailpagina", () => {
    assert.match(adminDetail, /await requireAdmin\(\)/);
  });

  it("controleert de rol ook in de server actions", () => {
    // Een server action is ook via een directe POST bereikbaar; de
    // layout-guard is daar niet genoeg.
    const acties = adminActies.match(/export async function \w+/g) ?? [];
    assert.ok(acties.length >= 2, "er horen acties te zijn om te controleren");
    assert.equal(
      (adminActies.match(/await getAdminActor\(\)/g) ?? []).length,
      acties.length,
      "elke server action hoort zelf de beheerdersrol te controleren",
    );
  });
});

describe("7. geen gevaarlijke handmatige knoppen", () => {
  it("kan een factuur niet met de hand op betaald zetten", () => {
    for (const [naam, bron] of [
      ["de server actions", adminActies],
      ["de servicelaag", facturenService],
    ] as const) {
      assert.doesNotMatch(
        bron,
        /status:\s*"BETAALD"/,
        `${naam} hoort geen betaalstatus te kunnen zetten — dat doet de Mollie-webhook`,
      );
    }
  });

  it("corrigeert met een creditnota in plaats van te verwijderen", () => {
    assert.match(adminActies, /createCreditNote/);
    assert.doesNotMatch(
      adminActies,
      /\.delete\(/,
      "een definitieve factuur wordt nooit uit de administratie verwijderd",
    );
  });

  it("eist een reden bij het crediteren", () => {
    assert.match(adminActies, /reden\.length < 5/);
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
