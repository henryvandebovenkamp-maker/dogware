/**
 * Van intake naar Dogware-module.
 *
 * De intake laat de ondernemer diensten aanvinken in zijn eigen woorden
 * ("Hondenoppas aan huis"). Dogware kent modules met een technische naam
 * ("dierenverzorging"). Dit bestand is de enige plek waar die twee elkaar
 * raken.
 *
 * Waarom een aparte tabel en niet slim raden: een dienst aan de verkeerde
 * module koppelen is erger dan hem niet koppelen. Bij "niet gekoppeld" gaat er
 * iemand kijken; bij verkeerd gekoppeld bouwt er iemand door op een fout die
 * niemand meer terugvindt. Alleen een exacte match telt dus als koppeling.
 *
 * Client-safe: geen server-only imports.
 */

import type { BrancheSlug } from "@/lib/branches";
import type { Lead } from "@/lib/db/schema";
import { JOURNEY_STAGES } from "@/lib/db/schema";
import { STAGE_META } from "@/lib/journey-stages";

/**
 * De modules die Dogware kent, met hun leesbare naam.
 *
 * Getypeerd als `Record<BrancheSlug, …>`: komt er in lib/branches.ts een
 * branche bij, dan faalt de typecheck hier totdat iemand besloten heeft wat de
 * intake-diensten daarvoor zijn. Dat is precies de bedoeling — een nieuwe
 * module die stilletjes nergens uit de intake te bereiken is, is een module die
 * niemand krijgt.
 */
export const MODULES: Record<BrancheSlug, string> = {
  hondenschool: "Hondenschool",
  uitlaatservice: "Uitlaatservice",
  dagopvang: "Dagopvang",
  pension: "Pension",
  trimsalon: "Trimsalon",
  gedragstherapie: "Gedragstherapie",
  dierenverzorging: "Dierenverzorging aan huis",
  chipservice: "Chipservice",
  webshop: "Webshop",
};

/**
 * Vaste volgorde voor alle lijstjes in de prompt. Zonder vaste volgorde geeft
 * dezelfde aanvraag twee keer een andere tekst, en is een verschil tussen twee
 * prompts geen signaal meer.
 */
export const MODULE_VOLGORDE: readonly BrancheSlug[] = [
  "hondenschool",
  "uitlaatservice",
  "dagopvang",
  "pension",
  "trimsalon",
  "gedragstherapie",
  "dierenverzorging",
  "chipservice",
  "webshop",
];

/**
 * Wat de klant aanvinkt → welke module dat is.
 *
 * De sleutels zijn genormaliseerd (kleine letters, zonder accenten). Naast de
 * aanvinkbare diensten uit lib/intake.ts staan hier ook de modulenamen zelf,
 * zodat iemand die "Chipservice" in het vrije veld typt alsnog wordt herkend.
 */
const DIENST_NAAR_MODULE: Record<string, BrancheSlug> = {
  hondenschool: "hondenschool",
  uitlaatservice: "uitlaatservice",
  dagopvang: "dagopvang",
  pension: "pension",
  trimsalon: "trimsalon",
  gedragstherapie: "gedragstherapie",
  "hondenoppas aan huis": "dierenverzorging",
  "dierenverzorging aan huis": "dierenverzorging",
  chipservice: "chipservice",
  webshop: "webshop",
};

