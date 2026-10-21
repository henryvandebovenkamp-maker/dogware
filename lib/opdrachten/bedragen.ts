/**
 * Aanvullende opdrachten — bedragen, statussen en de bevroren inhoud.
 *
 * Puur en zonder database, zodat de server, de editor en de tests exact
 * dezelfde berekening gebruiken. Alles in hele eurocenten; nergens een
 * tussenstap in euro's.
 */
import type { ExtraOrderStatus, MaandIngang } from "@/lib/db/schema";

/* =========================================================================
 * Bedragen
 * ========================================================================= */

export type Termijnbedrag = {
  percent: number;
  exVatCents: number;
  vatCents: number;
  inclVatCents: number;
};

export type OpdrachtBedragen = {
  exVatCents: number;
  vatCents: number;
  inclVatCents: number;
  vatPercent: number;
  aanbetaling: Termijnbedrag;
  eindbetaling: Termijnbedrag;
};

function pct(p: number, standaard: number): number {
  const n = Number.isFinite(p) ? Math.round(p) : standaard;
  return Math.min(100, Math.max(0, n));
}

/**
 * De eenmalige prijs, opgesplitst in twee termijnen.
 *
 * De btw wordt één keer over het geheel berekend; de tweede termijn krijgt
 * steeds het restant (excl. én btw). Zo tellen de twee facturen samen altijd
 * exact op tot de afgesproken prijs — geen cent die door twee losse
 * afrondingen wegloopt.
 */
export function berekenOpdracht(input: {
  priceExVatCents: number;
  vatPercent: number;
  depositPercent?: number;
}): OpdrachtBedragen {
  const ex = Math.max(0, Math.round(input.priceExVatCents));
  const vatPercent = Math.max(0, Math.round(input.vatPercent));
  const vat = Math.round((ex * vatPercent) / 100);
  const p = pct(input.depositPercent ?? 50, 50);

  const aanEx = Math.round((ex * p) / 100);
  const aanVat = Math.round((aanEx * vatPercent) / 100);
  const eindEx = ex - aanEx;
  const eindVat = vat - aanVat;

  return {
    exVatCents: ex,
    vatCents: vat,
    inclVatCents: ex + vat,
    vatPercent,
    aanbetaling: { percent: p, exVatCents: aanEx, vatCents: aanVat, inclVatCents: aanEx + aanVat },
    eindbetaling: { percent: 100 - p, exVatCents: eindEx, vatCents: eindVat, inclVatCents: eindEx + eindVat },
  };
}

/** Maandbedrag incl. btw — dezelfde formule als bij het aanmaken van het abonnement. */
export function maandInclBtw(monthlyExVatCents: number, vatPercent: number): number {
  return Math.round(monthlyExVatCents * (1 + Math.max(0, vatPercent) / 100));
}

export type MaandWijziging = {
  deltaExVatCents: number;
  vanExVatCents: number;
  naarExVatCents: number;
  naarInclVatCents: number;
};

/** Het maandbedrag vóór en na deze opdracht. Null als er niets verandert. */
export function maandWijziging(
  huidigExVatCents: number,
  deltaExVatCents: number,
  vatPercent: number,
): MaandWijziging | null {
  const delta = Math.round(deltaExVatCents);
  if (!delta) return null;
  const van = Math.max(0, Math.round(huidigExVatCents));
  const naar = van + delta;
  return {
    deltaExVatCents: delta,
    vanExVatCents: van,
    naarExVatCents: naar,
    naarInclVatCents: maandInclBtw(naar, vatPercent),
  };
}

/**
 * Euro-invoer naar centen. Accepteert "1250", "1250.50", "1.250,50" en
 * "-10"; geeft null bij alles wat geen bedrag is. Nooit via een float.
 */
export function euroNaarCenten(invoer: string | number | null | undefined): number | null {
  const ruw = String(invoer ?? "").trim().replace(/\s|€/g, "");
  if (!ruw) return null;
  let s = ruw;
  // "1.250,50" → "1250.50"; "1250,5" → "1250.5"
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const centen = Number(m[2]) * 100 + Number(`${m[3] ?? ""}00`.slice(0, 2));
  if (!Number.isSafeInteger(centen)) return null;
  return m[1] ? -centen : centen;
}

