import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { bouwprompt } from "../lib/bouwprompt.ts";
import type { Lead } from "../lib/db/schema.ts";

/**
 * De bouwprompt.
 *
 * Twee dingen bewaken deze tests. Ten eerste dat er niets in de prompt komt wat
 * de klant niet heeft gezegd — een verzonnen dienst of telefoonnummer wordt
 * verderop een feit waar niemand meer de bron van kent. Ten tweede dat een leeg
 * veld leesbaar leeg blijft: `undefined` in een opdracht leest als een fout en
 * zegt niets over de werkelijkheid.
 */

const LEEG: Lead = {
  id: "00000000-0000-0000-0000-000000000000",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  bedrijfsnaam: "Blaf & Boffel",
  naam: "Kim Jansen",
  email: "kim@blafenboffel.nl",
  telefoon: null,
  website: null,
  plaats: "Amersfoort",
  diensten: [],
  dienstenAnders: null,
  heeftWebsite: null,
  websiteGoed: null,
  websiteMist: null,
  software: [],
  tijdvreters: [],
  droomscenario: null,
  inspiratie: null,
  heeftLogo: null,
  huisstijl: null,
  uploads: [],
  functies: [],
  opmerkingen: null,
  affiliatePartnerId: null,
  referralCodeSnapshot: null,
  referralClickId: null,
  attributionModel: null,
  attributedAt: null,
  source: "website",
  stage: "aangevraagd",
  demoDomain: null,
  demoPortalUrl: null,
  demoLoginEmail: null,
  demoTemplate: null,
  demoPrimaryColor: null,
  demoSecondaryColor: null,
  demoCustomerUserId: null,
  demoSentAt: null,
  status: "nieuw",
  notities: null,
};

const VOL: Lead = {
  ...LEEG,
  telefoon: "06-12345678",
  website: "https://blafenboffel.nl",
  heeftWebsite: "ja-nieuw",
  websiteGoed: "De foto's zijn mooi.",
  websiteMist: "Je kunt nergens online boeken.",
  diensten: ["Uitlaatservice", "Pension", "Hondenoppas aan huis"],
  dienstenAnders: "puppystartcursus",
  software: ["Excel", "WhatsApp"],
  tijdvreters: ["Planning", "Facturen"],
  droomscenario: "Dat de agenda zichzelf vult.",
  inspiratie: "Rustig, veel wit, grote foto's.",
  heeftLogo: "ja",
  huisstijl: "Groen en zand.",
  uploads: ["https://uploads.example/logo.png"],
  functies: ["Online boeken", "Klantportaal", "Betalen"],
  opmerkingen: "Graag snel starten.",
};

describe("bouwprompt — vaste opbouw", () => {
  it("bevat elke sectie uit de template", () => {
    const p = bouwprompt(VOL);
    for (const sectie of [
      "# NIEUWE DOGWARE KLANT",
      "## BEDRIJF",
      "## CONTACTPERSOON",
      "## CONTACTGEGEVENS",
      "## PLAATS",
      "## BESTAANDE WEBSITE",
      "## DIENSTEN",
      "## KLANT MIST",
      "## GROOTSTE TIJDVERSPILLERS",
      "## GEWENSTE FUNCTIONALITEIT",
      "## OVERIGE INTAKE-ANTWOORDEN",
      "## DESIGN FACTSHEET",
      "## OPDRACHT",
      "## TECHNISCHE RANDVOORWAARDEN",
      "## FUNCTIONELE KOPPELINGEN",
      "## DESIGN",
      "## MOBILE",
      "## KLANTISOLATIE",
      "## FEITENCONTROLE",
      "## ACCEPTATIE",
    ]) {
      assert.ok(p.includes(sectie), `sectie ontbreekt: ${sectie}`);
    }
  });

  it("geeft bij dezelfde aanvraag twee keer exact dezelfde tekst", () => {
    // Deterministisch: geen AI, geen datum, geen willekeur. Anders is een
    // verschil tussen twee prompts geen signaal meer.
    assert.equal(bouwprompt(VOL), bouwprompt(VOL));
  });

  it("draagt de vaste architectuurregel", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /CUSTOM AAN DE VOORKANT\.\nSTABIEL DOGWARE AAN DE ACHTERKANT\./);
    assert.match(p, /mogen niet\nopnieuw worden uitgevonden/);
  });

  it("eist werkende koppelingen, niet alleen een mooie website", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /geen visuele knop "Boeken" die nergens heen gaat/i);
    assert.match(p, /klantportaal moet waar relevant gebruikmaken van de bestaande/);
  });

  it("verbiedt het kopiëren van een andere klant", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /Spin & Kwispel met een ander logo/);
    assert.match(p, /## KLANTISOLATIE/);
  });

  it("verbiedt het verzinnen van feiten", () => {
    assert.match(bouwprompt(LEEG), /Verzin nooit: prijzen, adressen, KvK/);
  });
});

