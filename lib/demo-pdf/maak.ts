import "server-only";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser, HTTPRequest, Page } from "puppeteer-core";
import { beoordeelVerzoek } from "./blokkeren";
import { kiesDemoRoutes, type DemoLink, type DemoRoute } from "./routes";
import { aantalPaginas, bouwRapportHtml, type RapportScherm } from "./rapport";

/**
 * Maakt de demo-PDF: schermafbeeldingen van de voorbeeldwebsite, opgemaakt
 * in DogWare-stijl en door dezelfde browser naar PDF geprint.
 *
 * Techniek: headless Chromium via puppeteer-core. Op Vercel (Linux) levert
 * @sparticuz/chromium de browser; lokaal Chrome (CHROME_EXECUTABLE_PATH of de
 * standaardlocatie op macOS). Er wordt alleen gelezen van de demo: pagina's
 * openen, de cookiemelding wegklikken met de privacyvriendelijkste keuze,
 * scrollen zodat animaties en lazy loading klaar zijn, en fotograferen.
 *
 * Een demo is onbetrouwbare invoer. Daarom:
 *   - heeft elke browserhandeling een eigen tijdslimiet (LIMIETEN), en de
 *     hele generator een deadline ruim vóór de 300 s van Vercel;
 *   - krijgt elke pagina een vers tabblad, en mag elke pagina behalve de
 *     homepage mislukken: die slaan we over en we gaan door;
 *   - wachten we nooit op "network idle" (Next.js-sites worden dat niet
 *     altijd), maar op de DOM plus een korte, begrensde rustperiode;
 *   - blijft de browser op het domein van de demo en haalt hij geen
 *     tracking, video of prefetches op (zie blokkeren.ts);
 *   - wordt de browser in elk codepad gesloten, desnoods hard.
 *
 * Mislukt iets wezenlijks (homepage onbereikbaar, browser start niet,
 * deadline verstreken, PDF te groot), dan volgt een DemoPdfFout en wordt er
 * niets opgeslagen. Elke stap logt een regel "demo_pdf:…" met de duur.
 */

export type DemoPdfFoutCode = "ONBEREIKBAAR" | "BROWSER" | "LEEG" | "TE_GROOT" | "TIJD" | "AFGEBROKEN";

export class DemoPdfFout extends Error {
  code: DemoPdfFoutCode;
  constructor(code: DemoPdfFoutCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type OvergeslagenRoute = { pad: string; reden: string };

export type DemoPdf = {
  pdf: Buffer;
  paginas: number;
  routes: DemoRoute[];
  schermen: number;
  overgeslagen: OvergeslagenRoute[];
  duurMs: number;
};

/** Alle tijdslimieten in milliseconden. */
export const LIMIETEN = {
  /** De hele generator. Vercel stopt de functie pas na 300 s. */
  totaal: 180_000,
  browserStart: 15_000,
  /** Elke losse opdracht aan de browser (puppeteer's protocolTimeout). */
  protocol: 20_000,
  tabblad: 10_000,
  /** Tot de HTML er is (DOMContentLoaded). */
  navigatie: 15_000,
  /** Daarna nog even op het load-event (afbeeldingen, fonts). */
  laden: 4_000,
  netwerkRust: 2_000,
  cookiemelding: 3_000,
  scrollen: 8_000,
  foto: 12_000,
  /** Eén desktoppagina, van openen tot laatste foto. */
  route: 40_000,
  mobiel: 30_000,
  /** Zoveel tijd houden we altijd over voor het opmaken en printen van de PDF. */
  rapportReserve: 45_000,
  rapportOpbouw: 20_000,
  printen: 30_000,
  sluiten: 5_000,
};
export type Limieten = typeof LIMIETEN;

const DESKTOP = { width: 1440, height: 900 };
const MOBIEL = { width: 390, height: 844 };
/** Ruim onder de 40 MB van Resend en prettig als mailbijlage. */
export const MAX_PDF_BYTES = 12 * 1024 * 1024;

export type DemoPdfLog = (stap: string, data?: Record<string, unknown>) => void;

/** Een stap die zijn tijdslimiet overschreed. */
class TeLang extends Error {
  constructor(wat: string, ms: number) {
    super(`${wat}: langer dan ${Math.round(ms)} ms`);
  }
}

/**
 * Wacht hooguit `ms` op `p`. Een belofte die later alsnog faalt, wordt
 * opgevangen: die mag het proces niet laten crashen.
 */
export function binnen<T>(p: Promise<T>, ms: number, wat: string): Promise<T> {
  p.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limiet = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TeLang(wat, ms)), Math.max(0, ms));
    // Een bewaker, geen werk: hij houdt het proces niet in leven.
    timer.unref?.();
  });
  return Promise.race([p, limiet]).finally(() => clearTimeout(timer));
}

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));
const redenVan = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200);

