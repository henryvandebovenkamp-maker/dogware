import type { CommissieStatus, JourneyStage, LeadStatus } from "@/lib/db/schema";
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

/* =========================================================================
 * Uitbetaling — de geregistreerde commissie (partner_commissions)
 *
 * Hierboven staat de afleiding uit de journey: hoe ver is de aanbreng? Vanaf
 * hier gaat het om geld: is de klant aantoonbaar volledig betaald, en is de
 * commissie al overgemaakt? Ook dit is puur en zonder database, zodat admin,
 * partnerportaal en tests exact dezelfde regels gebruiken.
 * ========================================================================= */

export const COMMISSIE_STATUS_LABEL: Record<CommissieStatus, string> = {
  WACHT_OP_BETALING: "Wacht op betaling klant",
  UITBETAALBAAR: "Uitbetaalbaar",
  VOORBEREID: "Uitbetaling voorbereid",
  GOEDGEKEURD: "Goedgekeurd — klaar voor overschrijving",
  UITBETAALD: "Uitbetaald",
  VERVALLEN: "Vervallen",
};

/**
 * Hoe de partner zijn commissie ziet. Bewust grover dan de adminstatus: of
 * een uitbetaling voorbereid of al goedgekeurd is, is intern werk — voor de
 * partner is het allebei "wordt uitbetaald".
 */
export type PartnerCommissieGroep = "wacht" | "beschikbaar" | "uitbetaald" | "vervallen";

export function partnerCommissieGroep(status: CommissieStatus): PartnerCommissieGroep {
  switch (status) {
    case "WACHT_OP_BETALING":
      return "wacht";
    case "UITBETAALBAAR":
    case "VOORBEREID":
    case "GOEDGEKEURD":
      return "beschikbaar";
    case "UITBETAALD":
      return "uitbetaald";
    case "VERVALLEN":
      return "vervallen";
  }
}

export const PARTNER_COMMISSIE_LABEL: Record<CommissieStatus, string> = {
  WACHT_OP_BETALING: "Wacht op betaling van de klant",
  UITBETAALBAAR: "Beschikbaar voor uitbetaling",
  VOORBEREID: "Uitbetaling wordt verwerkt",
  GOEDGEKEURD: "Uitbetaling wordt verwerkt",
  UITBETAALD: "Uitbetaald",
  VERVALLEN: "Vervallen",
};

/** Mag deze aanbreng een commissierij krijgen? Vanaf akkoord, niet afgevallen. */
export function commissieRegistreerbaar(stage: JourneyStage, status: LeadStatus): boolean {
  const fase = commissieFase(stage, status);
  return fase === "gereserveerd" || fase === "verdiend";
}

/**
 * Is de eenmalige investering volledig voldaan?
 *
 * Alleen tegen een GETEKENDE overeenkomst: zonder handtekening is er geen
 * afgesproken totaal, en dan kan "alles betaald" niet waar zijn. Een totaal
 * van nul telt evenmin als betaald — dat is een afspraak die niet klopt.
 */
export function volledigBetaald(input: {
  getekend: boolean;
  totaalCents: number;
  betaaldCents: number;
}): boolean {
  return input.getekend && input.totaalCents > 0 && input.betaaldCents >= input.totaalCents;
}

/** Een Mollie-bedrag ("504.17") in hele centen, zonder via een float te gaan. */
function mollieCenten(waarde: string | null | undefined): number | null {
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(String(waarde ?? "").trim());
  if (!m) return null;
  const centen = Number(m[2]) * 100 + Number(`${m[3] ?? ""}00`.slice(0, 2));
  return m[1] ? -centen : centen;
}

/** Wat we van een Mollie-betaling nodig hebben om hem te vertrouwen. */
export type MollieBetalingFeiten = {
  status?: string | null;
  amount?: { value?: string | null } | null;
  amountRefunded?: { value?: string | null } | null;
  amountChargedBack?: { value?: string | null } | null;
};

/**
 * Mag deze betaling meetellen als "voldaan" voor een commissie?
 *
 * De status in onze database komt uit de webhook en is dus al door Mollie
 * bevestigd. Maar vóór er geld naar een partner gaat, vragen we het Mollie
 * opnieuw: is hij nog steeds betaald, voor exact het verwachte bedrag, en is
 * er sindsdien niets teruggestort of teruggeboekt? Elke twijfel is nee.
 */
export function beoordeelMollieBetaling(
  verwachtCents: number,
  mollie: MollieBetalingFeiten | null,
): { ok: true } | { ok: false; reden: string } {
  if (!mollie) return { ok: false, reden: "Niet op te halen bij Mollie." };
  if (mollie.status !== "paid") {
    return { ok: false, reden: `Mollie meldt status "${mollie.status ?? "onbekend"}".` };
  }
  const bedrag = mollieCenten(mollie.amount?.value);
  if (bedrag !== verwachtCents) return { ok: false, reden: "Bedrag bij Mollie wijkt af." };
  if ((mollieCenten(mollie.amountRefunded?.value) ?? 0) > 0) {
    return { ok: false, reden: "Er is (een deel) teruggestort." };
  }
  if ((mollieCenten(mollie.amountChargedBack?.value) ?? 0) > 0) {
    return { ok: false, reden: "Er is een terugboeking (chargeback)." };
  }
  return { ok: true };
}

/**
 * De gegevens van een uitgevoerde overschrijving, zoals de beheerder ze
 * invult. Streng: zonder bankdatum en kenmerk is "uitbetaald" niet aantoonbaar.
 */
export function leesUitbetaling(
  input: { datum: string; referentie: string; bedrag: string },
  verwachtCents: number,
  nu = new Date(),
):
  | { ok: true; datum: Date; referentie: string; bedragCents: number }
  | { ok: false; reden: string } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.datum.trim());
  if (!d) return { ok: false, reden: "Vul de datum van de overschrijving in." };
  // 12:00 UTC, net als de vervaldatums in het betaalschema: geen tijdzonegedoe.
  const datum = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), 12));
  if (Number.isNaN(datum.getTime()) || datum.getUTCDate() !== Number(d[3])) {
    return { ok: false, reden: "Ongeldige datum." };
  }
  if (datum.getTime() > nu.getTime() + 36 * 3600_000) {
    return { ok: false, reden: "De overschrijving kan niet in de toekomst liggen." };
  }
  const referentie = input.referentie.trim();
  if (referentie.length < 3 || referentie.length > 80) {
    return { ok: false, reden: "Vul het betalingskenmerk van de bank in (3–80 tekens)." };
  }
  // "500", "500,00", "1.500,00" en "500.00" — met komma zijn punten duizendtallen.
  const ruw = input.bedrag.replace(/[€\s]/g, "");
  const bedrag = mollieCenten(ruw.includes(",") ? ruw.replace(/\./g, "").replace(",", ".") : ruw);
  if (bedrag === null || bedrag !== verwachtCents) {
    return { ok: false, reden: "Het overgemaakte bedrag moet exact gelijk zijn aan de commissie." };
  }
  return { ok: true, datum, referentie, bedragCents: bedrag };
}
