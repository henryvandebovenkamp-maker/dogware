import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { bouwprompt } from "../lib/bouwprompt/index.ts";
import { koppelDiensten, omgevingType, projectSlug } from "../lib/bouwprompt/modules.ts";
import type { Lead } from "../lib/db/schema.ts";

/**
 * De bouwprompt.
 *
 * Drie dingen bewaken deze tests.
 *
 * Ten eerste dat er niets in de prompt komt wat de klant niet heeft gezegd —
 * een verzonnen dienst of telefoonnummer wordt verderop een feit waar niemand
 * meer de bron van kent.
 *
 * Ten tweede dat een leeg veld leesbaar leeg blijft: `undefined` in een
 * opdracht leest als een fout en zegt niets over de werkelijkheid.
 *
 * Ten derde de architectuur. Iedere klant hoort een eigen map, repository,
 * database en Vercel-project te krijgen. Zodra een prompt suggereert dat een
 * klant erbij kan in een bestaande omgeving, is dat over een jaar niet meer
 * terug te draaien — dan staan er twee bedrijven in één database.
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
      "## 1. DIT WORDT EEN VOLLEDIG EIGEN OMGEVING",
      "## 2. BEGIN BIJ DE NIEUWSTE DOGWARE",
      "## 3. EIGEN LOKALE PROJECTMAP",
      "## 4. EIGEN GITHUB-REPOSITORY",
      "## 5. EIGEN DATABASE",
      "## 6. EIGEN VERCEL-PROJECT",
      "## 7. EIGEN ENVIRONMENT VARIABLES",
      "## 8. EIGEN BEDRIJFSCONFIGURATIE",
      "## 9. HET DOGWARE-BEHEERACCOUNT MOET WERKEN",
      "## 10. MODULES: ALLEEN WAT IS AANGEVRAAGD",
      "## 11. GEWENSTE FUNCTIONALITEIT",
      "## 12. BESTAANDE WEBSITE",
      "## 13. DE REST VAN DE INTAKE",
      "## 14. DEZE KLANT KRIJGT EEN EIGEN GEZICHT",
      "## 15. ÉÉN DESIGN SYSTEM PER KLANT",
      "## 16. NIET TE BREED OP DESKTOP",
      "## 17. HERO EN FOTOGRAFIE",
      "## 18. GEEN VASTE HOMEPAGEFORMULE",
      "## 19. WEBSITE EN PLATFORM ZIJN ÉÉN GEHEEL",
      "## 20. GEEN DATA VAN EEN ANDERE KLANT",
      "## 21. VERZIN GEEN BEDRIJFSFEITEN",
      "## 22. BETALEN EN E-MAIL: EIGEN CONFIGURATIE",
      "## 23. TECHNISCHE CONTROLE",
      "## 24. VISUELE CONTROLE",
      "## 25. CONTROLE OP KLANTLEKKEN",
      "## 26. ACCEPTATIE",
    ]) {
      assert.ok(p.includes(sectie), `sectie ontbreekt: ${sectie}`);
    }
  });

  it("begint met de kopgegevens uit de aanvraag", () => {
    const p = bouwprompt(VOL);
    for (const veld of [
      "BEDRIJF:",
      "TYPE:",
      "CONTACTPERSOON:",
      "E-MAIL:",
      "TELEFOON:",
      "PLAATS:",
      "BESTAANDE WEBSITE:",
      "DIENSTEN:",
      "GEWENSTE FUNCTIONALITEIT:",
    ]) {
      assert.ok(p.includes(veld), `kopveld ontbreekt: ${veld}`);
    }
  });

  it("geeft bij dezelfde aanvraag twee keer exact dezelfde tekst", () => {
    // Deterministisch: geen AI, geen datum, geen willekeur. Anders is een
    // verschil tussen twee prompts geen signaal meer.
    assert.equal(bouwprompt(VOL), bouwprompt(VOL));
  });

  it("verbiedt het verzinnen van feiten", () => {
    assert.match(bouwprompt(LEEG), /Verzin nooit: prijzen, tarieven/);
  });
});

/**
 * De harde architectuurregel: één klant = één eigen omgeving. Deze groep is de
 * reden dat dit bestand bestaat.
 */
