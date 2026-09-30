import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser, Page } from "puppeteer-core";
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
 * Mislukt iets wezenlijks (demo onbereikbaar, browser start niet, niets
 * gefotografeerd), dan volgt een DemoPdfFout en wordt er niets opgeslagen.
 */

export type DemoPdfFoutCode = "ONBEREIKBAAR" | "BROWSER" | "LEEG" | "TE_GROOT";

export class DemoPdfFout extends Error {
  code: DemoPdfFoutCode;
  constructor(code: DemoPdfFoutCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type DemoPdf = {
  pdf: Buffer;
  paginas: number;
  routes: DemoRoute[];
  schermen: number;
};

const DESKTOP = { width: 1440, height: 900 };
const MOBIEL = { width: 390, height: 844 };
/** Ruim onder de 40 MB van Resend en prettig als mailbijlage. */
export const MAX_PDF_BYTES = 12 * 1024 * 1024;

async function startBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const eigen = process.env.CHROME_EXECUTABLE_PATH?.trim();
  try {
    if (!eigen && process.platform === "linux") {
      const chromium = (await import("@sparticuz/chromium")).default;
      return await puppeteer.launch({
        args: [...chromium.args, "--hide-scrollbars"],
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    }
    return await puppeteer.launch({
      executablePath:
        eigen || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
      args: ["--no-sandbox", "--hide-scrollbars"],
    });
  } catch (err) {
    throw new DemoPdfFout(
      "BROWSER",
      `De browser voor de schermafbeeldingen kon niet starten: ${err instanceof Error ? err.message : "onbekend"}`,
    );
  }
}

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** Rustig naar beneden en terug, zodat animaties en lazy loading afgerond zijn. */
async function scrolDoor(page: Page) {
  await page.evaluate(async () => {
    const stap = Math.max(300, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += stap) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 140));
    }
    window.scrollTo(0, 0);
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((r) => { img.onload = img.onerror = () => r(null); setTimeout(() => r(null), 4000); }),
      ),
    );
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  });
  await wacht(700);
}

async function open(page: Page, url: string): Promise<boolean> {
  try {
    const res = await page.goto(url, { waitUntil: "networkidle2", timeout: 45_000 });
    return Boolean(res && res.status() < 400);
  } catch {
    return false;
  }
}

/** Foto van het venster op scrollhoogte y (vaste headers staan er dus netjes in). */
async function fotoOp(page: Page, y: number, kwaliteit: number): Promise<string> {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await wacht(450);
  const b64 = await page.screenshot({ type: "jpeg", quality: kwaliteit, encoding: "base64" });
  return `data:image/jpeg;base64,${b64}`;
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

export async function maakDemoPdf(input: {
  demoUrl: string;
  portaalUrl?: string | null;
  bedrijfsnaam: string;
  demoDatum: Date | null;
  nu?: Date;
}): Promise<DemoPdf> {
  let basis: URL;
  try {
    basis = new URL(input.demoUrl);
  } catch {
    throw new DemoPdfFout("ONBEREIKBAAR", "De demo-URL van deze aanvraag is ongeldig.");
  }

  const browser = await startBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...DESKTOP, deviceScaleFactor: 1 });

    if (!(await open(page, basis.href))) {
      throw new DemoPdfFout("ONBEREIKBAAR", `De voorbeeldwebsite ${basis.host} is niet bereikbaar.`);
    }
    await ruimCookieMeldingOp(page);

    // Het menu van de demo zelf en de links op de homepage bepalen de pagina's.
    const links = await page.evaluate(() => {
      const lees = (els: Element[]) =>
        (els as HTMLAnchorElement[])
          .filter((a) => a.getAttribute("href"))
          .map((a) => ({ href: a.getAttribute("href")!, tekst: a.innerText || a.getAttribute("aria-label") || "" }));
      const header = document.querySelector("header");
      const nav = header?.querySelector("nav") ?? document.querySelector("nav");
      const main = document.querySelector("main") ?? document.body;
      return { menu: lees(nav ? [...nav.querySelectorAll("a")] : []), inhoud: lees([...main.querySelectorAll("a")]) };
    });
    const routes = kiesDemoRoutes({
      basisUrl: basis.href,
      menu: links.menu as DemoLink[],
      inhoud: links.inhoud as DemoLink[],
      portaalUrl: input.portaalUrl,
    });

    const schermen: RapportScherm[] = [];
    const bruikbareRoutes: DemoRoute[] = [];
    for (const route of routes) {
      const url = new URL(route.pad, basis).href;
      if (route.pad !== "/" && !(await open(page, url))) continue; // een losse pagina die faalt, slaan we over
      if (route.pad !== "/") await ruimCookieMeldingOp(page);
      await scrolDoor(page);
      // Bij een dienst- of aanvraagpagina zegt de eigen kop meer dan de knoptekst die ernaar verwees.
      if (route.soort === "functie") {
        const kop = await page.evaluate(() => document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "");
        if (kop.length >= 3 && kop.length <= 45) route.titel = kop;
      }
      const hoogte = await page.evaluate(() => document.documentElement.scrollHeight);
      const max = route.soort === "home" ? 3 : route.soort === "functie" ? 2 : 1;
      const hoogtes = fotoHoogtes(hoogte, DESKTOP.height, max);
      for (const [i, y] of hoogtes.entries()) {
        schermen.push({
          titel: route.titel,
          pad: route.pad,
          deel: { nummer: i + 1, van: hoogtes.length },
          src: await fotoOp(page, y, 80),
        });
      }
      bruikbareRoutes.push(route);
    }
    if (schermen.length === 0) throw new DemoPdfFout("LEEG", "Er kon geen enkele pagina van de demo worden vastgelegd.");

    // Eén mobiele impressie van de homepage.
    const mobiel: string[] = [];
    try {
      const telefoon = await browser.newPage();
      await telefoon.setViewport({ ...MOBIEL, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      if (await open(telefoon, basis.href)) {
        await ruimCookieMeldingOp(telefoon);
        await scrolDoor(telefoon);
        const h = await telefoon.evaluate(() => document.documentElement.scrollHeight);
        for (const y of fotoHoogtes(h, MOBIEL.height, 3)) mobiel.push(await fotoOp(telefoon, y, 72));
      }
      await telefoon.close();
    } catch {
      /* zonder mobiele impressie is de PDF nog steeds compleet */
    }

    const rapport = {
      bedrijfsnaam: input.bedrijfsnaam,
      demoUrl: basis.href,
      demoDatum: input.demoDatum,
      gemaaktOp: input.nu ?? new Date(),
      logoSrc: await logoDataUri(),
      schermen,
      mobiel,
    };

    const printer = await browser.newPage();
    await printer.setContent(bouwRapportHtml(rapport), { waitUntil: "load", timeout: 60_000 });
    await printer.evaluate(async () => {
      await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    });
    const pdf = Buffer.from(
      await printer.pdf({ format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true }),
    );
    if (pdf.byteLength > MAX_PDF_BYTES) {
      throw new DemoPdfFout(
        "TE_GROOT",
        `De PDF wordt ${(pdf.byteLength / 1024 / 1024).toFixed(1)} MB — te groot om netjes te mailen.`,
      );
    }
    return { pdf, paginas: aantalPaginas(rapport), routes: bruikbareRoutes, schermen: schermen.length };
  } finally {
    await browser.close().catch(() => {});
  }
}