/** Centen naar invoertekst voor een formulier: 125050 → "1250.50". */
export function centenNaarInvoer(cents: number): string {
  if (!cents) return "";
  const neg = cents < 0;
  const a = Math.abs(cents);
  return `${neg ? "-" : ""}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}

/* =========================================================================
 * De bevroren inhoud van een verstuurde versie
 * ========================================================================= */

export type OpdrachtInhoud = {
  versie: number;
  titel: string;
  omschrijving: string | null;
  werkzaamheden: string[];
  verwachteOplevering: string | null;
  geldigTot: string | null;
  bedragen: OpdrachtBedragen;
  /** Null als het maandbedrag niet verandert. */
  maand: (MaandWijziging & { ingang: MaandIngang; ingangDatum: string | null }) | null;
};

export function leesInhoud(raw: unknown): OpdrachtInhoud | null {
  const r = raw as Partial<OpdrachtInhoud> | null;
  if (!r || typeof r.versie !== "number" || !r.bedragen) return null;
  return r as OpdrachtInhoud;
}

/* =========================================================================
 * Statussen
 * ========================================================================= */

/** De zichtbare voortgang, in volgorde. */
export const OPDRACHT_STAPPEN: { status: ExtraOrderStatus; label: string }[] = [
  { status: "CONCEPT", label: "Concept" },
  { status: "VERZONDEN", label: "Verzonden" },
  { status: "AKKOORD", label: "Akkoord" },
  { status: "AANBETAALD", label: "Aanbetaling ontvangen" },
  { status: "IN_UITVOERING", label: "In uitvoering" },
  { status: "OPGELEVERD", label: "Opgeleverd" },
  { status: "EINDBETAALD", label: "Eindbetaling ontvangen" },
  { status: "AFGEROND", label: "Afgerond" },
];

export const OPDRACHT_STATUS_LABEL: Record<ExtraOrderStatus, string> = {
  CONCEPT: "Concept",
  VERZONDEN: "Verzonden",
  AKKOORD: "Akkoord",
  AANBETAALD: "Aanbetaling ontvangen",
  IN_UITVOERING: "In uitvoering",
  OPGELEVERD: "Opgeleverd",
  EINDBETAALD: "Eindbetaling ontvangen",
  AFGEROND: "Afgerond",
  INGETROKKEN: "Ingetrokken",
};

export function stapIndex(status: ExtraOrderStatus): number {
  return OPDRACHT_STAPPEN.findIndex((s) => s.status === status);
}

/** Is de aanbetaling binnen (en is er dus geld ontvangen op deze opdracht)? */
export function aanbetalingOntvangen(status: ExtraOrderStatus): boolean {
  return stapIndex(status) >= stapIndex("AANBETAALD");
}

/** Mag het maandbedrag op basis van deze status al worden aangepast? */
export function maandMagIngaan(status: ExtraOrderStatus): boolean {
  return status !== "INGETROKKEN" && aanbetalingOntvangen(status);
}

/** Een korte, menselijke omschrijving van wat er nu van wie verwacht wordt. */
export function volgendeStap(status: ExtraOrderStatus, verlopen: boolean): string {
  switch (status) {
    case "CONCEPT":
      return "Vul de opdracht aan en verstuur hem naar de klant.";
    case "VERZONDEN":
      return verlopen
        ? "De geldigheid is verlopen. Verleng hem of pas de opdracht aan."
        : "Wacht op het akkoord van de klant.";
    case "AKKOORD":
      return "Wacht op de aanbetaling. De bouw start pas als Mollie die bevestigt.";
    case "AANBETAALD":
      return "De aanbetaling is binnen. Start de bouw.";
    case "IN_UITVOERING":
      return "Bouwen. Lever op zodra het klaar is; dan gaat het eindbetaalverzoek uit.";
    case "OPGELEVERD":
      return "Wacht op de eindbetaling.";
    case "EINDBETAALD":
      return "Alles is betaald. Rond de opdracht af.";
    case "AFGEROND":
      return "Afgerond.";
    case "INGETROKKEN":
      return "Ingetrokken.";
  }
}