describe("bouwprompt — eigen omgeving per klant", () => {
  it("eist in elke prompt een eigen map, repo, database, Vercel en env", () => {
    for (const lead of [LEEG, VOL]) {
      const p = bouwprompt(lead);
      assert.match(p, /EIGEN lokale projectmap/);
      assert.match(p, /EIGEN GitHub-repository/);
      assert.match(p, /EIGEN database/);
      assert.match(p, /EIGEN Vercel-project/);
      assert.match(p, /EIGEN environment variables/);
      assert.match(p, /EIGEN bedrijfsconfiguratie/);
    }
  });

  it("verbiedt de klant als tenant in een bestaande omgeving", () => {
    const p = bouwprompt(LEEG);
    assert.match(
      p,
      /NIET als tenant, filiaal, vestiging of extra rij in de\nomgeving van een bestaande Dogware-klant/,
    );
    assert.match(p, /Deel geen database, geen projectmap,\ngeen repository en geen Vercel-project met een andere klant/);
    assert.match(p, /Geen gedeelde database met\neen kolom/);
  });

  it("verbiedt het klonen van de data van een bestaande klant", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /Kloon dus geen bestaande\nklantdatabase/);
    assert.match(p, /software mag gedeeld zijn, gegevens van een bedrijf nooit/);
  });

  it("laat Dogware de softwarebron blijven, met upstream naar de master", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /nieuwste stabiele Dogware-master\/release/);
    assert.match(p, /Dogware master blijft als upstream bereikbaar/);
    assert.match(p, /Push niets naar de Dogware-master zelf/);
  });

  it("schrijft een eigen mapnaam voor die uit de bedrijfsnaam volgt", () => {
    assert.ok(bouwprompt(LEEG).includes("`blaf-boffel`"));
    assert.match(bouwprompt(LEEG), /Controleer eerst of de map en de repository al bestaan/);
  });

  it("laat het beheeraccount aanmaken zonder adres of wachtwoord te noemen", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /SUPER_ADMIN/);
    assert.match(p, /Het adres daarvan staat NIET in deze prompt/);
    assert.match(p, /Zet geen wachtwoord/);
    assert.match(p, /niet opgeleverd/);
  });
});

