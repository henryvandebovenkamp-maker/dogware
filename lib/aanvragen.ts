import {
  JOURNEY_STAGES,
  type JourneyStage,
  type LeadStatus,
} from "@/lib/db/schema";
import { nextAction, type JourneySnapshot, type NextAction } from "@/lib/journey-next";

/**
 * De werkindeling van het aanvragenscherm.
 *
 * Dit bestand voegt bewust géén tweede statussysteem toe. De twintig stages in
 * `JOURNEY_STAGES` blijven de enige waarheid; hier worden ze alleen gegroepeerd
 * tot de negen bakjes waarin een mens denkt, en wordt afgeleid wie vandaag
 * aandacht nodig heeft. Alles is puur: geen database, geen tijdzones, geen
 * verrassingen — en daardoor te testen zonder omgeving.
 *
 * De motor die bepaalt wát de volgende stap is (`nextAction`) bestond al en
 * draaide alleen op de detailpagina. Hier wordt hij ook voor de lijst gebruikt,
 * zodat het overzicht en de detailpagina per definitie hetzelfde zeggen.
 */

/* --------------------------------------------------------------- bakjes -- */

export const BAKJES = [
  "nieuw",
  "demo-maken",
  "demo-verstuurd",
  "opvolgen",
  "in-gesprek",
  "voorstel",
  "akkoord",
  "bouw",
  "klant",
] as const;
export type Bakje = (typeof BAKJES)[number];

export const BAKJE_LABEL: Record<Bakje, string> = {
  nieuw: "Nieuw",
  "demo-maken": "Demo maken",
  "demo-verstuurd": "Demo verstuurd",
  opvolgen: "Opvolgen",
  "in-gesprek": "In gesprek",
  voorstel: "Voorstel",
  akkoord: "Akkoord",
  bouw: "Bouw",
  klant: "Klant",
};

/**
 * Elke stage hoort in precies één bakje. Uitputtend opgeschreven en niet met
 * een reeks if-jes afgeleid: zo dwingt TypeScript af dat een nieuwe stage hier
 * een plek krijgt in plaats van stilletjes in een restcategorie te vallen.
 */
const BAKJE_VOOR_STAGE: Record<JourneyStage, Bakje> = {
  aangevraagd: "nieuw",
  voorbereiden: "demo-maken",
  "demo-verstuurd": "demo-verstuurd",
  ingelogd: "demo-verstuurd",
  bekeken: "demo-verstuurd",
  feedback: "in-gesprek",
  afspraak: "in-gesprek",
  "demo-akkoord": "in-gesprek",
  offerte: "voorstel",
  "voorstel-verstuurd": "voorstel",
  akkoord: "akkoord",
  overeenkomst: "akkoord",
  aanbetaling: "akkoord",
  gestart: "bouw",
  revisies: "bouw",
  oplevering: "bouw",
  restbetaling: "bouw",
  mandaat: "bouw",
  live: "klant",
  actief: "klant",
};

/* ------------------------------------------------------------ opvolging -- */

/** Na hoeveel dagen stilte een verstuurde demo om opvolging vraagt. */
export const OPVOLGEN_NA_DAGEN = 3;

const DAG_MS = 24 * 60 * 60 * 1000;

/** Hele dagen tussen twee momenten, naar beneden afgerond. */
export function dagenTussen(van: Date, tot: Date): number {
  return Math.floor((tot.getTime() - van.getTime()) / DAG_MS);
}

/* ------------------------------------------------------------- aanvraag -- */

/**
 * Wat er van een aanvraag nodig is om te bepalen wat eraan moet gebeuren.
 * Bewust een eigen, kleine vorm: de lijst hoeft niet de hele lead-rij en al
 * zijn relaties te laden om te weten wie aandacht nodig heeft.
 */
export type AanvraagInput = {
  id: string;
  stage: JourneyStage;
  status: LeadStatus;
  /** Wanneer het voorbeeld is gemaild, of null als dat nog niet gebeurd is. */
  demoSentAt: Date | null;
  /** Laatste moment dat er contact was — reactie, gesprek of notitie. */
  laatsteContactAt: Date | null;
  /** De feitelijke commerciële toestand, voor `nextAction`. */
  snapshot: JourneySnapshot;
};

