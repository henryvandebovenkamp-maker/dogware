import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { kiesDemoRoutes, titelUitPad } from "../lib/demo-pdf/routes.ts";
import { aantalPaginas, bouwRapportHtml } from "../lib/demo-pdf/rapport.ts";
import { fotoHoogtes } from "../lib/demo-pdf/maak.ts";
import { branding } from "../lib/branding.ts";

/**
 * De demo-PDF, zonder browser: welke pagina's erin komen en hoe het rapport
 * wordt opgemaakt. De echte schermafbeeldingen zijn los gecontroleerd tegen
 * een live demo.
 */

describe("welke pagina's in de PDF komen", () => {
  // Zo ziet de Walk&Care-demo eruit (menu en links van de homepage).
  const menu = [
    { href: "/", tekst: "Home" },
    { href: "/zo-werkt-het", tekst: "Zo werkt het" },
    { href: "/ons-verhaal", tekst: "Over ons" },
    { href: "/contact", tekst: "Contact" },
    { href: "/login", tekst: "Inloggen" },
    { href: "/contact", tekst: "Maak afspraak" },
  ];
  const inhoud = [
    { href: "/uitlaatservice/aanvragen", tekst: "Kennismaken" },
    { href: "/uitlaatservice/aanvragen", tekst: "Plan een kennismaking" },
    { href: "/uitlaatservice/aanvragen", tekst: "" },
    { href: "/hondenuitlaatservice", tekst: "Bekijk de uitlaatservice" },
    { href: "/hondenuitlaatservice", tekst: "Uitlaatservice" },
    { href: "/privacybeleid", tekst: "Privacy" },
    { href: "/cookiebeleid", tekst: "Cookies" },
    { href: "https://instagram.com/walkcare", tekst: "Instagram" },
    { href: "/logo.png", tekst: "" },
    { href: "/zo-werkt-het#stap-2", tekst: "Lees verder" },
  ];

  it("homepage, het menu van de demo, de dienst en de aanvraag, en het klantportaal", () => {
    const r = kiesDemoRoutes({
      basisUrl: "https://walk-care-demo.vercel.app/",
      menu,
      inhoud,
      portaalUrl: "https://walk-care-demo.vercel.app/login",
    });
    assert.deepEqual(
      r.map((x) => x.pad),
      ["/", "/zo-werkt-het", "/ons-verhaal", "/contact", "/uitlaatservice/aanvragen", "/hondenuitlaatservice", "/login"],
    );
    assert.equal(r.at(-1)?.titel, "Klantportaal");
    assert.equal(r[2].titel, "Over ons");
  });

  it("geen juridische pagina's, bestanden of externe sites; geen dubbelen", () => {
    const r = kiesDemoRoutes({ basisUrl: "https://demo.vercel.app/", menu, inhoud });
    const paden = r.map((x) => x.pad);
    assert.ok(!paden.some((p) => /privacy|cookie|login|\.png/.test(p)));
    assert.equal(new Set(paden).size, paden.length);
    assert.ok(r.length <= 7);
  });

  it("een demo zonder menu levert gewoon de homepage op", () => {
    assert.deepEqual(kiesDemoRoutes({ basisUrl: "https://demo.vercel.app/", menu: [], inhoud: [] }).map((x) => x.pad), ["/"]);
    assert.equal(titelUitPad("/uitlaatservice/aanvragen"), "Aanvragen");
  });

  it("lange pagina's worden verspreid gefotografeerd, korte één keer", () => {
    assert.deepEqual(fotoHoogtes(900, 900, 3), [0]);
    assert.deepEqual(fotoHoogtes(4500, 900, 3), [0, 1800, 3600]);
    assert.deepEqual(fotoHoogtes(4500, 900, 1), [0]);
  });
});

describe("de opmaak van het rapport", () => {
  const html = bouwRapportHtml({
    bedrijfsnaam: "Walk&Care <script>",
    demoUrl: "https://walk-care-demo.vercel.app/",
    demoDatum: new Date("2026-08-25T17:53:33Z"),
    gemaaktOp: new Date("2026-09-30T08:00:00Z"),
    logoSrc: "data:image/png;base64,AAA",
    schermen: [
      { titel: "Home", pad: "/", deel: { nummer: 1, van: 2 }, src: "data:image/jpeg;base64,AAA" },
      { titel: "Home", pad: "/", deel: { nummer: 2, van: 2 }, src: "data:image/jpeg;base64,BBB" },
    ],
    mobiel: ["data:image/jpeg;base64,CCC"],
  });

  it("voorblad, website-impressie, mobiel en slotpagina", () => {
    assert.match(html, /Jouw DogWare voorbeeldwebsite/);
    assert.match(html, /Een visuele impressie van de voorbeeldwebsite die we voor Walk&amp;Care &lt;script&gt; hebben gemaakt/);
    assert.match(html, /25 augustus 2026/);
    assert.match(html, /Ook op je telefoon/);
    assert.match(html, /Toch verder met jouw website\?/);
    assert.match(html, /1 van 2/);
    assert.equal(aantalPaginas({ schermen: [{} as never, {} as never], mobiel: ["x"] }), 5);
  });

  it("contactgegevens uit de centrale branding, niets hardgecodeerd", () => {
    assert.ok(html.includes(branding.contactEmail));
    assert.ok(html.includes(branding.phone));
    assert.ok(html.includes(branding.siteUrl.replace(/^https?:\/\//, "")));
  });

  it("de bedrijfsnaam wordt ge-escaped (geen HTML-injectie in de PDF)", () => {
    assert.doesNotMatch(html, /<script>/);
  });

  it("afbeeldingen worden nooit uitgerekt: altijd met behoud van verhouding", () => {
    assert.match(html, /object-fit: contain/);
    assert.doesNotMatch(html, /object-fit: (fill|cover)/);
  });
});
