import "server-only";
import type { BrancheSlug } from "@/lib/branches";

/**
 * OpenStreetMap als ontdekkingsbron.
 *
 * Waarom deze bron en geen andere: OSM is open data onder de ODbL, expliciet
 * bedoeld om hergebruikt te worden. Geen scraping, geen voorwaarden die dit
 * gebruik verbieden. Google Places verbiedt in zijn voorwaarden juist het
 * opslaan van resultaten om er een eigen bestand mee op te bouwen, en
 * KVK-data kost geld en kent een non-mailindicator die je apart moet
 * respecteren.
 *
 * Wat je ervoor terugkrijgt is beperkt maar echt: naam, plaats, vaak een
 * website, soms telefoon, zelden e-mail. Contactgegevens haal je daarna van
 * hun eigen website — wat zij zelf publiceren mag je lezen.
 *
 * Verplichting: bronvermelding. Die staat op de bedrijfskaart.
 */

/**
 * Overpass draait op vrijwilligersservers. Die zitten geregeld vol en geven dan
 * een 429 of 504. Eén mislukte poging mag geen mislukte agent-run betekenen,
 * dus we proberen dezelfde vraag bij een tweede en derde server.
 */
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stelt de vraag aan Overpass en wijkt uit naar een volgende server zodra er
 * één weigert. Pas als alle servers afhaken geeft dit een fout — die komt dan
 * in gewone taal terug bij de agent.
 */
async function vraagOverpass(
  query: string,
): Promise<{ elements?: OverpassElement[] }> {
  let laatste = "onbereikbaar";

  for (let poging = 0; poging < OVERPASS_SERVERS.length; poging++) {
    const server = OVERPASS_SERVERS[poging];
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          // Overpass vraagt om een herkenbare user-agent met contactmogelijkheid.
          "user-agent": "DogWareGroei/1.0 (+https://dogware.nl)",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(120_000),
      });

      if (res.ok) {
        return (await res.json()) as { elements?: OverpassElement[] };
      }
      laatste = `server gaf ${res.status}`;
    } catch (err) {
      laatste = err instanceof Error ? err.message : "onbereikbaar";
    }

    // Even ademruimte laten voor we het bij de volgende server proberen.
    if (poging < OVERPASS_SERVERS.length - 1) await wacht(2_000);
  }

  throw new Error(
    `De kaartserver van OpenStreetMap was even niet beschikbaar (${laatste}). Probeer het straks nog een keer.`,
  );
}

/**
 * Welke OSM-tags horen bij welke branche.
 *
 * Niet elke branche is vindbaar: gedragstherapie, fysiotherapie en
 * dierenverzorging aan huis hebben geen eigen tag en zijn vaak ook geen
 * fysieke locatie. Die komen later uit een andere bron; hier eerlijk
 * weglaten is beter dan ze met een verkeerde tag benaderen.
 */
const TAGS: Partial<Record<BrancheSlug, string[]>> = {
  hondenschool: ['["amenity"="animal_training"]'],
  trimsalon: ['["shop"="pet_grooming"]'],
  pension: ['["amenity"="animal_boarding"]'],
  // Dagopvang en pension delen in OSM dezelfde tag; welke van de twee het is,
  // stelt de brancheagent later vast op basis van hun website.
  dagopvang: ['["amenity"="animal_boarding"]'],
  webshop: ['["shop"="pet"]'],
};

export const VINDBARE_BRANCHES = Object.keys(TAGS) as BrancheSlug[];

export type OsmVondst = {
  bronId: string;
  bedrijfsnaam: string;
  branche: BrancheSlug;
  plaats: string | null;
  provincie: string | null;
  website: string | null;
  email: string | null;
  telefoon: string | null;
};

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
};

/** Maakt van losse OSM-tags één bruikbaar veld. */
function tag(t: Record<string, string>, ...namen: string[]): string | null {
  for (const n of namen) {
    const v = t[n]?.trim();
    if (v) return v;
  }
  return null;
}

/** Normaliseert een website naar iets dat we kunnen ophalen en vergelijken. */
export function normaliseerWebsite(ruw: string | null): string | null {
  if (!ruw) return null;
  let v = ruw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname.includes(".")) return null;
    return `${u.protocol}//${u.hostname.replace(/^www\./i, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return null;
  }
}

/**
 * Zoek bedrijven bij één branche, eventueel beperkt tot provincies.
 *
 * Overpass is een gratis, gedeelde dienst. We vragen daarom één branche per
 * aanroep, met een ruime timeout en een harde bovengrens, en laten de beller
 * pauzeren tussen aanroepen.
 */
export async function zoekBedrijven(opts: {
  branche: BrancheSlug;
  provincies?: string[];
  max?: number;
}): Promise<OsmVondst[]> {
  const tags = TAGS[opts.branche];
  if (!tags) return [];

  const max = Math.min(opts.max ?? 200, 500);
  const provincies = (opts.provincies ?? []).filter(Boolean);

  // Zonder provincie: heel Nederland. Met: alleen die provinciegebieden.
  const gebied = provincies.length
    ? provincies
        .map(
          (p, i) =>
            `area["boundary"="administrative"]["admin_level"="4"]["name"="${p.replace(/"/g, "")}"]->.g${i};`,
        )
        .join("\n")
    : `area["ISO3166-1"="NL"][admin_level=2]->.g0;`;

  const gebiedsNamen = provincies.length
    ? provincies.map((_, i) => `.g${i}`)
    : [".g0"];

  const query = `[out:json][timeout:60];
${gebied}
(
${gebiedsNamen.map((g) => tags.map((t) => `  nwr${t}(area${g});`).join("\n")).join("\n")}
);
out tags center ${max};`;

  const data = await vraagOverpass(query);

  const vondsten: OsmVondst[] = [];
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    const naam = tag(t, "name", "operator");
    // Zonder naam heb je niets om over te schrijven.
    if (!naam) continue;

    vondsten.push({
      bronId: `${el.type}/${el.id}`,
      bedrijfsnaam: naam,
      branche: opts.branche,
      plaats: tag(t, "addr:city", "addr:place"),
      provincie: tag(t, "addr:province", "addr:state"),
      website: normaliseerWebsite(tag(t, "website", "contact:website", "url")),
      email: tag(t, "email", "contact:email")?.toLowerCase() ?? null,
      telefoon: tag(t, "phone", "contact:phone", "contact:mobile"),
    });
  }

  return vondsten;
}

/** De twaalf provincies, zoals ze in OpenStreetMap heten. */
export const PROVINCIES = [
  "Drenthe",
  "Flevoland",
  "Fryslân",
  "Gelderland",
  "Groningen",
  "Limburg",
  "Noord-Brabant",
  "Noord-Holland",
  "Overijssel",
  "Utrecht",
  "Zeeland",
  "Zuid-Holland",
] as const;
