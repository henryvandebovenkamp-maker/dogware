/**
 * Betaalregelingen voor de eenmalige investering — de pure rekenlaag.
 *
 * Tot nu toe kende DogWare één manier van betalen: een deel bij de start en
 * het restant bij oplevering. Dit bestand maakt daar een keuze van, zonder een
 * tweede betaalsysteem ernaast te zetten:
 *
 *   50-50      de bestaande afspraak (aanbetaling + restant bij oplevering);
 *   volledig   alles in één keer na ondertekening;
 *   termijnen  een vrij te kiezen aantal maandelijkse termijnen.
 *
 * Het maandabonnement staat hier bewust NIET in. Dat is een aparte financiële
 * verplichting met een eigen Mollie-abonnement; de termijnen gaan uitsluitend
 * over de eenmalige ontwikkelkosten.
 *
 * Regels die overal gelden:
 *   - alles in hele centen, nooit via een float;
 *   - de termijnen tellen altijd exact op tot het totaal (excl. btw, btw én
 *     incl. btw) — de laatste termijn vangt het afrondingsverschil op;
 *   - datums zijn kalenderdatums: "een maand later" is dezelfde dag in de
 *     volgende maand, en valt die dag niet in die maand, dan de laatste dag.
 *
 * Client-safe: puur, zonder imports met bijwerkingen. De server rekent, de
 * browser toont alleen.
 */

/* =========================================================================
 * De keuze
 * ========================================================================= */

export const PAYMENT_PLAN_KINDS = ["50-50", "volledig", "termijnen"] as const;
export type PaymentPlanKind = (typeof PAYMENT_PLAN_KINDS)[number];

/** Wanneer het termijnschema begint. */
export const PLAN_STARTS = ["bij-akkoord", "datum"] as const;
export type PlanStart = (typeof PLAN_STARTS)[number];

/** Snelkeuzes in de editor. Het datamodel is niet tot deze aantallen beperkt. */
export const INSTALLMENT_PRESETS = [2, 3, 4, 6, 12] as const;
export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 36;

/**
 * Een termijn onder dit bedrag (incl. btw) weigeren we. Mollie accepteert
 * technisch één cent, maar een termijn van een paar cent is een tikfout, geen
 * betaalafspraak.
 */
export const MIN_TERM_INCL_CENTS = 100;

/**
 * Een termijn opent voor betaling zoveel dagen vóór zijn vervaldatum, en heet
 * "te laat" zoveel dagen erna. Vaste getallen op één plek, zodat klantportaal,
 * admin, herinneringen en de livegang-poort nooit iets anders beweren.
 */
export const OPENS_DAYS_BEFORE = 14;
export const LATE_AFTER_DAYS = 7;

export type PlanConfig = {
  soort: PaymentPlanKind;
  /** Aantal termijnen. 50-50 is altijd 2, volledig altijd 1. */
  aantal: number;
  start: PlanStart;
  /** Kalenderdatum "YYYY-MM-DD" bij start = "datum", anders null. */
  startDatum: string | null;
};

export const DEFAULT_PLAN: PlanConfig = {
  soort: "50-50",
  aantal: 2,
  start: "bij-akkoord",
  startDatum: null,
};