/** Kleine letters, zonder accenten, zonder dubbele spaties of leestekens. */
function normaliseer(waarde: string): string {
  return waarde
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type Dienstkoppeling = {
  /** Precies zoals de klant het opgaf */
  dienst: string;
  /** De module, of null als er geen bevestigde koppeling bestaat */
  module: BrancheSlug | null;
};

export type Modulekeuze = {
  koppelingen: Dienstkoppeling[];
  /** De modules die aan moeten, in vaste volgorde en zonder dubbelen */
  actief: BrancheSlug[];
  /** Diensten waarvoor geen bevestigde module bestaat */
  ongekoppeld: string[];
  /** Alles wat niet is aangevraagd — moet uit blijven staan */
  uitgeschakeld: BrancheSlug[];
};

/**
 * De diensten uit de aanvraag omgezet naar modules.
 *
 * Wat er niet gebeurt: modules aanzetten omdat de code er toch al is. Wie een
 * uitlaatservice aanvraagt, krijgt een uitlaatservice — geen trimsalon in het
 * menu waar nooit iemand om gevraagd heeft.
 */
export function koppelDiensten(
  diensten: readonly string[],
  dienstenAnders?: string | null,
): Modulekeuze {
  const opgegeven = [...diensten, dienstenAnders ?? ""]
    .map((d) => d.trim())
    .filter(Boolean);

  const koppelingen: Dienstkoppeling[] = [];
  const gezien = new Set<string>();
  for (const dienst of opgegeven) {
    const sleutel = normaliseer(dienst);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    koppelingen.push({ dienst, module: DIENST_NAAR_MODULE[sleutel] ?? null });
  }

  const actiefSet = new Set(
    koppelingen.map((k) => k.module).filter((m): m is BrancheSlug => m !== null),
  );

  return {
    koppelingen,
    actief: MODULE_VOLGORDE.filter((m) => actiefSet.has(m)),
    ongekoppeld: koppelingen.filter((k) => k.module === null).map((k) => k.dienst),
    uitgeschakeld: MODULE_VOLGORDE.filter((m) => !actiefSet.has(m)),
  };
}

/**
 * Waar je in de master gaat kijken voor een gewenste functie.
 *
 * Bewust een zoekaanwijzing en geen belofte. Of iets er écht al staat hangt af
 * van de master die op dát moment wordt opgehaald; dat kan dit bestand niet
 * weten en mag het dus ook niet beweren. De prompt vraagt daarom altijd om
 * eerst te kijken — en om te melden wat er niet blijkt te zijn.
 */
export const FUNCTIE_ANKERS: Record<string, string> = {
  "Online boeken": "de bestaande aanvraag-/intakeflow (lib/intake.ts, app/demo)",
  Klantportaal: "de klantomgeving en de rol CUSTOMER (app/account, lib/roles.ts)",
  Betalen: "de Mollie-integratie (lib/mollie.ts, app/api/mollie)",
  Planning: "agenda- en planningsfunctionaliteit",
  Personeelsportaal: "medewerkerstoegang en de rollen in lib/roles.ts",
  "E-learning": "cursus-/lesmateriaalfunctionaliteit",
  Strippenkaarten: "strippenkaarten of een tegoedadministratie",
  Nieuwsbrieven: "de e-mailarchitectuur (lib/email, Resend)",
  Pushberichten: "notificaties richting klant of medewerker",
};

/**
 * Bouwt een demo of het echte werk?
 *
 * Afgeleid uit de journey in plaats van een apart vinkje: een extra veld dat je
 * met de hand moet bijhouden staat binnen een maand verkeerd. De overeenkomst
 * is de scheidslijn — daarvóór is alles wat we maken een voorbeeld, daarna
 * draait er een bedrijf op.
 */
export function omgevingType(lead: Lead): { type: "DEMO" | "PRODUCTIE"; reden: string } {
  const stage = STAGE_META[lead.stage]?.label ?? lead.stage;

  if (lead.status === "klant geworden") {
    return { type: "PRODUCTIE", reden: 'de aanvraag staat op status "klant geworden"' };
  }
  if (JOURNEY_STAGES.indexOf(lead.stage) >= JOURNEY_STAGES.indexOf("overeenkomst")) {
    return { type: "PRODUCTIE", reden: `de journey staat op "${stage}"` };
  }
  return {
    type: "DEMO",
    reden: `de journey staat nog vóór de overeenkomst ("${stage}")`,
  };
}

/**
 * De mapnaam en reponaam voor deze klant.
 *
 * Puur uit de bedrijfsnaam, zodat je aan de map ziet wiens project het is. De
 * val terug op het aanvraag-ID is voor een bedrijfsnaam die na het opschonen
 * niets overhoudt (alleen leestekens of niet-latijns schrift): een lege
 * mapnaam is erger dan een lelijke.
 */
export function projectSlug(bedrijfsnaam: string, id: string): string {
  const slug = bedrijfsnaam
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `klant-${id.slice(0, 8)}`;
}