export type AanvraagAfleiding = {
  bakje: Bakje;
  /** Vraagt deze aanvraag vandaag om een handeling van de beheerder? */
  actieNodig: boolean;
  /** Eén regel waarom, in gewone taal. Leeg als er niets hoeft. */
  reden: string;
  /** Dagen sinds de demo verstuurd is; null als dat nog niet gebeurd is. */
  dagenSindsDemo: number | null;
  /** De volledige volgende stap uit de bestaande motor. */
  actie: NextAction;
};

/**
 * Leidt af waar een aanvraag staat en of hij aandacht nodig heeft.
 *
 * De volgorde van de regels is de kern: een afgevallen aanvraag vraagt nooit
 * aandacht, een klant is klaar, en pas daarna telt of er stilte is na een
 * verstuurde demo. Zonder die volgorde zou een afgeronde klant maandenlang in
 * "opvolgen" blijven staan omdat er toevallig geen contactmoment is vastgelegd.
 */
export function leidAf(a: AanvraagInput, nu: Date): AanvraagAfleiding {
  const actie = nextAction(a.snapshot, a.id);
  const dagenSindsDemo = a.demoSentAt ? dagenTussen(a.demoSentAt, nu) : null;

  // Afgevallen: uit beeld, nooit actie.
  if (a.status === "afgevallen") {
    return {
      bakje: BAKJE_VOOR_STAGE[a.stage],
      actieNodig: false,
      reden: "",
      dagenSindsDemo,
      actie,
    };
  }

  const bakje = BAKJE_VOOR_STAGE[a.stage];

  // Klant: het commerciële traject is geslaagd en vraagt niets meer.
  if (bakje === "klant") {
    return { bakje, actieNodig: false, reden: "", dagenSindsDemo, actie };
  }

  // Stilte na een verstuurde demo weegt zwaarder dan "wachten op de klant":
  // dit is precies het moment waarop een aanvraag anders blijft liggen.
  const stilte =
    bakje === "demo-verstuurd" &&
    dagenSindsDemo !== null &&
    dagenSindsDemo >= OPVOLGEN_NA_DAGEN &&
    (a.laatsteContactAt === null || a.laatsteContactAt <= a.demoSentAt!);

  if (stilte) {
    return {
      bakje: "opvolgen",
      actieNodig: true,
      reden: `Demo ${dagenSindsDemo} dagen geleden verstuurd, nog geen reactie`,
      dagenSindsDemo,
      actie,
    };
  }

  // Verder bepaalt de bestaande motor wie aan zet is.
  if (actie.waitingOn === "admin") {
    return {
      bakje,
      actieNodig: true,
      reden: actie.volgende,
      dagenSindsDemo,
      actie,
    };
  }

  return { bakje, actieNodig: false, reden: "", dagenSindsDemo, actie };
}

/* ---------------------------------------------------------------- tellen -- */

/** Lege telling voor alle bakjes, zodat een bakje met nul ook bestaat. */
export function legeTelling(): Record<Bakje, number> {
  return Object.fromEntries(BAKJES.map((b) => [b, 0])) as Record<Bakje, number>;
}

/**
 * Telt hoeveel aanvragen er in elk bakje zitten.
 *
 * Elke aanvraag telt precies één keer — "opvolgen" is geen extra label bovenop
 * "demo verstuurd" maar vervangt het. Anders zou de balk meer aanvragen tellen
 * dan er zijn, en dan gaat niemand de cijfers meer geloven.
 */
export function telPerBakje(
  afleidingen: readonly Pick<AanvraagAfleiding, "bakje">[],
): Record<Bakje, number> {
  const telling = legeTelling();
  for (const a of afleidingen) telling[a.bakje] += 1;
  return telling;
}

/** Alle stages die bij een bakje horen — voor filteren op de server. */
export function stagesVanBakje(bakje: Bakje): JourneyStage[] {
  return JOURNEY_STAGES.filter((s) => BAKJE_VOOR_STAGE[s] === bakje);
}

/**
 * De volgorde van "Actie nodig", hoogste eerst.
 *
 * Opvolging gaat vóór al het andere: dat zijn de aanvragen die stilvallen als
 * niemand er iets aan doet, en waar wachten je een klant kost. Pas daarna komt
 * werk dat gewoon nog gedaan moet worden — een bouwfase die al loopt, is niet
 * urgent omdat de demo lang geleden is verstuurd.
 *
 * Binnen elke groep telt hoe lang het al duurt.
 */
export function urgentieSleutel(a: AanvraagAfleiding): number {
  const dagen = a.dagenSindsDemo ?? 0;
  return a.bakje === "opvolgen" ? 100_000 + dagen : dagen;
}
