import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALGEMEEN,
  BRANCHES,
  brancheContent,
  positioneringContent,
} from "@/lib/branches";

/**
 * Bewaking van de kernpositionering van dogware.nl.
 *
 * Wat hier vastligt is één regel: de publieke homepage opent altijd
 * branche-overkoepelend. Dat is geen smaakkwestie maar een commerciële
 * randvoorwaarde — DogWare bedient hondenscholen, trimsalons, uitlaatservices,
 * pensions en gedragstherapeuten, en wie via een advertentie binnenkomt moet
 * zich meteen aangesproken voelen.
 *
 * De regel is een keer gesneuveld: de branchekiezer bewaart de keuze van de
 * bezoeker in localStorage, en de hero las diezelfde keuze. Wie ooit op
 * "Chipservice" klikte, kreeg daarna bij élk bezoek "De laatste website die
 * jouw chipservice nodig heeft" te zien — ook maanden later, ook als nieuwe
 * bezoeker aanvoelend. De hero leest sindsdien `positioneringContent()`, dat
 * uitsluitend naar een expliciete slug kijkt.
 *
 * Deze test bewaakt zowel het gedrag als de bedrading, want juist de bedrading
 * is wat een refactor stilletjes ongedaan maakt.
 */

// fileURLToPath en niet `.pathname`: de projectmap mag spaties bevatten.
const wortel = fileURLToPath(new URL("..", import.meta.url));
const lees = (bestand: string) => readFileSync(join(wortel, bestand), "utf8");

describe("1. de homepage opent altijd algemeen", () => {
  it("noemt het hele vak, niet één branche", () => {
    assert.equal(positioneringContent().hero.kopAccent, "hondenbedrijf");
    assert.equal(ALGEMEEN.hero.kopAccent, "hondenbedrijf");
  });

  it("valt bij elke lege keuze terug op de algemene inhoud", () => {
    for (const leeg of [undefined, null, ""]) {
      assert.equal(positioneringContent(leeg).slug, "algemeen");
    }
  });

  it("kent geen enkele branchenaam in de positioneringstekst", () => {
    /**
     * "Webshop" is naast een branche ook gewoon een module van het platform —
     * het staat als menu-item in het dashboard en heeft een eigen sectie op de
     * homepage. In de functiechips betekent het dus de module, niet "dit is
     * alleen voor webshops". Elke andere branchenaam is hier wél fout.
     */
    const OOK_EEN_MODULE = new Set(["webshop"]);

    const tekst = [
      ALGEMEEN.hero.kopVoor,
      ALGEMEEN.hero.kopAccent,
      ALGEMEEN.hero.kopNa,
      ALGEMEEN.hero.sub,
      ...ALGEMEEN.hero.chips,
      ALGEMEEN.hero.notificatie.titel,
      ALGEMEEN.hero.notificatie.tekst,
      ...ALGEMEEN.dashboard.agenda.flatMap((a) => [a.title, a.who]),
    ]
      .join(" ")
      .toLowerCase();

    for (const b of BRANCHES) {
      const naam = b.naamKlein.toLowerCase();
      if (OOK_EEN_MODULE.has(naam)) continue;
      assert.ok(
        !tekst.includes(naam),
        `De algemene hero noemt "${b.naamKlein}". Dat sluit elk ander hondenbedrijf uit; houd deze tekst branche-overkoepelend.`,
      );
    }
  });

  it("zet in de kop en subtekst geen enkele branche op de voorgrond", () => {
    // De zinnen waarmee de bezoeker wordt aangesproken zijn strenger dan de
    // functiechips: hier mag geen enkele branchenaam in staan, ook "webshop"
    // niet — dat zou de kop alsnog tot één vak versmallen.
    const zinnen = [
      ALGEMEEN.hero.kopVoor,
      ALGEMEEN.hero.kopAccent,
      ALGEMEEN.hero.kopNa,
      ALGEMEEN.hero.sub,
    ]
      .join(" ")
      .toLowerCase();

    for (const b of BRANCHES) {
      assert.ok(
        !zinnen.includes(b.naamKlein.toLowerCase()),
        `De kop of subtekst van de homepage noemt "${b.naamKlein}".`,
      );
    }
  });
});

describe("2. een onthouden branchekeuze kaapt de hero niet", () => {
  it("laat de kernpositionering ongemoeid, wat er ook onthouden is", () => {
    // brancheContent() is de laag die de secties ónder de hero voedt en die
    // wél naar de onthouden keuze kijkt. positioneringContent() mag daar
    // nooit in meebewegen.
    assert.equal(brancheContent("chipservice").slug, "chipservice");
    assert.equal(positioneringContent().slug, "algemeen");
  });

  it("haalt de hero-inhoud uit positioneringContent, niet uit de keuze", () => {
    const bron = lees("components/sections/hero-view.tsx");
    assert.match(
      bron,
      /const c = positioneringContent\(branche\)/,
      "De hero moet zijn inhoud uit positioneringContent halen.",
    );
    assert.ok(
      !/const c = useBrancheContent\(/.test(bron),
      "De hero-inhoud mag niet uit de onthouden branchekeuze komen.",
    );
  });

  it("houdt ook het dashboardvoorbeeld in de hero algemeen", () => {
    const bron = lees("components/dashboard-mock.tsx");
    assert.match(bron, /positioneringContent\(branche\)/);
    assert.ok(
      !bron.includes("useBrancheContent"),
      "Het dashboardvoorbeeld hoort bij de kernpositionering en mag de onthouden keuze niet lezen.",
    );
  });

  it("pint op de homepage zelf geen branche vast", () => {
    assert.match(
      lees("app/page.tsx"),
      /<Hero \/>/,
      "De homepage geeft bewust geen branche mee aan de hero.",
    );
  });

  it("laat een branchekeuze niet langer meegaan dan het bezoek", () => {
    const bron = lees("components/branche/branche-context.tsx");

    assert.match(
      bron,
      /sessionStorage\.getItem\(STORAGE_KEY\)/,
      "De branchekeuze hoort bij dit bezoek en komt uit sessionStorage.",
    );
    assert.match(bron, /sessionStorage\.setItem\(STORAGE_KEY/);

    // localStorage mag hier alleen nog voorkomen om de oude, permanente
    // sleutel op te ruimen — nooit meer om de keuze te bewaren of te lezen.
    assert.ok(
      !/localStorage\.setItem/.test(bron) && !/localStorage\.getItem/.test(bron),
      "Een branchekeuze mag niet permanent bewaard blijven: dan opent de site bij een volgend bezoek alsnog in één vak.",
    );
  });
});

describe("3. een branchelandingspagina mag wél specifiek zijn", () => {
  it("geeft zijn eigen branche expliciet door aan de hero", () => {
    assert.match(
      lees("components/landing/branche-page.tsx"),
      /<Hero branche=\{branche\.slug\} \/>/,
    );
  });

  it("toont per branche ook echt die branche", () => {
    for (const b of BRANCHES) {
      assert.equal(positioneringContent(b.slug).slug, b.slug);
    }
  });
});
