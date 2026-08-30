/**
 * Server-side geldberekeningen voor de commerciële journey.
 * Alles in eurocenten (integers) — nooit floating-point voor geld.
 * Pure functies, deterministisch en testbaar.
 */

export type DiscountType = "none" | "amount" | "percent";

/** Centrale commerciële afspraak — één bron van waarheid. */
export type CommercialConfig = {
  /** Projectbedrag excl. btw, in centen (website + werk) */
  projectCents: number;
  /** Opstartkosten excl. btw, in centen */
  setupCents: number;
  /** Kortingstype op de eenmalige kosten */
  discountType: DiscountType;
  /** Kortingswaarde: centen (amount) of procenten 0-100 (percent) */
  discountValue: number;
  /** Btw-percentage (bijv. 21) */
  vatPercent: number;
  /** Aanbetalingspercentage (0-100), standaard 50 */
  depositPercent: number;

  /** Maandbedrag excl. btw, in centen (definitief tarief) */
  monthlyCents: number;
  /** Aantal volledig gratis maanden aan het begin */
  freeMonths: number;
  /** Introkorting op de maanden ná de gratis periode (procent 0-100) */
  introDiscountPercent: number;
  /** Aantal maanden dat de introkorting geldt */
  introDiscountMonths: number;
};

export const DEFAULT_CONFIG: CommercialConfig = {
  projectCents: 0,
  setupCents: 0,
  discountType: "none",
  discountValue: 0,
  vatPercent: 21,
  depositPercent: 50,
  monthlyCents: 0,
  freeMonths: 0,
  introDiscountPercent: 0,
  introDiscountMonths: 0,
};

/** Rond af naar hele centen (banker's-vrij, gewoon commercieel afronden). */
function round(n: number): number {
  return Math.round(n);
}

function clampPercent(p: number): number {
  return Math.min(100, Math.max(0, p));
}

/** Berekent alle eenmalige bedragen uit de centrale afspraak. */
export function computeOneOff(c: CommercialConfig) {
  const subtotal = Math.max(0, round(c.projectCents) + round(c.setupCents));

  let discountCents = 0;
  if (c.discountType === "amount") {
    discountCents = Math.min(subtotal, Math.max(0, round(c.discountValue)));
  } else if (c.discountType === "percent") {
    discountCents = round((subtotal * clampPercent(c.discountValue)) / 100);
  }

  const netExVat = Math.max(0, subtotal - discountCents);
  const vatCents = round((netExVat * Math.max(0, c.vatPercent)) / 100);
  const totalInclVat = netExVat + vatCents;

  const depositPct = clampPercent(c.depositPercent || 50);
  const depositCents = round((totalInclVat * depositPct) / 100);
  const finalCents = Math.max(0, totalInclVat - depositCents);

  // Het maandbedrag hoort bij dezelfde berekening: overal waar het abonnement
  // getoond wordt (voorstel, overeenkomst, portaal, mail) komt het hiervandaan
  // en wordt het niet opnieuw met de hand vermenigvuldigd.
  const monthlyExVatCents = Math.max(0, round(c.monthlyCents));
  const monthlyVatCents = round((monthlyExVatCents * Math.max(0, c.vatPercent)) / 100);

  return {
    subtotalCents: subtotal,
    discountCents,
    netExVatCents: netExVat,
    vatCents,
    totalInclVatCents: totalInclVat,
    depositCents,
    finalCents,
    /** Aanbetalingspercentage zoals werkelijk toegepast (na clamping). */
    depositPercent: depositPct,
    /** Tweede termijn als percentage — altijd het complement, nooit los ingevoerd. */
    finalPercent: 100 - depositPct,
    monthlyExVatCents,
    monthlyVatCents,
    monthlyInclVatCents: monthlyExVatCents + monthlyVatCents,
  };
}

export type OneOffBreakdown = ReturnType<typeof computeOneOff>;

/**
 * Werkelijk openstaand bedrag voor de tweede termijn: totaal minus wat al
 * betaald is (leidend boven "totaal × 50%").
 */
export function computeOutstanding(
  c: CommercialConfig,
  paidCents: number,
): number {
  const { totalInclVatCents } = computeOneOff(c);
  return Math.max(0, totalInclVatCents - Math.max(0, paidCents));
}

export type MonthPlan = {
  /** 1-based maandnummer vanaf abonnementsstart */
  index: number;
  /** Bedrag incl. btw in centen (0 = gratis maand) */
  amountInclVatCents: number;
  label: string;
};

