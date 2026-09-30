import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, describe, it } from "node:test";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { DemoPdfFout, maakDemoPdf, type Limieten } from "../lib/demo-pdf/maak.ts";

/**
 * De echte generator, met een echte Chrome, tegen een lokale "demo" die
 * zich zo lastig mogelijk gedraagt: een pagina die nooit antwoordt, een
 * 500, een redirect naar een ander domein, een redirect-lus, een pagina die
 * nooit "network idle" wordt, een afbeelding die nooit binnenkomt.
 *
 * Wat we willen zien: de goede pagina's komen in de PDF, de slechte worden
 * overgeslagen, niets wacht langer dan zijn limiet, en de browser is na
 * afloop altijd dicht. Zonder lokale Chrome worden deze tests overgeslagen.
 */

const CHROME = process.env.CHROME_EXECUTABLE_PATH?.trim() || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const zonderChrome = !existsSync(CHROME);

// Korte limieten, zodat de test snel is; de verhoudingen zijn als in productie.
const SNEL: Partial<Limieten> = {
  totaal: 90_000,
  navigatie: 2_500,
  laden: 1_000,
  netwerkRust: 800,
  scrollen: 3_000,
  foto: 4_000,
  route: 15_000,
  mobiel: 12_000,
  rapportReserve: 12_000,
};

let server: Server;
let basis = "";
let extern = "";
let homeStatus = 200;
const hangend: Array<() => void> = [];

const pagina = (titel: string, lichaam = "") =>
  `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${titel}</title></head>` +
  `<body style="margin:0;font-family:sans-serif"><header><nav>` +
  ["/goed", "/traag", "/fout", "/extern", "/lus", "/nooit-stil", "/goed?utm=1", "/goed#boven", "mailto:a@b.nl", "tel:0612345678", "https://www.instagram.com/demo"]
    .map((h) => `<a href="${h}">${h.replace(/^\//, "") || "home"}</a> `)
    .join("") +
  `</nav></header><main><h1>${titel}</h1>${lichaam}<div style="height:2400px;background:linear-gradient(#fde,#def)"></div></main></body></html>`;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const html = (body: string, status = 200) => {
      res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    };
    switch (url.pathname) {
      case "/":
        if (homeStatus !== 200) return html("stuk", homeStatus);
        // Veel interne links, ook dubbel, en een afbeelding die nooit binnenkomt.
        return html(
          pagina(
            "Home",
            `<img src="/nooit-beeld.png" width="200" height="100">` +
              Array.from({ length: 600 }, (_, i) => `<a href="/item/${i % 150}">item</a>`).join(" "),
          ),
        );
      case "/goed":
        return html(pagina("Goede pagina"));
      case "/traag":
        hangend.push(() => res.destroy());
        return; // antwoordt nooit
      case "/fout":
        return html("kapot", 500);
      case "/extern":
        res.writeHead(302, { location: `${extern}/goed` });
        return res.end();
      case "/lus":
        res.writeHead(302, { location: "/lus-2" });
        return res.end();
      case "/lus-2":
        res.writeHead(302, { location: "/lus" });
        return res.end();
      case "/nooit-stil":
        // Pollt eeuwig en houdt een stream open: wordt nooit "network idle".
        return html(
          pagina(
            "Nooit stil",
            `<script>setInterval(() => fetch("/ping?" + Math.random()), 150); fetch("/stroom");</script>`,
          ),
        );
      case "/ping":
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("pong");
      case "/stroom":
        res.writeHead(200, { "content-type": "text/plain" });
        res.write("start");
        hangend.push(() => res.destroy());
        return;
      case "/nooit-beeld.png":
        hangend.push(() => res.destroy());
        return;
      default:
        return html(pagina(url.pathname));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  basis = `http://127.0.0.1:${port}/`;
  extern = `http://localhost:${port}`; // zelfde server, maar een ander domein (origin)
});

after(async () => {
  hangend.forEach((f) => f());
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});

/** Start een echte Chrome en onthoudt hem, zodat we kunnen controleren dat hij dicht is. */
const gestart: Browser[] = [];
function browserMet(pas?: (page: Page) => void) {
  return async () => {
    const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
    gestart.push(b);
    if (pas) {
      const nieuw = b.newPage.bind(b);
      (b as unknown as { newPage: () => Promise<Page> }).newPage = async () => {
        const p = await nieuw();
        pas(p);
        return p;
      };
    }
    return b;
  };
}