/**
 * Op Vercel is er geen GPU. @sparticuz/chromium emuleert er standaard een
 * met SwiftShader, en dat maakt blur-effecten (backdrop-filter, filter:
 * blur) peperduur: één schermafbeelding van de Erve Nyland-demo kostte zo
 * 10 seconden. Chromium's eigen CPU-rendering (Skia) tekent exact hetzelfde
 * beeld in ~0,1 seconde. Dus: geen GPU-emulatie, gewoon op de CPU.
 */
const SWIFTSHADER = /^--(use-gl|use-angle|enable-unsafe-swiftshader|in-process-gpu|ignore-gpu-blocklist)(=|$)/;
export const CPU_RENDEREN = ["--disable-gpu", "--disable-gpu-compositing"];

async function startBrowser(L: Limieten): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const eigen = process.env.CHROME_EXECUTABLE_PATH?.trim();
  const gedeeld = { headless: true, timeout: L.browserStart, protocolTimeout: L.protocol } as const;
  if (!eigen && process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      ...gedeeld,
      args: [...chromium.args.filter((a) => !SWIFTSHADER.test(a)), ...CPU_RENDEREN, "--hide-scrollbars", "--lang=nl-NL"],
      executablePath: await chromium.executablePath(),
    });
  }
  return puppeteer.launch({
    ...gedeeld,
    executablePath: eigen || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--hide-scrollbars", "--lang=nl-NL"],
  });
}

/** Sluit de browser; lukt dat niet binnen de limiet, dan het proces hard stoppen. */
async function sluitBrowser(browser: Browser, ms: number): Promise<"netjes" | "hard"> {
  try {
    await binnen(browser.close(), ms, "browser sluiten");
    return "netjes";
  } catch {
    browser.process()?.kill("SIGKILL");
    return "hard";
  }
}

/**
 * Klikt een cookiemelding weg — bij voorkeur met "alleen noodzakelijk" — en
 * verbergt wat er daarna nog aan vaste meldingen over cookies in beeld staat.
 */
async function ruimCookieMeldingOp(page: Page) {
  await page.evaluate(() => {
    const knoppen = [...document.querySelectorAll("button, a[role=button]")] as HTMLElement[];
    const zoek = (r: RegExp) => knoppen.find((k) => r.test(k.innerText.trim()));
    const knop =
      zoek(/alleen (noodzakelijk|functioneel|essentieel)|weiger|afwijzen|niet akkoord/i) ??
      zoek(/^(akkoord|accepteer|accepteren|ok|oké|prima)/i);
    knop?.click();
  });
  await wacht(400);
  await page.evaluate(() => {
    for (const el of [...document.querySelectorAll("body *")] as HTMLElement[]) {
      const pos = getComputedStyle(el).position;
      if ((pos === "fixed" || pos === "sticky") && /cookie/i.test(el.innerText ?? "") && el.innerText.length < 800) {
        el.style.setProperty("display", "none", "important");
      }
    }
    for (const sel of ["nextjs-portal", "[data-nextjs-toast]", "#vercel-live-feedback", "vercel-live-feedback"]) {
      document.querySelectorAll(sel).forEach((e) => (e as HTMLElement).style.setProperty("display", "none", "important"));
    }
  });
}

/**
 * Rustig naar beneden en terug, zodat animaties en lazy loading afgerond
 * zijn. Begrensd: hooguit 40 stappen (een lange pagina in grotere stappen),
 * en op afbeeldingen en fonts wordt maar kort gewacht.
 */
async function scrolDoor(page: Page) {
  await page.evaluate(async () => {
    const pauze = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const hoogte = Math.min(document.documentElement.scrollHeight, 30_000);
    const stap = Math.max(300, Math.floor(window.innerHeight * 0.6), Math.ceil(hoogte / 40));
    // Direct, niet "smooth": anders loopt de scroll achter op de pauzes.
    for (let y = 0; y < hoogte; y += stap) {
      window.scrollTo({ top: y, behavior: "instant" });
      await pauze(140);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    const laden = [...document.images]
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise((r) => {
            img.addEventListener("load", r, { once: true });
            img.addEventListener("error", r, { once: true });
          }),
      );
    await Promise.race([Promise.all(laden), pauze(2500)]);
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    await Promise.race([fonts, pauze(1500)]);
  });
  await wacht(500);
}

