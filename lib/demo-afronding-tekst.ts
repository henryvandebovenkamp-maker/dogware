import type { JourneyStage, Lead } from "@/lib/db/schema";
import { isDirectJourney } from "@/lib/journey-variant";

/**
 * De pure kant van het afronden van een demo: of het mag, de standaardmail,
 * de bestandsnaam en wanneer DogWare het voorstelt. Zonder database, zodat
 * het rechtstreeks te testen is.
 */

/** Vanaf zoveel dagen stilte na de demo stelt DogWare afronden voor. */
export const AFRONDEN_ADVIES_NA_DAGEN = 21;

/** Stages waarin een demo nog "open" staat en dus afgerond kan worden. */
const DEMO_FASE: readonly JourneyStage[] = [
  "demo-verstuurd",
  "ingelogd",
  "bekeken",
  "feedback",
  "afspraak",
  "demo-akkoord",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function magDemoAfronden(
  lead: Pick<Lead, "journeyVariant" | "demoSentAt" | "demoDomain" | "email" | "status" | "stage">,
): { ok: true } | { ok: false; reden: string } {
  if (isDirectJourney(lead.journeyVariant)) return { ok: false, reden: "Deze klant heeft geen demo." };
  if (lead.status === "afgevallen") return { ok: false, reden: "Deze aanvraag is al afgerond." };
  if (!lead.demoSentAt) return { ok: false, reden: "Er is nog geen demo verstuurd." };
  if (!DEMO_FASE.includes(lead.stage)) {
    return { ok: false, reden: "Deze aanvraag zit al verder in de journey dan de demo." };
  }
  if (!lead.demoDomain?.trim()) return { ok: false, reden: "Er staat geen demo-URL bij deze aanvraag." };
  if (!EMAIL.test(lead.email?.trim() ?? "")) {
    return { ok: false, reden: "Er staat geen geldig e-mailadres bij deze aanvraag." };
  }
  return { ok: true };
}

/**
 * De voornaam voor de aanhef — nooit de bedrijfsnaam. Is de naam leeg, of
 * staat er in het naamveld eigenlijk de bedrijfsnaam, dan geen naam.
 */
export function voornaamVan(naam: string | null | undefined, bedrijfsnaam?: string): string | null {
  const schoon = (naam ?? "").trim();
  if (!schoon) return null;
  if (bedrijfsnaam && schoon.toLowerCase() === bedrijfsnaam.trim().toLowerCase()) return null;
  const eerste = schoon.split(/\s+/)[0];
  if (!/\p{L}/u.test(eerste)) return null;
  return eerste.charAt(0).toUpperCase() + eerste.slice(1);
}

export function afsluitmailOnderwerp(bedrijfsnaam: string): string {
  return `Je voorbeeldwebsite voor ${bedrijfsnaam.trim()}, om te bewaren`;
}

function hoeLangGeleden(demoSentAt: Date | null, nu: Date): string {
  if (!demoSentAt) return "Een tijdje geleden";
  const dagen = Math.floor((nu.getTime() - demoSentAt.getTime()) / 86_400_000);
  if (dagen < 14) return "Kortgeleden";
  if (dagen <= 60) return "Een paar weken geleden";
  return "Een tijdje geleden";
}

/** De standaardtekst. De beheerder kan hem vóór het versturen aanpassen. */
export function standaardAfsluitmail(input: {
  naam: string;
  bedrijfsnaam: string;
  demoSentAt: Date | null;
  nu: Date;
}): { onderwerp: string; tekst: string } {
  const voornaam = voornaamVan(input.naam, input.bedrijfsnaam);
  const bedrijf = input.bedrijfsnaam.trim();
  const alineas = [
    voornaam ? `Hoi ${voornaam},` : "Hoi,",
    `${hoeLangGeleden(input.demoSentAt, input.nu)} heb ik met veel plezier een voorbeeldwebsite voor ${bedrijf} voor je gemaakt.`,
    "Ik hoop dat je inmiddels de tijd hebt gehad om er rustig naar te kijken. Omdat ik daarna niets meer van je heb gehoord, ga ik de online demo binnenkort afsluiten.",
    "Ik vond het zonde als daarmee ook het voorbeeld helemaal zou verdwijnen. Daarom heb ik een PDF voor je gemaakt waarin je de website nog eens rustig kunt terugkijken. Die vind je als bijlage bij deze e-mail.",
    "Mocht je op een later moment alsnog verder willen praten, dan ben je natuurlijk van harte welkom. Stuur me gewoon een mailtje of neem even contact op — dan kijken we samen verder.",
    "Voor nu bedankt voor je interesse in DogWare, en wie weet spreken we elkaar later alsnog.",
  ];
  return { onderwerp: afsluitmailOnderwerp(bedrijf), tekst: alineas.join("\n\n") };
}

/** Tekst uit de editor → alinea's (lege regels scheiden alinea's). */
export function alineasUit(tekst: string): string[] {
  return tekst
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((a) => a.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** "Walk&Care" op 30 september 2026 → "walk-care-dogware-demo-2026-09-30.pdf". */
export function bestandsnaamVoor(bedrijfsnaam: string, datum: Date, versie = 1): string {
  const slug =
    bedrijfsnaam
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "demo";
  const dag = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(datum);
  return `${slug}-dogware-demo-${dag}${versie > 1 ? `-v${versie}` : ""}.pdf`;
}

/* =========================================================================
 * Is dit een afgeronde demo?
 * ========================================================================= */

/** Tijdlijnsoorten die bepalen of een aanvraag (nog) een afgeronde demo is. */
export const EVENT_DEMO_AFGEROND = "demo_afgerond";
export const EVENT_HEROPEND = "aanvraag_heropend";
export const EVENT_HANDMATIG_AFGEVALLEN = "aanvraag_afgevallen";

export type AfsluitMomenten = {
  /** Laatste geslaagde afronding (alleen gelogd na een verstuurde afsluitmail). */
  demoAfgerond: Date | null;
  /** Laatste heropening, via de knop of door de status met de hand terug te zetten. */
  heropend: Date | null;
  /** Laatste keer dat de status met de hand op "afgevallen" is gezet. */
  handmatigAfgevallen: Date | null;
};

/**
 * Wanneer deze aanvraag als demo is afgerond — of null als het geen
 * afgeronde demo is.
 *
 * "Afgevallen" alleen zegt dat niet: een aanvraag kan ook om een andere reden
 * zijn afgevallen (geen interesse, vóór de demo al). Een afgeronde demo is
 * afgevallen ÉN de laatste afsluitgebeurtenis is een geslaagde demo-afronding
 * — niet een heropening en niet een handmatige statuswijziging daarna.
 */
export function demoAfgerondOp(status: string, m: AfsluitMomenten): Date | null {
  if (status !== "afgevallen" || !m.demoAfgerond) return null;
  const t = m.demoAfgerond.getTime();
  if (m.heropend && m.heropend.getTime() >= t) return null;
  if (m.handmatigAfgevallen && m.handmatigAfgevallen.getTime() > t) return null;
  return m.demoAfgerond;
}