afterEach(() => {
  for (const b of gestart.splice(0)) assert.equal(b.connected, false, "de browser moet na afloop dicht zijn");
});

const maak = (extra: Partial<Parameters<typeof maakDemoPdf>[0]> = {}) =>
  maakDemoPdf({
    demoUrl: basis,
    bedrijfsnaam: "Testdemo",
    demoDatum: null,
    limieten: SNEL,
    startBrowser: browserMet(),
    log: () => {},
    ...extra,
  });

describe("de generator tegen een lastige demo", { skip: zonderChrome && "geen lokale Chrome" }, () => {
  it("slechte pagina's worden overgeslagen, de goede komen in een geldige PDF", async () => {
    homeStatus = 200;
    const t = Date.now();
    const res = await maak();
    const duur = Date.now() - t;

    assert.equal(res.pdf.subarray(0, 5).toString(), "%PDF-");
    const paden = res.routes.map((r) => r.pad);
    // Home, de goede pagina en de pagina die nooit stil wordt: allemaal gelukt.
    assert.deepEqual(paden, ["/", "/goed", "/nooit-stil"]);
    // Nooit antwoord, 500, extern domein, redirect-lus: overgeslagen, met reden.
    const overgeslagen = Object.fromEntries(res.overgeslagen.map((o) => [o.pad, o.reden]));
    assert.deepEqual(Object.keys(overgeslagen).sort(), ["/extern", "/fout", "/lus", "/traag"]);
    assert.match(overgeslagen["/fout"], /HTTP 500/);
    assert.match(overgeslagen["/traag"], /navigatie|timeout/i);
    // Geen dubbele routes (query/anker), geen mailto/tel/Instagram, niet meer dan het maximum.
    assert.equal(new Set(paden).size, paden.length);
    assert.ok(paden.length + res.overgeslagen.length <= 7);
    // Een pagina die nooit "network idle" wordt en een afbeelding die nooit komt, houden niets op.
    assert.ok(duur < 60_000, `duurde ${duur} ms`);
  });

  it("de homepage mislukt: geen PDF, een duidelijke fout, browser dicht", async () => {
    homeStatus = 500;
    await assert.rejects(maak(), (err: unknown) => err instanceof DemoPdfFout && err.code === "ONBEREIKBAAR");
    homeStatus = 200;
  });

  it("één kapotte schermafbeelding: alleen die pagina valt weg", async () => {
    const res = await maak({
      startBrowser: browserMet((page) => {
        const echt = page.screenshot.bind(page);
        (page as unknown as { screenshot: typeof echt }).screenshot = (async (o: Parameters<typeof echt>[0]) => {
          if (page.url().includes("/goed")) throw new Error("schermafbeelding kapot");
          return echt(o);
        }) as typeof echt;
      }),
    });
    assert.ok(!res.routes.some((r) => r.pad === "/goed"));
    assert.match(res.overgeslagen.find((o) => o.pad === "/goed")?.reden ?? "", /schermafbeelding kapot/);
    assert.ok(res.routes.some((r) => r.pad === "/"));
  });

  it("globale deadline: een stap die blijft hangen, stopt op tijd en de browser gaat dicht", async () => {
    const t = Date.now();
    await assert.rejects(
      maak({
        // Printen hangt voor altijd; alleen de globale deadline kan dit nog stoppen.
        limieten: { ...SNEL, totaal: 20_000, printen: 120_000, rapportReserve: 3_000, mobiel: 0 },
        startBrowser: browserMet((page) => {
          (page as unknown as { pdf: () => Promise<never> }).pdf = () => new Promise<never>(() => {});
        }),
      }),
      (err: unknown) => err instanceof DemoPdfFout && err.code === "TIJD",
    );
    const duur = Date.now() - t;
    assert.ok(duur < 20_000 + 6_000, `duurde ${duur} ms`);
  });

  it("afgebroken verzoek: stopt direct en de browser gaat dicht", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1_500);
    await assert.rejects(maak({ signal: ac.signal }), (err: unknown) => err instanceof DemoPdfFout && err.code === "AFGEBROKEN");
  });

  it("de browser start niet: nette fout, geen hangende browser", async () => {
    await assert.rejects(
      maak({ startBrowser: () => new Promise<never>(() => {}), limieten: { ...SNEL, browserStart: 500 } }),
      (err: unknown) => err instanceof DemoPdfFout && err.code === "BROWSER",
    );
  });
});
