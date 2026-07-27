import "server-only";
import { branding } from "@/lib/branding";

/**
 * De website van een collega lezen.
 *
 * Alleen de openbare voorkant: wat een bezoeker ook ziet. Geen formulieren,
 * geen afgeschermde pagina's, geen scraping van derden. Robots.txt wordt
 * gerespecteerd — staan we er niet welkom, dan lezen we niet.
 *
 * Naast de tekst voor de analyse haalt dit ook de dingen op die je nodig hebt
 * vóórdat je iemand mag benaderen: een contactadres en een aanwijzing over de
 * rechtsvorm.
 */

const UA = `${branding.name}Bot (+${branding.siteUrl})`;

/** Pagina's die het vaakst het contactadres en de rechtsvorm dragen. */
const INTERESSANT = [
  "contact",
  "over-ons",
  "over ons",
  "overons",
  "about",
  "wie-zijn-wij",
  "algemene-voorwaarden",
  "voorwaarden",
  "privacy",
  "disclaimer",
];

export type Paginabron = { url: string; tekst: string; html: string };

export type Websitelezing = {
  paginas: Paginabron[];
  tekst: string;
  emails: string[];
  socials: Record<string, string>;
  rechtsvorm: Rechtsvormsignaal | null;
};

export type Rechtsvormsignaal = {
  /** Wat we letterlijk aantroffen, bijv. "Hondenschool De Bosrand B.V." */
  bewijs: string;
  /** Op welke pagina */
  waar: string;
  vorm: "bv" | "nv" | "vof" | "stichting" | "vereniging" | "cooperatie";
};

/* --------------------------------------------------------------- ophalen -- */

function striptekst(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function haalOp(url: string, ms = 15_000): Promise<Paginabron | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: AbortSignal.timeout(ms),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const html = (await res.text()).slice(0, 400_000);
    return { url: res.url || url, tekst: striptekst(html), html };
  } catch {
    return null;
  }
}

/**
 * Robots.txt lezen en kijken of wij welkom zijn. Bij twijfel — geen bestand,
 * server onbereikbaar — gaan we door: afwezigheid van een verbod is geen
 * verbod. Bij een expliciete Disallow voor iedereen stoppen we.
 */
async function magIkLezen(basis: URL): Promise<boolean> {
  const robots = await haalOp(new URL("/robots.txt", basis).toString(), 8_000);
  if (!robots) return true;

  // Alleen het blok voor "*" telt; een regel voor Googlebot gaat ons niet aan.
  const regels = robots.html.split(/\r?\n/);
  let inAlgemeenBlok = false;
  for (const regel of regels) {
    const r = regel.trim().toLowerCase();
    if (r.startsWith("user-agent:")) {
      inAlgemeenBlok = r.slice(11).trim() === "*";
      continue;
    }
    if (inAlgemeenBlok && r.startsWith("disallow:")) {
      const pad = r.slice(9).trim();
      // "Disallow: /" sluit de hele site af. Dat respecteren we.
      if (pad === "/") return false;
    }
  }
  return true;
}

/** Interne links die eruitzien alsof er contactgegevens achter zitten. */
function vindVervolgpaginas(html: string, basis: URL, max: number): string[] {
  const gevonden = new Map<string, string>();
  const links = html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi);

  for (const m of links) {
    const href = m[1];
    const tekst = striptekst(m[2]).toLowerCase();
    let doel: URL;
    try {
      doel = new URL(href, basis);
    } catch {
      continue;
    }
    if (doel.hostname !== basis.hostname) continue;
    if (!/^https?:$/.test(doel.protocol)) continue;

    const pad = doel.pathname.toLowerCase();
    const raak = INTERESSANT.some((w) => pad.includes(w) || tekst.includes(w));
    if (!raak) continue;

    doel.hash = "";
    const sleutel = doel.toString();
    if (!gevonden.has(sleutel)) gevonden.set(sleutel, sleutel);
    if (gevonden.size >= max) break;
  }

  return [...gevonden.values()];
}

/* -------------------------------------------------------------- uitlezen -- */

const ADRES = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Adressen die van de bouwer of van een dienst zijn, niet van het bedrijf. */
const NIET_VAN_HEN =
  /(sentry|wix|squarespace|godaddy|jouwweb|mijndomein|example|domain|hosting|webdesign|@2x|\.png|\.jpg|\.webp|\.gif|\.svg)/i;

export function vindEmails(bron: string): string[] {
  const uniek = new Set<string>();
  for (const m of bron.matchAll(ADRES)) {
    const adres = m[0].toLowerCase().replace(/[.,;:]+$/, "");
    if (NIET_VAN_HEN.test(adres)) continue;
    if (adres.length > 90) continue;
    uniek.add(adres);
  }
  return [...uniek];
}

