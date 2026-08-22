import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";

/**
 * Client-veilige journey-definities (labels, volgorde, fase-indeling).
 * Geen server-only imports — bruikbaar in client- én servercomponenten.
 * De server-side motor (events, stage-overgangen) staat in lib/journey.ts.
 */

export const STAGE_META: Record<
  JourneyStage,
  { label: string; korte: string }
> = {
  aangevraagd: { label: "Aanvraag ontvangen", korte: "Nieuw" },
  voorbereiden: { label: "Voorbeeldwebsite voorbereiden", korte: "In voorbereiding" },
  "demo-verstuurd": { label: "Demo verstuurd", korte: "Verstuurd" },
  ingelogd: { label: "Eerste keer ingelogd", korte: "Ingelogd" },
  bekeken: { label: "Website bekeken", korte: "Bekeken" },
  feedback: { label: "Feedback ontvangen", korte: "Feedback" },
  afspraak: { label: "Demo-afspraak", korte: "Afspraak" },
  "demo-akkoord": { label: "Klant wil doorgaan", korte: "Wil door" },
  offerte: { label: "Voorstel voorbereiden", korte: "Voorstel" },
  "voorstel-verstuurd": { label: "Voorstel verstuurd", korte: "Verstuurd" },
  akkoord: { label: "Voorstel geaccepteerd", korte: "Akkoord" },
  overeenkomst: { label: "Overeenkomst tekenen", korte: "Tekenen" },
  aanbetaling: { label: "Eerste termijn betalen", korte: "1e termijn" },
  gestart: { label: "Bouwfase", korte: "Bouwen" },
  revisies: { label: "Feedback & revisies", korte: "Revisies" },
  oplevering: { label: "Oplevering voorbereiden", korte: "Oplevering" },
  restbetaling: { label: "Tweede termijn betalen", korte: "2e termijn" },
  mandaat: { label: "Automatische incasso regelen", korte: "Mandaat" },
  live: { label: "Website live", korte: "Live" },
  actief: { label: "Actieve klant", korte: "Actief" },
};

export function stageIndex(stage: JourneyStage): number {
  return JOURNEY_STAGES.indexOf(stage);
}

/** Warme, klant-vriendelijke labels voor het klantportaal. */
export const STAGE_KLANT_LABEL: Record<JourneyStage, string> = {
  aangevraagd: "Demo aangevraagd",
  voorbereiden: "We maken jouw voorbeeld",
  "demo-verstuurd": "Jouw voorbeeld staat klaar",
  ingelogd: "Bekijk jouw website",
  bekeken: "Ontdek de mogelijkheden",
  feedback: "Geef feedback",
  afspraak: "Plan een gesprek",
  "demo-akkoord": "We gaan het samen doen",
  offerte: "We maken je voorstel",
  "voorstel-verstuurd": "Je voorstel staat klaar",
  akkoord: "Voorstel akkoord",
  overeenkomst: "Overeenkomst tekenen",
  aanbetaling: "Eerste termijn",
  gestart: "We bouwen jouw website",
  revisies: "Jouw feedback verwerken",
  oplevering: "Klaar voor oplevering",
  restbetaling: "Laatste termijn",
  mandaat: "Abonnement activeren",
  live: "Je website is live",
  actief: "Alles draait",
};

/**
 * Zes zichtbare fases voor de voortgangsbalk. Twintig stappen zijn te veel om
 * in één balk te tonen; deze groepering is wat de klant én de beheerder in één
 * oogopslag nodig hebben.
 */
export const JOURNEY_PHASES = [
  { key: "demo", label: "Demo", stages: ["aangevraagd", "voorbereiden", "demo-verstuurd", "ingelogd", "bekeken", "feedback", "afspraak", "demo-akkoord"] },
  { key: "voorstel", label: "Voorstel", stages: ["offerte", "voorstel-verstuurd", "akkoord"] },
  { key: "overeenkomst", label: "Overeenkomst", stages: ["overeenkomst"] },
  { key: "aanbetaling", label: "1e termijn", stages: ["aanbetaling"] },
  { key: "bouw", label: "Bouw", stages: ["gestart", "revisies"] },
  { key: "oplevering", label: "Oplevering", stages: ["oplevering", "restbetaling", "mandaat"] },
  { key: "actief", label: "Live & actief", stages: ["live", "actief"] },
] as const satisfies readonly {
  key: string;
  label: string;
  stages: readonly JourneyStage[];
}[];

export type JourneyPhaseKey = (typeof JOURNEY_PHASES)[number]["key"];

/** In welke zichtbare fase valt deze stage? */
export function phaseIndexFor(stage: JourneyStage): number {
  const i = JOURNEY_PHASES.findIndex((p) =>
    (p.stages as readonly string[]).includes(stage),
  );
  return i < 0 ? 0 : i;
}

/** Drie statussen voor de tijdlijn: afgerond, huidig, nog niet gestart. */
export type StepState = "done" | "current" | "todo";

export function stepStateFor(
  stage: JourneyStage,
  current: JourneyStage,
): StepState {
  const i = stageIndex(stage);
  const c = stageIndex(current);
  if (i < c) return "done";
  if (i === c) return "current";
  return "todo";
}

/** Fase-status voor de voortgangsbalk. */
export function phaseStateFor(phaseIdx: number, current: JourneyStage): StepState {
  const c = phaseIndexFor(current);
  if (phaseIdx < c) return "done";
  if (phaseIdx === c) return "current";
  return "todo";
}