const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Is dit een bestaande kalenderdatum ("2026-02-30" is dat niet)? */
export function isGeldigeDatum(v: string | null | undefined): v is string {
  const m = v ? DATUM.exec(v) : null;
  if (!m) return false;
  const [j, mnd, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mnd >= 1 && mnd <= 12 && d >= 1 && d <= dagenInMaand(j, mnd - 1);
}

/**
 * Maakt van willekeurige invoer een geldige regeling. Onbekend is altijd de
 * bestaande 50/50-afspraak: een lege of kapotte waarde mag nooit ongemerkt
 * een andere betaalafspraak opleveren.
 */
export function normalizePlan(input: {
  soort?: string | null;
  aantal?: number | string | null;
  start?: string | null;
  startDatum?: string | null;
}): PlanConfig {
  const soort = (PAYMENT_PLAN_KINDS as readonly string[]).includes(input.soort ?? "")
    ? (input.soort as PaymentPlanKind)
    : "50-50";
  if (soort === "50-50") return { ...DEFAULT_PLAN };
  if (soort === "volledig") return { soort, aantal: 1, start: "bij-akkoord", startDatum: null };

  const ruw = Math.round(Number(input.aantal));
  const aantal = Number.isFinite(ruw)
    ? Math.min(MAX_INSTALLMENTS, Math.max(MIN_INSTALLMENTS, ruw))
    : 6;
  const start: PlanStart = input.start === "datum" ? "datum" : "bij-akkoord";
  const startDatum = start === "datum" && isGeldigeDatum(input.startDatum) ? input.startDatum : null;
  return { soort, aantal, start: startDatum ? "datum" : "bij-akkoord", startDatum };
}

/* =========================================================================
 * Bedragen
 * ========================================================================= */

/**
 * Verdeelt een bedrag in centen over n gelijke delen.
 *
 * Alle delen zijn het commercieel afgeronde gemiddelde; het laatste deel is
 * wat er overblijft. € 2.500 over 6: vijf keer € 416,67 en één keer € 416,65.
 * De som is per constructie exact het totaal.
 */
export function splitEvenly(totalCents: number, n: number): number[] {
  const totaal = Math.round(totalCents);
  const aantal = Math.max(1, Math.round(n));
  const regulier = Math.round(totaal / aantal);
  const delen = Array.from({ length: aantal - 1 }, () => regulier);
  delen.push(totaal - regulier * (aantal - 1));
  return delen;
}

/** Eén geplande termijn, zoals hij bevroren in voorstel en overeenkomst staat. */
export type PlannedTerm = {
  volgnummer: number;
  aantal: number;
  /**
   * Wat de termijn verschuldigd maakt:
   *   akkoord     — bij ondertekening (of op de gekozen startdatum);
   *   maandelijks — een vast aantal kalendermaanden na de start;
   *   oplevering  — bij oplevering (de tweede helft van 50/50).
   */
  moment: "akkoord" | "maandelijks" | "oplevering";
  /** Kalendermaanden na de start. 0 voor de eerste termijn. */
  maandenNaStart: number;
  exVatCents: number;
  vatCents: number;
  inclVatCents: number;
};

/** De volledige, bevroren betaalregeling. */
export type BetaalRegeling = PlanConfig & {
  vatPercent: number;
  totaalExVatCents: number;
  totaalVatCents: number;
  totaalInclVatCents: number;
  termijnen: PlannedTerm[];
};

/** De uitkomst van `computeOneOff` die de regeling nodig heeft. */
export type OneOffTotals = {
  netExVatCents: number;
  vatCents: number;
  totalInclVatCents: number;
  depositCents: number;
  finalCents: number;
  depositPercent: number;
};

export type RegelingResult =
  | { ok: true; regeling: BetaalRegeling }
  | { ok: false; reden: string; regeling: BetaalRegeling };

/**
 * Bouwt het termijnschema uit de afspraak. Server-side, altijd — de browser
 * levert hooguit de keuze aan, nooit een bedrag.
 *
 * Geeft altijd een regeling terug (zodat een scherm iets kan tonen), maar met
 * `ok: false` als hij niet verstuurd mag worden, bijvoorbeeld omdat een
 * termijn op een paar cent uit zou komen.
 */
export function buildRegeling(
  plan: PlanConfig,
  oneOff: OneOffTotals,
  vatPercent: number,
): RegelingResult {
  const p = normalizePlan(plan);
  const net = Math.max(0, Math.round(oneOff.netExVatCents));
  const vat = Math.max(0, Math.round(oneOff.vatCents));
  const incl = net + vat;
  const pct = Math.max(0, Math.round(vatPercent));

  let termijnen: PlannedTerm[];

  if (p.soort === "50-50") {
    /*
     * Exact de bestaande berekening: de aanbetaling is een percentage van het
     * totaal INCL. btw en de tweede termijn het restant. Het excl.-deel volgt
     * daaruit; de btw is het verschil, zodat elke kolom sluit.
     */
    const eersteIncl = Math.round(oneOff.depositCents);
    const tweedeIncl = incl - eersteIncl;
    const eersteEx = Math.round((net * oneOff.depositPercent) / 100);
    termijnen = [
      { volgnummer: 1, aantal: 2, moment: "akkoord", maandenNaStart: 0, exVatCents: eersteEx, vatCents: eersteIncl - eersteEx, inclVatCents: eersteIncl },
      { volgnummer: 2, aantal: 2, moment: "oplevering", maandenNaStart: 0, exVatCents: net - eersteEx, vatCents: tweedeIncl - (net - eersteEx), inclVatCents: tweedeIncl },
    ];
  } else if (p.soort === "volledig") {
    termijnen = [
      { volgnummer: 1, aantal: 1, moment: "akkoord", maandenNaStart: 0, exVatCents: net, vatCents: vat, inclVatCents: incl },
    ];
  } else {
    /*
     * De afspraak is in bedragen excl. btw ("€ 2.500 in 6 termijnen"), dus daar
     * wordt verdeeld. De btw per termijn is afgerond over die termijn; de
     * laatste termijn krijgt wat er van de totale btw overblijft, zodat de
     * btw-kolom exact aansluit op de btw van de opdracht.
     */
    const exDelen = splitEvenly(net, p.aantal);
    const vatDelen = exDelen.map((ex) => Math.round((ex * pct) / 100));
    vatDelen[vatDelen.length - 1] = vat - vatDelen.slice(0, -1).reduce((s, v) => s + v, 0);
    termijnen = exDelen.map((ex, i) => ({
      volgnummer: i + 1,
      aantal: p.aantal,
      moment: i === 0 ? "akkoord" : "maandelijks",
      maandenNaStart: i,
      exVatCents: ex,
      vatCents: vatDelen[i],
      inclVatCents: ex + vatDelen[i],
    }));
  }

  const regeling: BetaalRegeling = {
    ...p,
    aantal: termijnen.length,
    vatPercent: pct,
    totaalExVatCents: net,
    totaalVatCents: vat,
    totaalInclVatCents: incl,
    termijnen,
  };

  if (net <= 0) return { ok: false, reden: "Er is nog geen eenmalig bedrag ingevuld.", regeling };
  const teKlein = termijnen.find(
    (t) => t.inclVatCents < MIN_TERM_INCL_CENTS || t.exVatCents <= 0 || t.vatCents < 0,
  );
  if (teKlein) {
    return {
      ok: false,
      reden: `Met ${termijnen.length} termijnen wordt een termijn te klein. Kies minder termijnen.`,
      regeling,
    };
  }
  return { ok: true, regeling };
}

/** Controleert de onveranderlijke eis: elke kolom telt exact op tot het totaal. */
export function regelingSluit(r: BetaalRegeling): boolean {
  const som = (k: "exVatCents" | "vatCents" | "inclVatCents") =>
    r.termijnen.reduce((s, t) => s + t[k], 0);
  return (
    som("exVatCents") === r.totaalExVatCents &&
    som("vatCents") === r.totaalVatCents &&
    som("inclVatCents") === r.totaalInclVatCents &&
    r.termijnen.every((t) => t.exVatCents + t.vatCents === t.inclVatCents)
  );
}

/* =========================================================================
 * Datums
 *
 * Een vervaldatum is een kalenderdag, geen tijdstip. We slaan hem op als
 * 12:00 UTC van die dag: in Nederland (UTC+1/+2) blijft dat dezelfde dag, wat
 * de zomertijd ook doet. Middernacht zou bij de weergave een dag kunnen
 * verspringen.
 * ========================================================================= */

function dagenInMaand(jaar: number, maandIndex: number): number {
  return new Date(Date.UTC(jaar, maandIndex + 1, 0)).getUTCDate();
}

/** Kalenderdag als Date op 12:00 UTC. */
export function kalenderdag(jaar: number, maandIndex: number, dag: number): Date {
  return new Date(Date.UTC(jaar, maandIndex, dag, 12, 0, 0));
}

/** "YYYY-MM-DD" → Date op 12:00 UTC. */
export function vanDatum(v: string): Date {
  const m = DATUM.exec(v);
  if (!m) throw new Error(`Ongeldige datum: ${v}`);
  return kalenderdag(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** De Nederlandse kalenderdag van een moment (Europe/Amsterdam). */
export function kalenderdagVan(moment: Date): Date {
  const delen = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
  return vanDatum(delen);
}

/**
 * Tel kalendermaanden op bij een startdag.
 *
 * Altijd gerekend vanaf de STARTdag, nooit vanaf de vorige uitkomst: 31
 * januari + 1 maand is 28 (of 29) februari, en + 2 maanden is weer 31 maart —
 * niet 28 maart omdat februari ertussen zat.
 */
export function plusMaanden(start: Date, maanden: number): Date {
  const jaar = start.getUTCFullYear();
  const maand = start.getUTCMonth() + maanden;
  const doelJaar = jaar + Math.floor(maand / 12);
  const doelMaand = ((maand % 12) + 12) % 12;
  const dag = Math.min(start.getUTCDate(), dagenInMaand(doelJaar, doelMaand));
  return kalenderdag(doelJaar, doelMaand, dag);
}

/**
 * De vervaldatum van elke termijn, vanaf het ankerpunt.
 *
 * `anker` is de dag van ondertekening, of de gekozen startdatum als die later
 * ligt. Een termijn die bij oplevering verschuldigd is krijgt nog geen datum:
 * die volgt pas als de oplevering er is.
 */
export function vervaldata(regeling: Pick<BetaalRegeling, "termijnen">, anker: Date): (Date | null)[] {
  return regeling.termijnen.map((t) =>
    t.moment === "oplevering" ? null : plusMaanden(anker, t.maandenNaStart),
  );
}

/**
 * Het ankerpunt van het schema. Bij "bij akkoord" de dag van ondertekening;
 * bij een vaste startdatum die datum — maar nooit vóór de ondertekening, want
 * een termijn kan niet al verschuldigd zijn voordat er iets is afgesproken.
 */
export function ankerVoor(plan: Pick<PlanConfig, "start" | "startDatum">, ondertekend: Date): Date {
  const dag = kalenderdagVan(ondertekend);
  if (plan.start === "datum" && plan.startDatum) {
    const gekozen = vanDatum(plan.startDatum);
    return gekozen.getTime() > dag.getTime() ? gekozen : dag;
  }
  return dag;
}

const DAG_MS = 24 * 60 * 60 * 1000;

/* =========================================================================
 * Status van een termijn
 *
 * Opgeslagen wordt alleen wat een gebeurtenis is: betaald of geannuleerd.
 * "Te betalen" en "te laat" zijn gevolgen van de kalender en worden afgeleid,
 * net als "verlopen" bij facturen. Zo kan er geen termijn bestaan die al weken
 * te laat is maar nog "gepland" beweert omdat er ergens een taak niet liep.
 * ========================================================================= */

export const INSTALLMENT_STATUSES = ["GEPLAND", "BETAALD", "GEANNULEERD"] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export type TermijnStatus =
  | "wacht-op-oplevering"
  | "gepland"
  | "te-betalen"
  | "mislukt"
  | "te-laat"
  | "betaald"
  | "geannuleerd";

export const TERMIJN_STATUS_LABEL: Record<TermijnStatus, string> = {
  "wacht-op-oplevering": "Bij oplevering",
  gepland: "Gepland",
  "te-betalen": "Te betalen",
  mislukt: "Mislukt",
  "te-laat": "Te laat",
  betaald: "Betaald",
  geannuleerd: "Geannuleerd",
};

export type TermijnFeiten = {
  status: InstallmentStatus;
  dueAt: Date | null;
  /** Status van de laatste betaalpoging bij Mollie, als die er is. */
  laatstePoging?: string | null;
};

/** Vanaf wanneer deze termijn betaald kan worden. */
export function opentOp(dueAt: Date): Date {
  return new Date(dueAt.getTime() - OPENS_DAYS_BEFORE * DAG_MS);
}

/** Na dit moment is de termijn te laat (einde van de respijtdag). */
export function teLaatNa(dueAt: Date): Date {
  return new Date(dueAt.getTime() + (LATE_AFTER_DAYS + 0.5) * DAG_MS);
}

export function termijnStatus(t: TermijnFeiten, nu: Date = new Date()): TermijnStatus {
  if (t.status === "BETAALD") return "betaald";
  if (t.status === "GEANNULEERD") return "geannuleerd";
  if (!t.dueAt) return "wacht-op-oplevering";
  if (nu.getTime() < opentOp(t.dueAt).getTime()) return "gepland";
  if (nu.getTime() > teLaatNa(t.dueAt).getTime()) return "te-laat";
  if (t.laatstePoging && ["FAILED", "EXPIRED", "CANCELED"].includes(t.laatstePoging)) {
    return "mislukt";
  }
  return "te-betalen";
}

/** Kan de klant deze termijn nu betalen? Uitsluitend op volgorde. */
export function isBetaalbaar(
  t: TermijnFeiten & { volgnummer: number },
  alle: readonly (TermijnFeiten & { volgnummer: number })[],
  nu: Date = new Date(),
): boolean {
  const s = termijnStatus(t, nu);
  if (!["te-betalen", "mislukt", "te-laat"].includes(s)) return false;
  return alle.every((a) => a.volgnummer >= t.volgnummer || a.status === "BETAALD");
}

/* =========================================================================
 * Voortgang — wat de admin in één oogopslag en de klant zonder financiële
 * kennis moet kunnen zien.
 * ========================================================================= */

export type VoortgangTerm = TermijnFeiten & {
  volgnummer: number;
  aantal: number;
  exVatCents: number;
  vatCents: number;
  inclVatCents: number;
};

export type Voortgang = {
  aantal: number;
  betaaldAantal: number;
  betaaldExCents: number;
  betaaldInclCents: number;
  openExCents: number;
  openInclCents: number;
  teLaatAantal: number;
  /** De eerstvolgende onbetaalde termijn, of null als alles betaald is. */
  volgende: VoortgangTerm | null;
  volgendeStatus: TermijnStatus | null;
  volgendeBetaalbaar: boolean;
  volledigBetaald: boolean;
};

export function voortgang(termijnen: readonly VoortgangTerm[], nu: Date = new Date()): Voortgang {
  const actief = termijnen.filter((t) => t.status !== "GEANNULEERD");
  const betaald = actief.filter((t) => t.status === "BETAALD");
  const open = actief.filter((t) => t.status !== "BETAALD");
  const volgende = [...open].sort((a, b) => a.volgnummer - b.volgnummer)[0] ?? null;
  return {
    aantal: actief.length,
    betaaldAantal: betaald.length,
    betaaldExCents: betaald.reduce((s, t) => s + t.exVatCents, 0),
    betaaldInclCents: betaald.reduce((s, t) => s + t.inclVatCents, 0),
    openExCents: open.reduce((s, t) => s + t.exVatCents, 0),
    openInclCents: open.reduce((s, t) => s + t.inclVatCents, 0),
    teLaatAantal: open.filter((t) => termijnStatus(t, nu) === "te-laat").length,
    volgende,
    volgendeStatus: volgende ? termijnStatus(volgende, nu) : null,
    volgendeBetaalbaar: volgende ? isBetaalbaar(volgende, actief, nu) : false,
    volledigBetaald: actief.length > 0 && open.length === 0,
  };
}

/* =========================================================================
 * Woorden
 * ========================================================================= */

const GETAL = ["nul", "één", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf"];
const woord = (n: number) => GETAL[n] ?? String(n);

/** Korte naam: "50% bij start, 50% bij oplevering", "In één keer", "6 termijnen". */
export function regelingTitel(r: Pick<PlanConfig, "soort" | "aantal">, depositPercent = 50): string {
  if (r.soort === "volledig") return "In één keer";
  if (r.soort === "termijnen") return `${r.aantal} termijnen`;
  return `${depositPercent}% bij start, ${100 - depositPercent}% bij oplevering`;
}

/** Eén zin voor de klant, zonder vakjargon. */
export function regelingZin(r: Pick<PlanConfig, "soort" | "aantal" | "start" | "startDatum">): string {
  if (r.soort === "volledig") {
    return "Je betaalt de eenmalige investering in één keer, na ondertekening.";
  }
  if (r.soort === "termijnen") {
    const begin =
      r.start === "datum" && r.startDatum
        ? `De eerste termijn is verschuldigd op ${datumLang(vanDatum(r.startDatum))}`
        : "De eerste termijn betaal je na ondertekening";
    return `Je betaalt de eenmalige investering in ${woord(r.aantal)} maandelijkse termijnen. ${begin}, daarna elke maand één termijn.`;
  }
  return "Je betaalt de eenmalige investering in twee delen: een deel bij de start en het restant bij oplevering.";
}

/** Wanneer een geplande termijn verschuldigd is, vóórdat er een datum vaststaat. */
export function momentLabel(
  t: Pick<PlannedTerm, "moment" | "maandenNaStart">,
  plan: Pick<PlanConfig, "start" | "startDatum">,
): string {
  if (t.moment === "oplevering") return "Bij oplevering";
  if (plan.start === "datum" && plan.startDatum) {
    return datumLang(plusMaanden(vanDatum(plan.startDatum), t.maandenNaStart));
  }
  if (t.maandenNaStart === 0) return "Na ondertekening";
  return t.maandenNaStart === 1
    ? "1 maand na ondertekening"
    : `${t.maandenNaStart} maanden na ondertekening`;
}

export function datumLang(d: Date): string {
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

/**
 * De stand van een schema in de vorm die de volgende-stap-motor gebruikt.
 * Null zonder termijnen (historische overeenkomst of nog niet getekend).
 */
export function regelingStand(
  termijnen: readonly (TermijnFeiten & { volgnummer: number; aantal: number; plan: PaymentPlanKind })[],
  nu: Date = new Date(),
): {
  soort: PaymentPlanKind;
  aantal: number;
  betaaldAantal: number;
  teLaatAantal: number;
  allesBetaald: boolean;
  volgende: { volgnummer: number; teLaat: boolean } | null;
} | null {
  if (termijnen.length === 0) return null;
  const actief = termijnen.filter((t) => t.status !== "GEANNULEERD");
  const open = actief
    .filter((t) => t.status !== "BETAALD")
    .sort((a, b) => a.volgnummer - b.volgnummer);
  const teLaat = open.filter((t) => termijnStatus(t, nu) === "te-laat");
  return {
    soort: termijnen[0].plan,
    aantal: actief.length,
    betaaldAantal: actief.length - open.length,
    teLaatAantal: teLaat.length,
    allesBetaald: open.length === 0,
    volgende: open[0]
      ? { volgnummer: open[0].volgnummer, teLaat: termijnStatus(open[0], nu) === "te-laat" }
      : null,
  };
}
