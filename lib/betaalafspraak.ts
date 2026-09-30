/**
 * De financiële afspraak van één opdracht — invoer lezen, rekenen en tonen.
 *
 * Eén module die door ALLES gebruikt wordt: de server-action die de afspraak
 * opslaat, de server die voorstel en overeenkomst bevriest, én de live preview
 * in de editor ("Zo ziet de klant het"). Daardoor kan de preview nooit iets
 * anders beweren dan wat de server bij opslaan en versturen uitrekent: het is
 * letterlijk dezelfde functie op dezelfde invoer.
 *
 * De server blijft de bron van waarheid. De browser rekent alleen vooruit om
 * te laten zien wat er gebeurt; opslaan en versturen rekenen opnieuw, op de
 * server, uit wat er in de database staat.
 *
 * Client-safe: puur, zonder imports met bijwerkingen.
 */
import { computeOneOff, euroFromCents, type CommercialConfig, type OneOffBreakdown } from "@/lib/money";
import {
  buildRegeling,
  datumLang,
  momentLabel,
  normalizePlan,
  regelingTitel,
  regelingZin,
  type BetaalRegeling,
  type PlanConfig,
} from "@/lib/payment-plan";

/* =========================================================================
 * Invoer lezen — zonder floats
 * ========================================================================= */

/**
 * "2500", "2500.5", "2.500,50", "2500,5" → centen. Wordt als tekst gelezen,
 * niet via een float: "19.99" * 100 is in JavaScript 1998.9999…
 */
export function euroInvoerNaarCenten(v: unknown): number {
  let s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return 0;
  // Het LAATSTE scheidingsteken is het decimaalteken; eerdere zijn duizendtallen.
  const laatste = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  let heel = s;
  let frac = "";
  if (laatste >= 0 && s.length - laatste - 1 <= 2) {
    heel = s.slice(0, laatste);
    frac = s.slice(laatste + 1);
  }
  heel = heel.replace(/[.,]/g, "");
  s = `${heel}${frac.padEnd(2, "0")}`;
  if (!/^\d+$/.test(s)) return 0;
  return Math.max(0, Number(s));
}