/** Een Nederlandse bezoeker: taal, datumnotatie en tijdzone zoals de klant ze ziet. */
async function alsNederlander(page: Page) {
  await page.setExtraHTTPHeaders({ "Accept-Language": "nl-NL,nl;q=0.9" });
  await page.emulateTimezone("Europe/Amsterdam");
}

/** Waar we een lange pagina fotograferen: boven, en daarna verspreid. */
export function fotoHoogtes(paginaHoogte: number, venster: number, max: number): number[] {
  const ruimte = Math.max(0, paginaHoogte - venster);
  if (ruimte < venster * 0.5 || max <= 1) return [0];
  const n = Math.min(max, 1 + Math.floor(ruimte / venster));
  return Array.from({ length: n }, (_, i) => Math.round((ruimte * i) / (n - 1 || 1)));
}

async function logoDataUri(): Promise<string> {
  const buf = await readFile(path.join(process.cwd(), "public", "brand", "logo.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

type Vastgelegd = { fotos: string[]; kop: string; links?: { menu: DemoLink[]; inhoud: DemoLink[] } };

/**
 * Eén pagina vastleggen in een eigen, vers tabblad. Elke stap is begrensd;
 * `tot` is het uiterste moment (epoch ms) voor de hele pagina. Gooit bij
 * een fout — de aanroeper beslist of de pagina mag worden overgeslagen.
 */
async function legVast(
  browser: Browser,
  url: string,
  o: {
    origin: string;
    venster: { width: number; height: number; deviceScaleFactor: number; isMobile?: boolean; hasTouch?: boolean };
    maxFotos: number;
    kwaliteit: number;
    metLinks?: boolean;
    tot: number;
    L: Limieten;
    log: DemoPdfLog;
    pad: string;
  },
): Promise<Vastgelegd> {
  const { L, log, pad } = o;
  const stap = <T,>(p: Promise<T>, max: number, wat: string) => binnen(p, Math.min(max, o.tot - Date.now()), wat);
  const start = Date.now();
  const geblokkeerd: Record<string, number> = {};

  const page = await stap(browser.newPage(), L.tabblad, "tabblad openen");
  try {
    page.on("dialog", (d) => void d.dismiss().catch(() => {}));
    await stap(
      (async () => {
        await alsNederlander(page);
        await page.setViewport(o.venster);
        await page.setRequestInterception(true);
      })(),
      L.tabblad,
      "tabblad instellen",
    );
    page.on("request", (req: HTTPRequest) => {
      if (req.isInterceptResolutionHandled()) return;
      const besluit = beoordeelVerzoek(
        { url: req.url(), soort: req.resourceType(), hoofdnavigatie: req.isNavigationRequest() && req.frame() === page.mainFrame() },
        o.origin,
      );
      if (besluit.blokkeer) {
        geblokkeerd[besluit.reden] = (geblokkeerd[besluit.reden] ?? 0) + 1;
        void req.abort("blockedbyclient").catch(() => {});
      } else void req.continue().catch(() => {});
    });

    const res = await stap(
      page.goto(url, { waitUntil: "domcontentloaded", timeout: Math.max(1, Math.min(L.navigatie, o.tot - Date.now())) }),
      L.navigatie,
      "navigatie",
    );
    if (!res) throw new Error("geen antwoord");
    if (res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
    if (new URL(page.url()).origin !== o.origin) throw new Error("doorgestuurd naar een ander domein");
    const geladen = Date.now();

    // Een korte, begrensde rustperiode in plaats van "network idle": die komt er soms nooit.
    await stap(page.waitForFunction(() => document.readyState === "complete", { timeout: L.laden }), L.laden, "load").catch(() => {});
    await stap(page.waitForNetworkIdle({ idleTime: 500, concurrency: 2, timeout: L.netwerkRust }), L.netwerkRust, "netwerkrust").catch(() => {});
    await stap(ruimCookieMeldingOp(page), L.cookiemelding, "cookiemelding").catch(() => {});

    let links: Vastgelegd["links"];
    if (o.metLinks) {
      links = await stap(
        page.evaluate(() => {
          const lees = (els: Element[]) =>
            (els as HTMLAnchorElement[])
              .filter((a) => a.getAttribute("href"))
              .slice(0, 400)
              .map((a) => ({ href: a.getAttribute("href")!, tekst: (a.innerText || a.getAttribute("aria-label") || "").slice(0, 80) }));
          const header = document.querySelector("header");
          const nav = header?.querySelector("nav") ?? document.querySelector("nav");
          const main = document.querySelector("main") ?? document.body;
          return { menu: lees(nav ? [...nav.querySelectorAll("a")] : []), inhoud: lees([...main.querySelectorAll("a")]) };
        }),
        L.tabblad,
        "links lezen",
      );
    }

    const scrollStart = Date.now();
    await stap(scrolDoor(page), L.scrollen, "scrollen").catch((err) => {
      // Half gescrold is nog steeds een bruikbare pagina.
      log("route:scroll_afgebroken", { pad, reden: redenVan(err) });
    });
    const scrollMs = Date.now() - scrollStart;

    const { kop, hoogte } = await stap(
      page.evaluate(() => ({
        kop: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        hoogte: document.documentElement.scrollHeight,
      })),
      L.tabblad,
      "hoogte meten",
    );

    const fotoStart = Date.now();
    const fotos: string[] = [];
    for (const y of fotoHoogtes(hoogte, o.venster.height, o.maxFotos)) {
      // Direct scrollen (demo's gebruiken scroll-behavior: smooth, voor een foto willen
      // we geen animatie) en daarna 1,2 s frames laten tekenen: zonder GPU maakt
      // headless Chromium alleen frames op verzoek, en zonder frames reageert de site
      // niet op de scroll en lopen overgangen niet door (bijv. een header die boven
      // weer transparant wordt).
      await stap(
        page.evaluate(async (top: number) => {
          window.scrollTo({ top, behavior: "instant" });
          const tot = performance.now() + 1_200;
          await new Promise<void>((klaar) => {
            const frame = () => (performance.now() < tot ? requestAnimationFrame(frame) : klaar());
            requestAnimationFrame(frame);
          });
        }, y),
        L.tabblad,
        "scrollen naar foto",
      );
      const b64 = await stap(
        page.screenshot({ type: "jpeg", quality: o.kwaliteit, encoding: "base64", optimizeForSpeed: true, captureBeyondViewport: false }),
        L.foto,
        "schermafbeelding",
      );
      fotos.push(`data:image/jpeg;base64,${b64}`);
    }

    log("route:loaded", {
      pad,
      laadMs: geladen - start,
      scrollMs,
      fotoMs: Date.now() - fotoStart,
      fotos: fotos.length,
      totaalMs: Date.now() - start,
      geblokkeerd,
    });
    return { fotos, kop, links };
  } finally {
    await binnen(page.close(), L.tabblad, "tabblad sluiten").catch(() => {});
  }
}

export async function maakDemoPdf(input: {
  demoUrl: string;
  portaalUrl?: string | null;
  bedrijfsnaam: string;
  demoDatum: Date | null;
  nu?: Date;
  /** Afbreken, bijvoorbeeld als het verzoek van de beheerder wegvalt. */
  signal?: AbortSignal;
  /** Alleen voor tests: kortere limieten, een eigen browser, een eigen log. */
  limieten?: Partial<Limieten>;
  startBrowser?: () => Promise<Browser>;
  log?: DemoPdfLog;
}): Promise<DemoPdf> {
  const L: Limieten = { ...LIMIETEN, ...input.limieten };
  const begin = Date.now();
  const run = randomBytes(4).toString("hex");
  const log: DemoPdfLog =
    input.log ?? ((stap, data) => console.info(JSON.stringify({ evt: `demo_pdf:${stap}`, run, ms: Date.now() - begin, ...data })));

  let basis: URL;
  try {
    basis = new URL(input.demoUrl);
    if (basis.protocol !== "https:" && basis.protocol !== "http:") throw new Error("geen http(s)");
  } catch {
    throw new DemoPdfFout("ONBEREIKBAAR", "De demo-URL van deze aanvraag is ongeldig.");
  }
  // Alleen het domein: geen querystrings met mogelijke tokens, geen klantgegevens.
  log("start", { host: basis.host, deadlineMs: L.totaal });

  const deadline = begin + L.totaal;
  const over = () => deadline - Date.now();

  // De harde stop: bij de deadline of als het verzoek wegvalt, gaat de browser
  // dicht en faalt alles wat er nog op wacht.
  const stop = new AbortController();
  let browser: Browser | null = null;
  const stopNu = (reden: "TIJD" | "AFGEBROKEN") => {
    if (stop.signal.aborted) return;
    stop.abort(reden);
    log(reden === "TIJD" ? "deadline" : "afgebroken");
    if (browser) void sluitBrowser(browser, L.sluiten);
  };
  const deadlineTimer = setTimeout(() => stopNu("TIJD"), L.totaal);
  const opAfbreken = () => stopNu("AFGEBROKEN");
  input.signal?.addEventListener("abort", opAfbreken, { once: true });
  if (input.signal?.aborted) stopNu("AFGEBROKEN");

  const alsFout = (err: unknown): DemoPdfFout => {
    if (stop.signal.reason === "AFGEBROKEN") return new DemoPdfFout("AFGEBROKEN", "Het maken van de PDF is afgebroken.");
    if (stop.signal.aborted || over() <= 0) return new DemoPdfFout("TIJD", "De demo kon niet op tijd worden vastgelegd.");
    if (err instanceof DemoPdfFout) return err;
    return new DemoPdfFout("BROWSER", `De PDF kon niet worden gemaakt: ${redenVan(err)}`);
  };

  // Alles wat hieronder gebeurt, racet tegen de harde stop: ook een stap die
  // aan niets anders gekoppeld is, houdt de generator niet langer op dan de deadline.
  const gestopt = new Promise<never>((_, reject) => {
    if (stop.signal.aborted) reject(new Error("gestopt"));
    stop.signal.addEventListener("abort", () => reject(new Error("gestopt")), { once: true });
  });
  gestopt.catch(() => {});

  const werk = (async (): Promise<DemoPdf> => {
    if (stop.signal.aborted) throw alsFout(null);

    log("browser_launch:start");
    const t = Date.now();
    let opgegeven = false;
    const starten = (input.startBrowser ?? (() => startBrowser(L)))();
    // Komt de browser pas na de limiet (of na de stop) alsnog op, dan meteen weer dicht.
    starten.then((b) => (opgegeven || stop.signal.aborted) && b !== browser && void sluitBrowser(b, L.sluiten)).catch(() => {});
    try {
      browser = await binnen(starten, L.browserStart, "browser starten");
    } catch (err) {
      opgegeven = true;
      if (stop.signal.aborted) throw alsFout(err);
      log("browser_launch:mislukt", { reden: redenVan(err) });
      throw new DemoPdfFout("BROWSER", `De browser voor de schermafbeeldingen kon niet starten: ${redenVan(err)}`);
    }
    log("browser_launch:done", { duurMs: Date.now() - t });
    if (stop.signal.aborted) {
      void sluitBrowser(browser, L.sluiten);
      throw alsFout(null);
    }
    const b = browser;

    // 1. De homepage: moet lukken, anders is er geen PDF.
    log("homepage:start");
    let home: Vastgelegd;
    try {
      home = await legVast(b, basis.href, {
        origin: basis.origin,
        venster: { ...DESKTOP, deviceScaleFactor: 1 },
        maxFotos: 3,
        kwaliteit: 80,
        metLinks: true,
        tot: Math.min(Date.now() + L.route, deadline - L.rapportReserve),
        L,
        log,
        pad: "/",
      });
    } catch (err) {
      if (stop.signal.aborted) throw alsFout(err);
      log("homepage:mislukt", { reden: redenVan(err) });
      throw new DemoPdfFout("ONBEREIKBAAR", `De voorbeeldwebsite ${basis.host} is niet bereikbaar: ${redenVan(err)}`);
    }
    log("homepage:loaded", { fotos: home.fotos.length });

    const routes = kiesDemoRoutes({
      basisUrl: basis.href,
      menu: home.links?.menu ?? [],
      inhoud: home.links?.inhoud ?? [],
      portaalUrl: input.portaalUrl,
    });
    log("routes:discovered", { aantal: routes.length, paden: routes.map((r) => r.pad) });

    const schermen: RapportScherm[] = [];
    const bruikbareRoutes: DemoRoute[] = [];
    const overgeslagen: OvergeslagenRoute[] = [];
    const voegToe = (route: DemoRoute, fotos: string[]) => {
      fotos.forEach((src, i) => schermen.push({ titel: route.titel, pad: route.pad, deel: { nummer: i + 1, van: fotos.length }, src }));
      bruikbareRoutes.push(route);
    };
    voegToe(routes[0], home.fotos);

    // 2. De overige pagina's: best effort. Een pagina die faalt of te lang duurt, slaan we over.
    for (const route of routes.slice(1)) {
      if (stop.signal.aborted) throw alsFout(null);
      const ruimte = over() - L.rapportReserve - L.mobiel / 2;
      if (ruimte < 10_000) {
        overgeslagen.push({ pad: route.pad, reden: "geen tijd meer" });
        log("route:skip", { pad: route.pad, reden: "geen tijd meer" });
        continue;
      }
      log("route:start", { pad: route.pad });
      try {
        const r = await legVast(b, new URL(route.pad, basis).href, {
          origin: basis.origin,
          venster: { ...DESKTOP, deviceScaleFactor: 1 },
          maxFotos: route.soort === "functie" ? 2 : 1,
          kwaliteit: 80,
          tot: Date.now() + Math.min(L.route, ruimte),
          L,
          log,
          pad: route.pad,
        });
        // Bij een dienst- of aanvraagpagina zegt de eigen kop meer dan de knoptekst die ernaar verwees.
        if (route.soort === "functie" && r.kop.length >= 3 && r.kop.length <= 45) route.titel = r.kop;
        voegToe(route, r.fotos);
        log("route:done", { pad: route.pad });
      } catch (err) {
        if (stop.signal.aborted) throw alsFout(err);
        overgeslagen.push({ pad: route.pad, reden: redenVan(err) });
        log("route:skip", { pad: route.pad, reden: redenVan(err) });
      }
    }

    // 3. Eén mobiele impressie van de homepage — mooi meegenomen, nooit een reden om te falen.
    const mobiel: string[] = [];
    const mobielRuimte = Math.min(L.mobiel, over() - L.rapportReserve);
    if (mobielRuimte >= 10_000) {
      log("mobile:start");
      try {
        const m = await legVast(b, basis.href, {
          origin: basis.origin,
          venster: { ...MOBIEL, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
          maxFotos: 3,
          kwaliteit: 72,
          tot: Date.now() + mobielRuimte,
          L,
          log,
          pad: "/ (mobiel)",
        });
        mobiel.push(...m.fotos);
        log("mobile:done", { fotos: mobiel.length });
      } catch (err) {
        if (stop.signal.aborted) throw alsFout(err);
        log("mobile:skip", { reden: redenVan(err) });
      }
    } else log("mobile:skip", { reden: "geen tijd meer" });

    // 4. Het rapport opmaken en printen.
    log("report:start", { schermen: schermen.length, mobiel: mobiel.length });
    const rapport = {
      bedrijfsnaam: input.bedrijfsnaam,
      demoUrl: basis.href,
      demoDatum: input.demoDatum,
      gemaaktOp: input.nu ?? new Date(),
      logoSrc: await logoDataUri(),
      schermen,
      mobiel,
    };
    let pdf: Buffer;
    const printer = await binnen(b.newPage(), L.tabblad, "tabblad openen");
    try {
      await binnen(printer.setContent(bouwRapportHtml(rapport), { waitUntil: "load", timeout: L.rapportOpbouw }), L.rapportOpbouw, "rapport opbouwen");
      await binnen(
        printer.evaluate(async () => {
          await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
        }),
        3_000,
        "rapportfonts",
      ).catch(() => {});
      pdf = Buffer.from(
        await binnen(
          printer.pdf({ format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true, timeout: L.printen }),
          L.printen,
          "PDF printen",
        ),
      );
    } finally {
      await binnen(printer.close(), L.tabblad, "tabblad sluiten").catch(() => {});
    }
    if (stop.signal.aborted) throw alsFout(null);
    log("report:done", { bytes: pdf.byteLength });

    if (pdf.byteLength > MAX_PDF_BYTES) {
      throw new DemoPdfFout("TE_GROOT", `De PDF wordt ${(pdf.byteLength / 1024 / 1024).toFixed(1)} MB — te groot om netjes te mailen.`);
    }
    const duurMs = Date.now() - begin;
    const paginas = aantalPaginas(rapport);
    log("complete", { duurMs, paginas, routes: bruikbareRoutes.length, overgeslagen: overgeslagen.length, bytes: pdf.byteLength });
    return { pdf, paginas, routes: bruikbareRoutes, schermen: schermen.length, overgeslagen, duurMs };
  })();
  werk.catch(() => {});

  try {
    return await Promise.race([werk, gestopt]);
  } catch (err) {
    const fout = alsFout(err);
    log("mislukt", { code: fout.code, reden: redenVan(err), duurMs: Date.now() - begin });
    throw fout;
  } finally {
    clearTimeout(deadlineTimer);
    input.signal?.removeEventListener("abort", opAfbreken);
    if (browser) log("browser_closed", { hoe: await sluitBrowser(browser, L.sluiten) });
  }
}
