import type { JourneyStage, LeadStatus } from "@/lib/db/schema";
import { stageIndex } from "@/lib/journey-stages";

/**
 * Wanneer een aanbreng commissie waard is.
 *
 * Deze regels stonden al in het partnerportaal en zijn hier ongewijzigd
 * samengebracht, zodat het adminscherm en het partnerscherm per definitie
 * hetzelfde zeggen. Ze rekenen op de PLAATS van de stage in de journey en niet
 * op een opsomming van losse stages: bij een opsomming valt een aanvraag
 * stilzwijgend uit alle tellers zodra hij een stage bereikt die niemand in het
 * lijstje zette, en dan ziet de partner zijn aanbreng verdwijnen precies op het
 * moment dat die vooruitgaat.
 *
 * Belangrijk: dit is een AFLEIDING uit de journey, geen aparte administratie.
 * Daardoor kan één aanvraag ook nooit twee keer commissie opleveren — ook niet
 * wanneer een betaling mislukt en later alsnog slaagt. De teller telt
 * aanvragen, niet betaalpogingen.
 */

export const COMMISSIE_FASES = [
  "geen",
  "in-behandeling",
  "gereserveerd",
  "verdiend",
  "vervallen",
] as const;
export type CommissieFase = (typeof COMMISSIE_FASES)[number];

export const COMMISSIE_FASE_LABEL: Record<CommissieFase, string> = {
  geen: "Nog niet verschuldigd",
  "in-behandeling": "In behandeling",
  gereserveerd: "Gereserveerd",
  verdiend: "Verdiend",
  vervallen: "Vervallen",
};

/** Vanaf de demo-afspraak is er een echt gesprek: de aanbreng telt mee. */
const VANAF_BEHANDELING = stageIndex("afspraak");
/** Vanaf akkoord staat de commissie gereserveerd. */
const VANAF_GERESERVEERD = stageIndex("akkoord");
/** Vanaf de bouwfase is hij verdiend. */
const VANAF_VERDIEND = stageIndex("gestart");

/**
 * In welke fase de commissie van één aanvraag zit.
 *
 * Handmatig op "afgevallen" gezet telt nergens meer mee, ongeacht hoe ver de
 * stage stond toen het afketste.
 */
export function commissieFase(
  stage: JourneyStage,
  status: LeadStatus,
): CommissieFase {
  if (status === "afgevallen") return "vervallen";
  const i = stageIndex(stage);
  if (i >= VANAF_VERDIEND) return "verdiend";
  if (i >= VANAF_GERESERVEERD) return "gereserveerd";
  if (i >= VANAF_BEHANDELING) return "in-behandeling";
  return "geen";
}