/** Een geheel, niet-negatief getal. Onleesbaar is 0. */
export function geheelInvoer(v: unknown): number {
  const n = Math.round(Number(String(v ?? "").trim().replace(",", ".")));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

const percentInvoer = (v: unknown) => Math.min(100, geheelInvoer(v));

/** De velden van het financiële formulier, zoals ze uit de browser komen. */
export type AfspraakInvoer = {
  project: string;
  setup: string;
  discountType: string;
  discountValue: string;
  vat: string;
  depositPercent: string;
  monthly: string;
  paymentPlan: string;
  installmentCount: string;
  installmentStart: string;
  installmentStartDate: string;
};

/**
 * Formulierinvoer → de afspraak. Dezelfde regels voor de server-action en de
 * live preview: wat de preview toont is precies wat opslaan oplevert.
 */
export function leesAfspraak(
  inv: AfspraakInvoer,
  basis: Pick<CommercialConfig, "freeMonths" | "introDiscountPercent" | "introDiscountMonths">,
): { config: CommercialConfig; plan: PlanConfig } {
  const dt = inv.discountType === "amount" || inv.discountType === "percent" ? inv.discountType : "none";
  return {
    config: {
      projectCents: euroInvoerNaarCenten(inv.project),
      setupCents: euroInvoerNaarCenten(inv.setup),
      discountType: dt,
      discountValue:
        dt === "percent" ? percentInvoer(inv.discountValue) : dt === "amount" ? euroInvoerNaarCenten(inv.discountValue) : 0,
      vatPercent: Math.min(100, geheelInvoer(inv.vat) || 21),
      depositPercent: percentInvoer(inv.depositPercent) || 50,
      monthlyCents: euroInvoerNaarCenten(inv.monthly),
      freeMonths: basis.freeMonths,
      introDiscountPercent: basis.introDiscountPercent,
      introDiscountMonths: basis.introDiscountMonths,
    },
    plan: normalizePlan({
      soort: inv.paymentPlan,
      aantal: inv.installmentCount,
      start: inv.installmentStart,
      startDatum: inv.installmentStartDate.trim() || null,
    }),
  };
}

/* =========================================================================
 * Rekenen
 * ========================================================================= */

/**
 * DE berekening van de eenmalige investering en haar betaalregeling. Netto →
 * btw → totaal incl. btw in centen → verdelen over de termijnen, met het
 * afrondingsverschil in de laatste termijn (zie buildRegeling).
 */
export function berekenAfspraak(config: CommercialConfig, plan: PlanConfig) {
  const computed = computeOneOff(config);
  const result = buildRegeling(plan, computed, config.vatPercent);
  return {
    computed,
    regeling: result.regeling,
    fout: result.ok ? null : result.reden,
  };
}

/* =========================================================================
 * Tonen
 * ========================================================================= */

/** Eén geplande termijn, klaar om te tonen. */
export type RegelingTermijnLabel = {
  volgnummer: number;
  aantal: number;
  wanneer: string;
  exVat: string;
  vat: string;
  inclVat: string;
};

/** Leesbare betaalregeling — serialiseerbaar, dus ook bruikbaar in client-componenten. */
export type RegelingLabels = {
  soort: BetaalRegeling["soort"];
  /** true bij een voorstel van vóór de betaalregelingen (altijd 50/50). */
  historisch: boolean;
  aantal: number;
  titel: string;
  zin: string;
  eersteBetaling: string;
  termijnen: RegelingTermijnLabel[];
};

type SnapMetRegeling = {
  computed: Pick<OneOffBreakdown, "depositPercent" | "depositCents" | "finalCents">;
  betaalregeling?: BetaalRegeling | null;
};

/**
 * De betaalregeling in woorden. Een voorstel zonder bevroren regeling is per
 * definitie de oude 50/50-afspraak; die tonen we met de bedragen die er al in
 * stonden, zonder iets opnieuw te berekenen.
 */
export function regelingLabels(snap: SnapMetRegeling): RegelingLabels {
  const c = snap.computed;
  const r = snap.betaalregeling;
  if (!r) {
    return {
      soort: "50-50",
      historisch: true,
      aantal: 2,
      titel: regelingTitel({ soort: "50-50", aantal: 2 }, c.depositPercent),
      zin: regelingZin({ soort: "50-50", aantal: 2, start: "bij-akkoord", startDatum: null }),
      eersteBetaling: "Na ondertekening",
      termijnen: [
        { volgnummer: 1, aantal: 2, wanneer: "Na ondertekening", exVat: "", vat: "", inclVat: euroFromCents(c.depositCents) },
        { volgnummer: 2, aantal: 2, wanneer: "Bij oplevering", exVat: "", vat: "", inclVat: euroFromCents(c.finalCents) },
      ],
    };
  }
  const termijnen = r.termijnen.map((t) => ({
    volgnummer: t.volgnummer,
    aantal: t.aantal,
    wanneer: momentLabel(t, r),
    exVat: euroFromCents(t.exVatCents),
    vat: euroFromCents(t.vatCents),
    inclVat: euroFromCents(t.inclVatCents),
  }));
  return {
    soort: r.soort,
    historisch: false,
    aantal: r.termijnen.length,
    titel: regelingTitel(r, c.depositPercent),
    zin: regelingZin(r),
    eersteBetaling:
      r.start === "datum" && r.startDatum ? datumLang(new Date(`${r.startDatum}T12:00:00Z`)) : "Na ondertekening",
    termijnen,
  };
}

/** Alles wat "Zo ziet de klant het" in de editor toont. */
export type AfspraakOverzicht = {
  subtotal: string;
  discount: string;
  heeftKorting: boolean;
  net: string;
  vat: string;
  vatPercent: number;
  total: string;
  depositPercent: number;
  finalPercent: number;
  monthlyExVat: string;
  monthlyInclVat: string;
  regeling: RegelingLabels;
  /** Waarom de regeling zo niet verstuurd kan worden, of null. */
  regelingFout: string | null;
};

export function afspraakOverzicht(config: CommercialConfig, plan: PlanConfig): AfspraakOverzicht {
  const { computed: c, regeling, fout } = berekenAfspraak(config, plan);
  return {
    subtotal: euroFromCents(c.subtotalCents),
    discount: euroFromCents(c.discountCents),
    heeftKorting: c.discountCents > 0,
    net: euroFromCents(c.netExVatCents),
    vat: euroFromCents(c.vatCents),
    vatPercent: config.vatPercent,
    total: euroFromCents(c.totalInclVatCents),
    depositPercent: c.depositPercent,
    finalPercent: c.finalPercent,
    monthlyExVat: euroFromCents(c.monthlyExVatCents),
    monthlyInclVat: euroFromCents(c.monthlyInclVatCents),
    regeling: regelingLabels({ computed: c, betaalregeling: regeling }),
    regelingFout: fout && config.projectCents + config.setupCents > 0 ? fout : null,
  };
}