/**
 * Kies het adres waar een mens ook echt leest. info@ en contact@ zijn
 * bedrijfsbrede postbussen; een persoonlijk adres is meestal beter, maar
 * noreply of privacy is dat nooit.
 */
export function kiesContactadres(
  emails: string[],
  domein: string | null,
): string | null {
  if (emails.length === 0) return null;

  const nooit = /^(noreply|no-reply|donotreply|privacy|abuse|postmaster|webmaster)@/;
  const bruikbaar = emails.filter((e) => !nooit.test(e));
  if (bruikbaar.length === 0) return null;

  // Een adres op hun eigen domein is bijna altijd het juiste.
  const eigen = domein
    ? bruikbaar.filter((e) => e.endsWith(`@${domein}`) || e.endsWith(`.${domein}`))
    : [];
  const pool = eigen.length ? eigen : bruikbaar;

  const voorkeur = pool.find((e) => /^(info|contact|hallo|hello|mail)@/.test(e));
  return voorkeur ?? pool[0];
}

const VORMEN: { vorm: Rechtsvormsignaal["vorm"]; patroon: RegExp }[] = [
  { vorm: "bv", patroon: /\b(b\.?\s?v\.?)(?=[\s.,;:)]|$)/i },
  { vorm: "nv", patroon: /\b(n\.?\s?v\.?)(?=[\s.,;:)]|$)/i },
  { vorm: "vof", patroon: /\b(v\.?\s?o\.?\s?f\.?)(?=[\s.,;:)]|$)/i },
  { vorm: "stichting", patroon: /\bstichting\b/i },
  { vorm: "vereniging", patroon: /\b(vereniging|hondensportvereniging|kynologenclub)\b/i },
  { vorm: "cooperatie", patroon: /\b(co[öo]peratie|u\.?a\.?)(?=[\s.,;:)]|$)/i },
];

/**
 * Zoek een aanwijzing voor de rechtsvorm.
 *
 * Bewust streng. Dit bepaalt of iemand benaderd mag worden: een eenmanszaak
 * is juridisch een persoon en vraagt om toestemming, een BV niet. Vinden we
 * niets overtuigends, dan is het antwoord "onbekend" — en dan gaat er dus
 * niets uit. Een verkeerde gok kost hier meer dan een gemiste kans.
 */
export function bepaalRechtsvorm(paginas: Paginabron[]): Rechtsvormsignaal | null {
  for (const pagina of paginas) {
    for (const { vorm, patroon } of VORMEN) {
      const m = patroon.exec(pagina.tekst);
      if (!m) continue;

      // Neem de zin eromheen mee als bewijs, zodat Henry het kan nakijken.
      const start = Math.max(0, m.index - 70);
      const bewijs = pagina.tekst.slice(start, m.index + m[0].length + 40).trim();

      // "bv." als afkorting van "bijvoorbeeld" is een klassieke valkuil.
      if (vorm === "bv" && /\bbv\.\s/i.test(m[0]) && !/\b(b\.v\.|B\.V\.)/.test(bewijs)) {
        if (/bijvoorbeeld/i.test(bewijs)) continue;
      }

      return { vorm, bewijs, waar: pagina.url };
    }
  }
  return null;
}

const SOCIAL_PATRONEN: { net: string; patroon: RegExp }[] = [
  { net: "facebook", patroon: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]{2,}/i },
  { net: "instagram", patroon: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]{2,}/i },
  { net: "linkedin", patroon: /https?:\/\/(?:[a-z]{2}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._-]{2,}/i },
];

export function vindSocials(html: string): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const { net, patroon } of SOCIAL_PATRONEN) {
    const m = patroon.exec(html);
    if (m) uit[net] = m[0];
  }
  return uit;
}

/* ----------------------------------------------------------------- lezen -- */

/** Lees de site: startpagina plus hoogstens twee pagina's die ertoe doen. */
export async function leesWebsite(website: string): Promise<Websitelezing | null> {
  let basis: URL;
  try {
    basis = new URL(website);
  } catch {
    return null;
  }

  if (!(await magIkLezen(basis))) return null;

  const start = await haalOp(basis.toString());
  if (!start) return null;

  const paginas: Paginabron[] = [start];
  for (const url of vindVervolgpaginas(start.html, new URL(start.url), 2)) {
    const extra = await haalOp(url, 12_000);
    if (extra) paginas.push(extra);
  }

  const alleHtml = paginas.map((p) => p.html).join("\n");
  const alleTekst = paginas.map((p) => p.tekst).join("\n\n");

  return {
    paginas,
    tekst: alleTekst,
    // Mailto-links in de HTML zijn betrouwbaarder dan losse tekst; beide mee.
    emails: vindEmails(`${alleHtml}\n${alleTekst}`),
    socials: vindSocials(alleHtml),
    rechtsvorm: bepaalRechtsvorm(paginas),
  };
}