/**
 * Bouwt het abonnementsschema voor de eerste N maanden: gratis maanden,
 * introkorting, daarna het volledige tarief. Incl. btw.
 */
export function subscriptionSchedule(
  c: CommercialConfig,
  months = 12,
): MonthPlan[] {
  const vat = Math.max(0, c.vatPercent);
  const fullInclVat = round(c.monthlyCents + (c.monthlyCents * vat) / 100);
  const introPct = clampPercent(c.introDiscountPercent);
  const plan: MonthPlan[] = [];

  for (let i = 1; i <= months; i++) {
    if (i <= c.freeMonths) {
      plan.push({ index: i, amountInclVatCents: 0, label: "Gratis maand" });
    } else if (i <= c.freeMonths + c.introDiscountMonths && introPct > 0) {
      const amount = round(fullInclVat * (1 - introPct / 100));
      plan.push({ index: i, amountInclVatCents: amount, label: `${introPct}% korting` });
    } else {
      plan.push({ index: i, amountInclVatCents: fullInclVat, label: "Volledig tarief" });
    }
  }
  return plan;
}

export type SubscriptionStartRule =
  | "na-oplevering"
  | "na-laatste-betaling"
  | "eerste-volgende-maand"
  | "handmatig";

/**
 * Bepaalt de eerste incassodatum op basis van de gekozen regel.
 * `base` is het referentiemoment (oplevering of laatste betaling).
 */