describe("bouwprompt — gegevens uit de aanvraag", () => {
  it("neemt bedrijf, contactpersoon en contactgegevens over", () => {
    const p = bouwprompt(VOL);
    assert.ok(p.includes("Blaf & Boffel"));
    assert.ok(p.includes("Kim Jansen"));
    assert.ok(p.includes("E-mail: kim@blafenboffel.nl"));
    assert.ok(p.includes("Telefoon: 06-12345678"));
    assert.ok(p.includes("Amersfoort"));
  });

  it("neemt alle diensten over, inclusief het vrije tekstveld", () => {
    const p = bouwprompt(VOL);
    for (const dienst of ["Uitlaatservice", "Pension", "Hondenoppas aan huis", "puppystartcursus"]) {
      assert.ok(p.includes(`- ${dienst}`), `dienst ontbreekt: ${dienst}`);
    }
  });

  it("verzint geen diensten die niet in de aanvraag staan", () => {
    const p = bouwprompt({ ...LEEG, diensten: ["Uitlaatservice"] });
    assert.ok(p.includes("- Uitlaatservice"));
    for (const niet of ["Trimsalon", "Webshop", "Gedragstherapie"]) {
      assert.ok(!p.includes(`- ${niet}`), `verzonnen dienst: ${niet}`);
    }
  });

  it("neemt wensen, tijdvreters en huidige software over", () => {
    const p = bouwprompt(VOL);
    assert.ok(p.includes("- Online boeken"));
    assert.ok(p.includes("- Klantportaal"));
    assert.ok(p.includes("- Planning"));
    assert.ok(p.includes("- Excel"));
  });

  it("citeert het droomscenario van de klant letterlijk", () => {
    assert.ok(bouwprompt(VOL).includes('"Dat de agenda zichzelf vult."'));
  });
});

describe("bouwprompt — bestaande website", () => {
  it("laat de site onderzoeken als er een URL is", () => {
    const p = bouwprompt(VOL);
    assert.ok(p.includes("URL: https://blafenboffel.nl"));
    assert.match(p, /Onderzoek eerst de officiële bestaande website/);
    assert.match(p, /bron voor de INHOUD, niet voor het ontwerp/);
  });

  it("verbiedt zoeken op goed geluk als er geen URL is", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /Er is geen website-URL aangeleverd/);
    assert.match(p, /Zoek geen website op goed geluk/);
    assert.ok(!p.includes("Onderzoek eerst de officiële bestaande website"));
  });
});

describe("bouwprompt — ontbrekende velden", () => {
  it("schrijft nooit undefined, null of [object Object]", () => {
    for (const lead of [LEEG, VOL]) {
      const p = bouwprompt(lead);
      for (const rommel of ["undefined", "null", "[object Object]", "NaN"]) {
        assert.ok(!p.includes(rommel), `"${rommel}" staat in de prompt`);
      }
    }
  });

  it("zegt netjes dat iets niet is aangeleverd", () => {
    const p = bouwprompt(LEEG);
    assert.ok(p.includes("Niet aangeleverd."));
    // Een leeg telefoonveld verdwijnt; het hele blok zegt dan "Niet aangeleverd".
    assert.ok(!p.includes("Telefoon:"));
  });

  it("laat geen enkele sectie leeg achter", () => {
    const p = bouwprompt(LEEG);
    // Twee lege regels tussen een kop en de volgende kop zou betekenen dat er
    // niets onder staat — dan leest de prompt als kapot in plaats van als leeg.
    const koppen = p.split("\n").map((r, i, alle) => [r, alle[i + 2]] as const);
    for (const [regel, overtwee] of koppen) {
      if (regel.startsWith("## ") && overtwee?.startsWith("## ")) {
        assert.fail(`sectie zonder inhoud: ${regel}`);
      }
    }
  });
});
