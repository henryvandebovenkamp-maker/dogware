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

  return {
    subtotalCents: subtotal,
    discountCents,
    netExVatCents: netExVat,
    vatCents,
    totalInclVatCents: totalInclVat,
    depositCents,
    finalCents,
  };
}

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