export function firstChargeDate(
  rule: SubscriptionStartRule,
  base: Date,
  handmatig?: Date,
): Date {
  switch (rule) {
    case "eerste-volgende-maand": {
      const d = new Date(base);
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    case "handmatig":
      return handmatig ?? base;
    case "na-oplevering":
    case "na-laatste-betaling":
    default:
      return base;
  }
}

/** Bedrag als nette euro-tekst. */
export function euroFromCents(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Menselijke omschrijving van wanneer het abonnement begint te lopen. */
export function subscriptionStartLabel(
  rule: SubscriptionStartRule,
  handmatig?: Date | null,
): string {
  switch (rule) {
    case "na-oplevering":
      return "De incasso van het maandbedrag start na oplevering van het project.";
    case "na-laatste-betaling":
      return "De incasso van het maandbedrag start na ontvangst van de tweede termijn.";
    case "eerste-volgende-maand":
      return "De incasso van het maandbedrag start op de eerste dag van de maand die volgt op de oplevering.";
    case "handmatig":
      return handmatig
        ? `De incasso van het maandbedrag start op ${handmatig.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}.`
        : "De startdatum van het maandbedrag wordt in onderling overleg vastgesteld.";
  }
}

/**
 * Mag er op dit moment al geïncasseerd worden?
 *
 * Bewust een aparte, pure functie: "het mandaat is actief" is niet hetzelfde
 * als "de eerste incasso mag nu plaatsvinden". Zonder dit onderscheid zou een
 * klant te vroeg worden afgeschreven.
 */
export function mayChargeSubscription(opts: {
  now: Date;
  startAt: Date | null;
  freeMonths: number;
}): boolean {
  if (!opts.startAt) return false;
  /*
   * Bewust in UTC rekenen. Met lokale maandrekenkunde verschuift het antwoord
   * mee met de zomertijd: een startdatum in september plus twee maanden komt
   * dan een uur ná middernacht in november uit, waardoor de eerste incasso net
   * een dag te laat lijkt te mogen. Bij geld is dat geen detail.
   */
  const eerste = new Date(opts.startAt);
  eerste.setUTCMonth(eerste.getUTCMonth() + Math.max(0, opts.freeMonths));
  return opts.now.getTime() >= eerste.getTime();
}

/* =========================================================================
 * Factuurregels
 *
 * Een factuur is geen totaalbedrag met een label eromheen: hij bestaat uit
 * regels, en de totalen zijn de som van die regels. Alles hieronder is puur en
 * rekent uitsluitend in hele centen — geen enkele tussenstap in euro's, want
 * daar ontstaan de afrondingsverschillen die een boekhouder later niet meer
 * kan verklaren.
 * ========================================================================= */

/** Eén regel op de factuur, met alles al uitgerekend. */
export type InvoiceLine = {
  omschrijving: string;
  /** Tweede regel eronder, bijv. "50% aanbetaling". Leeg = geen. */
  toelichting: string | null;
  aantal: number;
  /** Stukprijs exclusief btw, in centen. */
  prijsExVatCents: number;
  vatPercent: number;
  /** aantal × stukprijs */
  regelExVatCents: number;
  regelVatCents: number;
  regelInclVatCents: number;
};

export type InvoiceTotals = {
  exclCents: number;
  btwCents: number;
  inclCents: number;
  /** Het percentage dat op de factuur staat. Null bij gemengde tarieven. */
  btwPercent: number | null;
};

/**
 * Bouwt één factuurregel. Het btw-bedrag wordt over de REGEL berekend, niet
 * per stuk: bij 3 × € 0,15 met 21% is dat 9 cent en niet 3 × 3 cent.
 */
export function invoiceLine(input: {
  omschrijving: string;
  toelichting?: string | null;
  aantal?: number;
  prijsExVatCents: number;
  vatPercent: number;
}): InvoiceLine {
  const aantal = Number.isFinite(input.aantal) ? Math.round(input.aantal as number) : 1;
  const prijs = Math.round(input.prijsExVatCents);
  const vatPercent = Math.max(0, Math.round(input.vatPercent));
  const regelEx = aantal * prijs;
  const regelVat = Math.round((regelEx * vatPercent) / 100);
  return {
    omschrijving: input.omschrijving,
    toelichting: input.toelichting?.trim() || null,
    aantal,
    prijsExVatCents: prijs,
    vatPercent,
    regelExVatCents: regelEx,
    regelVatCents: regelVat,
    regelInclVatCents: regelEx + regelVat,
  };
}

/**
 * Regel exclusief btw uit een bedrag INCLUSIEF btw.
 *
 * Nodig omdat Mollie een bedrag inclusief btw bevestigt en dát het bedrag is
 * dat werkelijk is ontvangen. De btw is dan het verschil, nooit een tweede
 * afronding — anders telt de factuur een cent naast wat er op de rekening
 * staat.
 */
export function invoiceLineFromGross(input: {
  omschrijving: string;
  toelichting?: string | null;
  grossCents: number;
  vatPercent: number;
}): InvoiceLine {
  const vatPercent = Math.max(0, Math.round(input.vatPercent));
  const incl = Math.round(input.grossCents);
  const ex = Math.round(incl / (1 + vatPercent / 100));
  return {
    omschrijving: input.omschrijving,
    toelichting: input.toelichting?.trim() || null,
    aantal: 1,
    prijsExVatCents: ex,
    vatPercent,
    regelExVatCents: ex,
    regelVatCents: incl - ex,
    regelInclVatCents: incl,
  };
}

/** Totalen als som van de regels. Nooit los ingevoerd of herberekend. */
export function sumInvoiceLines(regels: readonly InvoiceLine[]): InvoiceTotals {
  const exclCents = regels.reduce((s, r) => s + r.regelExVatCents, 0);
  const btwCents = regels.reduce((s, r) => s + r.regelVatCents, 0);
  const tarieven = new Set(regels.map((r) => r.vatPercent));
  return {
    exclCents,
    btwCents,
    inclCents: exclCents + btwCents,
    btwPercent: tarieven.size === 1 ? [...tarieven][0] : null,
  };
}

/** Alle bedragen van een regel omgedraaid — de basis onder een creditnota. */
export function negateInvoiceLine(regel: InvoiceLine): InvoiceLine {
  return {
    ...regel,
    prijsExVatCents: -regel.prijsExVatCents,
    regelExVatCents: -regel.regelExVatCents,
    regelVatCents: -regel.regelVatCents,
    regelInclVatCents: -regel.regelInclVatCents,
  };
}

/**
 * Nette naam van een Mollie-betaalmethode.
 *
 * De factuur beweerde eerder altijd "via iDEAL", ook bij een creditcard- of
 * incassobetaling. Onbekende methodes krijgen geen verzonnen label maar
 * gewoon niets, zodat er nooit een onwaarheid op een factuur belandt.
 */
export function betaalmethodeLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  const labels: Record<string, string> = {
    ideal: "iDEAL",
    creditcard: "Creditcard",
    bancontact: "Bancontact",
    banktransfer: "Bankoverboeking",
    directdebit: "SEPA-incasso",
    paypal: "PayPal",
    applepay: "Apple Pay",
    belfius: "Belfius",
    kbc: "KBC",
    sofort: "SOFORT",
    eps: "EPS",
    giropay: "giropay",
    przelewy24: "Przelewy24",
  };
  return labels[method.toLowerCase()] ?? null;
}
