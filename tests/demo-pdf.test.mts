import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { MAX_ROUTES, kiesDemoRoutes, titelUitPad } from "../lib/demo-pdf/routes.ts";
import { beoordeelVerzoek } from "../lib/demo-pdf/blokkeren.ts";
import { aantalPaginas, bouwRapportHtml } from "../lib/demo-pdf/rapport.ts";
import { LIMIETEN, binnen, fotoHoogtes } from "../lib/demo-pdf/maak.ts";
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

describe("route-discovery blijft klein en op het eigen domein", () => {
  const basisUrl = "https://demo.vercel.app/";

  it("externe domeinen, mailto/tel, API, downloads en uitloggen vallen af", () => {
    const menu = [
      { href: "https://www.instagram.com/demo", tekst: "Instagram" },
      { href: "https://dogware.nl/", tekst: "DogWare" },
      { href: "https://oud-domein.nl/diensten", tekst: "Oud" },
      { href: "//evil.example/pad", tekst: "Protocol-relatief" },
      { href: "mailto:info@demo.nl", tekst: "Mail" },
      { href: "tel:0612345678", tekst: "Bel" },
      { href: "javascript:void(0)", tekst: "Niets" },
      { href: "/api/aanvraag", tekst: "API" },
      { href: "/brochure.pdf", tekst: "Brochure" },
      { href: "/prijzen.zip", tekst: "Download" },
      { href: "/uitloggen", tekst: "Uitloggen" },
      { href: "/_next/static/x", tekst: "Next" },
      { href: "/algemene-voorwaarden", tekst: "Voorwaarden" },
      { href: "/diensten", tekst: "Diensten" },
    ];
    const paden = kiesDemoRoutes({ basisUrl, menu, inhoud: [] }).map((r) => r.pad);
    assert.deepEqual(paden, ["/", "/diensten"]);
  });

  it("queryvarianten, ankers en slashes tellen als één pagina", () => {
    const menu = [
      { href: "/diensten", tekst: "Diensten" },
      { href: "/diensten?utm_source=x", tekst: "Diensten" },
      { href: "/diensten#prijzen", tekst: "Diensten" },
      { href: "/diensten/", tekst: "Diensten" },
      { href: "https://demo.vercel.app/diensten", tekst: "Diensten" },
      { href: "#boven", tekst: "Naar boven" },
    ];
    const paden = kiesDemoRoutes({ basisUrl, menu, inhoud: [] }).map((r) => r.pad);
    assert.deepEqual(paden, ["/", "/diensten"]);
  });

  it("duizenden interne links: nooit meer dan het maximum, en geen diep geneste items", () => {
    const menu = Array.from({ length: 50 }, (_, i) => ({ href: `/pagina-${i}`, tekst: `Pagina ${i}` }));
    const inhoud = Array.from({ length: 5000 }, (_, i) => ({ href: `/blog/2026/09/post-${i}`, tekst: "Lees meer" }));
    const routes = kiesDemoRoutes({ basisUrl, menu, inhoud, portaalUrl: "https://demo.vercel.app/login" });
    assert.equal(routes.length, MAX_ROUTES);
    assert.equal(routes.at(-1)?.soort, "portaal");
    assert.ok(!routes.some((r) => r.pad.startsWith("/blog/2026")));
    assert.equal(new Set(routes.map((r) => r.pad)).size, routes.length);
  });

  it("een portaal-URL op een ander domein komt er niet in", () => {
    const routes = kiesDemoRoutes({ basisUrl, menu: [], inhoud: [], portaalUrl: "https://ander-domein.nl/login" });
    assert.deepEqual(routes.map((r) => r.pad), ["/"]);
  });
});

describe("wat de browser niet ophaalt", () => {
  const origin = "https://demo.vercel.app";
  const v = (url: string, soort = "script", hoofdnavigatie = false) => beoordeelVerzoek({ url, soort, hoofdnavigatie }, origin);

  it("navigatie of redirect naar een ander domein: geblokkeerd", () => {
    assert.deepEqual(v("https://www.instagram.com/demo", "document", true), { blokkeer: true, reden: "extern" });
    assert.deepEqual(v("https://demo.vercel.app/contact", "document", true), { blokkeer: false });
  });

  it("analytics, tracking en Vercel Insights: geblokkeerd", () => {
    for (const url of [
      "https://www.googletagmanager.com/gtag/js?id=G-1",
      "https://www.google-analytics.com/g/collect",
      "https://connect.facebook.net/en_US/fbevents.js",
      "https://static.hotjar.com/c/hotjar-1.js",
      "https://www.clarity.ms/tag/abc",
      "https://demo.vercel.app/_vercel/insights/script.js",
      "https://demo.vercel.app/_vercel/speed-insights/script.js",
      "https://vercel.live/_next-live/feedback/feedback.js",
    ]) {
      assert.equal(v(url).blokkeer, true, url);
    }
  });

  it("video, audio, websockets, event streams en Next.js-prefetches: geblokkeerd", () => {
    assert.equal(v("https://demo.vercel.app/film.mp4", "media").blokkeer, true);
    assert.equal(v("wss://demo.vercel.app/live", "websocket").blokkeer, true);
    assert.equal(v("https://demo.vercel.app/stream", "eventsource").blokkeer, true);
    assert.equal(v("https://demo.vercel.app/tarieven?_rsc=abc", "fetch").blokkeer, true);
  });

  it("stylesheets, fonts, afbeeldingen en scripts van de demo zelf komen gewoon binnen", () => {
    assert.equal(v("https://demo.vercel.app/_next/static/css/app.css", "stylesheet").blokkeer, false);
    assert.equal(v("https://fonts.gstatic.com/s/inter.woff2", "font").blokkeer, false);
    assert.equal(v("https://bc3mgvdgdk.ufs.sh/f/foto.webp", "image").blokkeer, false);
    assert.equal(v("https://images.unsplash.com/photo-1?w=700", "image").blokkeer, false);
    assert.equal(v("https://demo.vercel.app/_next/static/chunks/main.js", "script").blokkeer, false);
    assert.equal(v("data:image/png;base64,AAAA", "image").blokkeer, false);
  });
});

describe("tijdslimieten", () => {
  it("de hele generator stopt ruim vóór de 300 s van Vercel, met ruimte voor de PDF", () => {
    assert.ok(LIMIETEN.totaal <= 210_000);
    assert.ok(LIMIETEN.totaal + LIMIETEN.sluiten + 30_000 < 300_000);
    assert.ok(LIMIETEN.rapportReserve >= LIMIETEN.rapportOpbouw);
    for (const [naam, ms] of Object.entries(LIMIETEN)) assert.ok(ms > 0 && ms <= LIMIETEN.totaal, naam);
  });

  it("binnen(): een belofte die nooit klaar is, faalt na de limiet", async () => {
    const t = Date.now();
    await assert.rejects(binnen(new Promise(() => {}), 50, "test"), /test: langer dan 50 ms/);
    assert.ok(Date.now() - t < 1000);
  });
});