describe("bouwprompt — geen geheimen in de tekst", () => {
  it("bevat geen sleutel, connection string of adminadres", () => {
    for (const lead of [LEEG, VOL]) {
      const p = bouwprompt(lead);
      for (const geheim of [/postgres(ql)?:\/\//, /\bre_[A-Za-z0-9]/, /\b(test|live)_[A-Za-z0-9]{8}/, /sk_[A-Za-z0-9]/]) {
        assert.ok(!geheim.test(p), `geheim in de prompt: ${geheim}`);
      }
    }
  });

  it("neemt alleen e-mailadressen over die in deze aanvraag staan", () => {
    const p = bouwprompt(VOL);
    const adressen = p.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
    for (const adres of adressen) {
      assert.equal(adres, VOL.email, `onbekend e-mailadres in de prompt: ${adres}`);
    }
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

describe("bouwprompt — modules", () => {
  it("activeert alleen wat is aangevraagd", () => {
    const p = bouwprompt({ ...LEEG, diensten: ["Uitlaatservice"] });
    const activeer = p.slice(p.indexOf("ACTIVEER:"), p.indexOf("LAAT UITGESCHAKELD:"));
    assert.match(activeer, /Uitlaatservice \(uitlaatservice\)/);
    for (const niet of ["trimsalon", "webshop", "gedragstherapie", "pension"]) {
      assert.ok(!activeer.includes(niet), `verzonnen module geactiveerd: ${niet}`);
    }
  });

  it("noemt de niet-aangevraagde modules expliciet als uit te laten", () => {
    const p = bouwprompt({ ...LEEG, diensten: ["Uitlaatservice"] });
    const uit = p.slice(p.indexOf("LAAT UITGESCHAKELD:"));
    for (const slug of ["hondenschool", "trimsalon", "webshop", "chipservice"]) {
      assert.ok(uit.includes(`(${slug})`), `module ontbreekt in de uit-lijst: ${slug}`);
    }
    assert.ok(!uit.slice(0, uit.indexOf("Die tweede lijst")).includes("(uitlaatservice)"));
  });

  it("koppelt de eigen woorden van de klant aan de technische module", () => {
    const p = bouwprompt({ ...LEEG, diensten: ["Hondenoppas aan huis"] });
    assert.ok(p.includes('"Hondenoppas aan huis" → Dierenverzorging aan huis (dierenverzorging)'));
  });

  it("koppelt een onbekende dienst nergens aan, maar meldt hem", () => {
    const p = bouwprompt({ ...LEEG, diensten: ["E-learning"] });
    assert.match(p, /geen bevestigde bestaande Dogware-module gevonden/);
    assert.match(p, /Koppel deze dienst niet aan een module die er toevallig een beetje\nop lijkt/);
    assert.ok(p.includes("Geen enkele module"));
  });

  it("verzint geen module bij een vrij ingevulde dienst", () => {
    const keuze = koppelDiensten([], "puppystartcursus");
    assert.deepEqual(keuze.actief, []);
    assert.deepEqual(keuze.ongekoppeld, ["puppystartcursus"]);
  });

  it("herkent een dienst ongeacht hoofdletters of spaties", () => {
    const keuze = koppelDiensten(["  uitlaatservice  ", "TRIMSALON"]);
    assert.deepEqual(keuze.actief, ["uitlaatservice", "trimsalon"]);
  });

  it("telt een dubbel opgegeven dienst één keer", () => {
    const keuze = koppelDiensten(["Pension", "pension"]);
    assert.equal(keuze.koppelingen.length, 1);
    assert.deepEqual(keuze.actief, ["pension"]);
  });
});

describe("bouwprompt — demo of productie", () => {
  it("noemt een nieuwe aanvraag een demo, met de reden erbij", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /TYPE:\nDEMO — de journey staat nog vóór de overeenkomst \("Aanvraag ontvangen"\)/);
    assert.match(p, /Geen echte incasso's/);
  });

  it("schakelt om naar productie zodra de overeenkomst er ligt", () => {
    const p = bouwprompt({ ...LEEG, stage: "overeenkomst" });
    assert.match(p, /TYPE:\nPRODUCTIE/);
    assert.match(p, /Er gaat straks een bedrijf op draaien/);
  });

  it("volgt ook de status als de journey nog achterloopt", () => {
    assert.equal(omgevingType({ ...LEEG, status: "klant geworden" }).type, "PRODUCTIE");
    assert.equal(omgevingType({ ...LEEG, stage: "demo-verstuurd" }).type, "DEMO");
  });
});

describe("bouwprompt — bestaande website", () => {
  it("laat de site onderzoeken als er een URL is", () => {
    const p = bouwprompt(VOL);
    assert.ok(p.includes("URL: https://blafenboffel.nl"));
    assert.match(p, /door de klant bevestigde bestaande website/);
    assert.match(p, /bron voor de INHOUD, niet voor het ontwerp/);
  });

  it("verbiedt zoeken op goed geluk als er geen URL is", () => {
    const p = bouwprompt(LEEG);
    assert.match(p, /Er is geen bevestigde website-URL aangeleverd/);
    assert.match(p, /Zoek niet op goed geluk/);
    assert.ok(!p.includes("door de klant bevestigde bestaande website"));
  });
});

describe("bouwprompt — acceptatiecriteria per aanvraag", () => {
  it("voegt per geactiveerde module een controle toe", () => {
    const p = bouwprompt({ ...LEEG, diensten: ["Uitlaatservice", "Trimsalon"] });
    assert.ok(p.includes("[ ] de module Uitlaatservice is aan"));
    assert.ok(p.includes("[ ] de module Trimsalon is aan"));
    assert.ok(!p.includes("[ ] de module Webshop is aan"));
  });

  it("voegt per gewenste functie een controle toe", () => {
    const p = bouwprompt({ ...LEEG, functies: ["Strippenkaarten", "Personeelsportaal"] });
    assert.ok(p.includes('[ ] "Strippenkaarten" is gecontroleerd'));
    assert.ok(p.includes('[ ] "Personeelsportaal" is gecontroleerd'));
    assert.ok(!p.includes('[ ] "Nieuwsbrieven" is gecontroleerd'));
  });

  it("vraagt zonder website om terughoudendheid, met website om onderzoek", () => {
    assert.ok(
      bouwprompt(LEEG).includes("[ ] er is geen website van internet gehaald"),
    );
    assert.ok(
      bouwprompt(VOL).includes("[ ] de bestaande website van de klant is bekeken"),
    );
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
    assert.ok(!p.includes("Telefoon: "));
  });

  it("laat geen enkele sectie leeg achter", () => {
    const p = bouwprompt(LEEG);
    // Twee lege regels tussen een kop en de volgende kop zou betekenen dat er
    // niets onder staat — dan leest de prompt als kapot in plaats van als leeg.
    const regels = p.split("\n");
    for (const [i, r] of regels.entries()) {
      if (r.startsWith("## ") && regels[i + 2]?.startsWith("## ")) {
        assert.fail(`sectie zonder inhoud: ${r}`);
      }
    }
  });
});

describe("mapnaam", () => {
  it("maakt een bruikbare slug van een bedrijfsnaam", () => {
    assert.equal(projectSlug("Walk the dog", "abc"), "walk-the-dog");
    assert.equal(projectSlug("OH MY CAT!", "abc"), "oh-my-cat");
    assert.equal(projectSlug("Neus in de wind", "abc"), "neus-in-de-wind");
    assert.equal(projectSlug("Hondenschool 't Zandpad", "abc"), "hondenschool-t-zandpad");
  });

  it("valt terug op het aanvraag-ID als er niets overblijft", () => {
    assert.equal(projectSlug("!!!", "30d9c53b-bc5a-4413"), "klant-30d9c53b");
  });
});

/**
 * De twee acceptatietests uit de opdracht: dezelfde generator, twee totaal
 * verschillende aanvragen, twee aantoonbaar verschillende prompts — zonder dat
 * er ergens een klantnaam in de generator staat.
 */
describe("bouwprompt — twee verschillende aanvragen lekken niet naar elkaar", () => {
  const eersteKlant: Lead = {
    ...LEEG,
    bedrijfsnaam: "Walk the dog",
    naam: "Sanne de Wit",
    email: "sanne@walkthedog.example",
    plaats: "Bussum",
    website: null,
    diensten: ["Uitlaatservice"],
    functies: ["Online boeken", "Klantportaal", "Betalen", "Personeelsportaal", "Strippenkaarten"],
  };

  const tweedeKlant: Lead = {
    ...LEEG,
    bedrijfsnaam: "Neus in de wind",
    naam: "Joris Bakker",
    email: "joris@neusindewind.example",
    plaats: "Tilburg",
    website: "www.neusindewind.nl",
    heeftWebsite: "ja",
    diensten: ["Uitlaatservice", "Pension", "Gedragstherapie", "Webshop"],
    functies: ["Online boeken", "Klantportaal", "Betalen", "Nieuwsbrieven"],
  };

  it("geeft twee aantoonbaar verschillende prompts", () => {
    assert.notEqual(bouwprompt(eersteKlant), bouwprompt(tweedeKlant));
  });

  it("laat geen naam, plaats of adres van de ene klant in de andere prompt komen", () => {
    const een = bouwprompt(eersteKlant);
    const twee = bouwprompt(tweedeKlant);

    for (const van of ["Walk the dog", "walk-the-dog", "Sanne de Wit", "Bussum", eersteKlant.email]) {
      assert.ok(!twee.includes(van), `lek naar de tweede prompt: ${van}`);
    }
    for (const van of ["Neus in de wind", "neus-in-de-wind", "Joris Bakker", "Tilburg", tweedeKlant.email]) {
      assert.ok(!een.includes(van), `lek naar de eerste prompt: ${van}`);
    }
  });

  it("selecteert per aanvraag andere modules", () => {
    const een = bouwprompt(eersteKlant);
    const twee = bouwprompt(tweedeKlant);

    assert.ok(een.slice(een.indexOf("ACTIVEER:"), een.indexOf("LAAT UITGESCHAKELD:")).includes("(uitlaatservice)"));
    const actiefTwee = twee.slice(twee.indexOf("ACTIVEER:"), twee.indexOf("LAAT UITGESCHAKELD:"));
    for (const slug of ["uitlaatservice", "pension", "gedragstherapie", "webshop"]) {
      assert.ok(actiefTwee.includes(`(${slug})`), `module ontbreekt: ${slug}`);
    }
    assert.ok(!een.includes("[ ] de module Webshop is aan"));
  });

  it("behandelt de ontbrekende website alleen bij de klant zonder website", () => {
    assert.match(bouwprompt(eersteKlant), /Er is geen bevestigde website-URL aangeleverd/);
    assert.ok(bouwprompt(tweedeKlant).includes("URL: www.neusindewind.nl"));
  });

  it("schrijft beide klanten een eigen omgeving voor", () => {
    for (const p of [bouwprompt(eersteKlant), bouwprompt(tweedeKlant)]) {
      assert.match(p, /## 3\. EIGEN LOKALE PROJECTMAP/);
      assert.match(p, /## 4\. EIGEN GITHUB-REPOSITORY/);
      assert.match(p, /## 5\. EIGEN DATABASE/);
      assert.match(p, /## 6\. EIGEN VERCEL-PROJECT/);
      assert.match(p, /## 7\. EIGEN ENVIRONMENT VARIABLES/);
      assert.match(p, /## 9\. HET DOGWARE-BEHEERACCOUNT MOET WERKEN/);
    }
  });
});
