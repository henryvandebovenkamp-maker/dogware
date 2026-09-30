/**
 * Welke pagina's van een voorbeeldwebsite in de demo-PDF komen.
 *
 * Geen crawler. De demo's zijn DogWare-sites met een vaste opbouw: een
 * hoofdmenu in de header, een homepage die naar de belangrijkste dienst en
 * de aanvraag verwijst, en een login voor het klantportaal. We nemen dus:
 *
 *   1. de homepage;
 *   2. de pagina's uit het hoofdmenu van de demo zelf, in die volgorde;
 *   3. de pagina's waar de homepage het vaakst naar verwijst (de diensten en
 *      de aanvraag), zodat de functionaliteit in beeld komt;
 *   4. de login van het klantportaal, als de demo er een heeft.
 *
 * Juridische pagina's, bestanden en externe links vallen af. Puur: de browser
 * levert de links aan, deze functie kiest.
 */

export type DemoLink = { href: string; tekst: string };

export type DemoRoute = {
  /** Pad binnen de demo, bijv. "/zo-werkt-het". */
  pad: string;
  /** Kop boven de schermafbeelding in de PDF. */
  titel: string;
  soort: "home" | "menu" | "functie" | "portaal";
};

export const MAX_ROUTES = 7;

const UITGESLOTEN = [
  /^\/(login|inloggen|account|admin|dashboard|portaal)(\/|$)/i,
  /(privacy|cookie|voorwaarden|disclaimer|sitemap|manifest|robots)/i,
  /^\/api\//i,
  /\.(png|jpe?g|svg|webp|gif|pdf|xml|json|txt|ico|webmanifest)$/i,
];

function normaliseer(href: string, basis: URL): string | null {
  try {
    const url = new URL(href, basis);
    if (url.origin !== basis.origin) return null;
    const pad = url.pathname.replace(/\/+$/, "") || "/";
    return pad;
  } catch {
    return null;
  }
}

function opgeschoond(tekst: string): string {
  return tekst.replace(/\s+/g, " ").trim();
}

/** Mooie titel uit een pad als de linktekst niets bruikbaars zegt. */
export function titelUitPad(pad: string): string {
  if (pad === "/") return "Home";
  const laatste = pad.split("/").filter(Boolean).pop() ?? pad;
  const woorden = laatste.replace(/[-_]+/g, " ").trim();
  return woorden.charAt(0).toUpperCase() + woorden.slice(1);
}

export function kiesDemoRoutes(input: {
  basisUrl: string;
  /** Links uit het hoofdmenu in de header, in volgorde. */
  menu: DemoLink[];
  /** Alle interne links in de inhoud van de homepage. */
  inhoud: DemoLink[];
  /** De login van het klantportaal (lead.demoPortalUrl), als die er is. */
  portaalUrl?: string | null;
}): DemoRoute[] {
  const basis = new URL(input.basisUrl);
  const gekozen: DemoRoute[] = [{ pad: "/", titel: "Home", soort: "home" }];
  const al = new Set(["/"]);
  const toegestaan = (pad: string) => !UITGESLOTEN.some((r) => r.test(pad));

  for (const link of input.menu) {
    const pad = normaliseer(link.href, basis);
    if (!pad || al.has(pad) || !toegestaan(pad)) continue;
    al.add(pad);
    gekozen.push({ pad, titel: opgeschoond(link.tekst) || titelUitPad(pad), soort: "menu" });
  }

  // De homepage verwijst het vaakst naar wat ertoe doet: de dienst en de aanvraag.
  const telling = new Map<string, { n: number; tekst: string }>();
  for (const link of input.inhoud) {
    const pad = normaliseer(link.href, basis);
    if (!pad || al.has(pad) || !toegestaan(pad)) continue;
    const t = telling.get(pad);
    const tekst = opgeschoond(link.tekst);
    if (t) {
      t.n += 1;
      if (!t.tekst && tekst) t.tekst = tekst;
    } else telling.set(pad, { n: 1, tekst });
  }
  const functies = [...telling.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .slice(0, 2);
  for (const [pad, { tekst }] of functies) {
    al.add(pad);
    gekozen.push({ pad, titel: tekst && tekst.length <= 40 ? tekst : titelUitPad(pad), soort: "functie" });
  }

  const resultaat = gekozen.slice(0, MAX_ROUTES - (input.portaalUrl ? 1 : 0));

  if (input.portaalUrl) {
    const pad = normaliseer(input.portaalUrl, basis);
    if (pad && !resultaat.some((r) => r.pad === pad)) {
      resultaat.push({ pad, titel: "Klantportaal", soort: "portaal" });
    }
  }
  return resultaat;
}
