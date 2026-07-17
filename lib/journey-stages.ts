import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";

/**
 * Client-veilige journey-definities (labels, volgorde).
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
  offerte: { label: "Offerte", korte: "Offerte" },
  akkoord: { label: "Akkoord", korte: "Akkoord" },
  gestart: { label: "Project gestart", korte: "Gestart" },
};

export function stageIndex(stage: JourneyStage): number {
  return JOURNEY_STAGES.indexOf(stage);
}
