/**
 * De geldigheid van een voorstel (of opdrachtbevestiging).
 *
 * Twee regels die alles sturen:
 *
 *  1. Een geldigheidsdatum is een KALENDERDAG in Nederland. "Geldig t/m
 *     30 september" betekent: tot en met 30 september 23:59 Amsterdamse tijd.
 *     Niet tot het tijdstip waarop het concept toevallig werd aangemaakt, en
 *     niet tot middernacht UTC (dat is in de zomer 02:00 bij ons).
 *
 *  2. De geldigheid gaat uitsluitend over de periode VÓÓR acceptatie. Is het
 *     voorstel eenmaal geaccepteerd (los akkoord, of bij een directe klant via
 *     de handtekening), dan is het voorstel nooit meer "verlopen". Overeenkomst,
 *     ondertekening en betaling hebben hun eigen poortwachters en kijken nooit
 *     naar deze datum.
 *
 * Client-safe: pure functies zonder imports met bijwerkingen, zodat het
 * klantportaal, de admin, de serveracties en de tests er hetzelfde over
 * denken.
 */

export const TIJDZONE = "Europe/Amsterdam";

/** Hoe lang een nieuw voorstel standaard geldig is, in kalenderdagen. */
export const STANDAARD_GELDIG_DAGEN = 30;

/** Verder dan dit verlengen kan niet; een voorstel van jaren geleden hoort een nieuwe versie te worden. */
export const MAX_GELDIG_DAGEN = 365;

const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Hoeveel minuten Amsterdam op dit moment vóór loopt op UTC (60 of 120). */
function amsterdamOffsetMinuten(moment: Date): number {
  const delen = new Intl.DateTimeFormat("en-US", {
    timeZone: TIJDZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(moment);
  const deel = (t: string) => Number(delen.find((d) => d.type === t)?.value ?? 0);
  const alsUtc = Date.UTC(deel("year"), deel("month") - 1, deel("day"), deel("hour"), deel("minute"), deel("second"));
  return Math.round((alsUtc - Math.floor(moment.getTime() / 1000) * 1000) / 60_000);
}

/** De Nederlandse kalenderdag van een moment, als "YYYY-MM-DD". */
export function kalenderdag(moment: Date): string {
  const delen = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIJDZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(moment);
  const deel = (t: string) => delen.find((d) => d.type === t)?.value ?? "";
  return `${deel("year")}-${deel("month")}-${deel("day")}`;
}

/** Is dit een echte kalenderdatum ("2026-02-30" is dat niet)? */
export function isKalenderdatum(v: string | null | undefined): v is string {
  const m = DATUM.exec(String(v ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * Het laatste moment van een Nederlandse kalenderdag: 23:59:59.999 in
 * Amsterdam, als absoluut tijdstip. Null bij een ongeldige datum.
 */
export function eindeVanDag(datum: string): Date | null {
  if (!isKalenderdatum(datum)) return null;
  const [j, m, d] = datum.split("-").map(Number);
  const gok = Date.UTC(j, m - 1, d, 23, 59, 59, 999);
  // De offset op dat moment zelf, zodat ook de dagen rond de zomertijdwissel kloppen.
  return new Date(gok - amsterdamOffsetMinuten(new Date(gok)) * 60_000);
}

/** Een kalenderdag plus een aantal dagen, als "YYYY-MM-DD". */
export function dagenLater(datum: string, dagen: number): string {
  const [j, m, d] = datum.split("-").map(Number);
  const t = new Date(Date.UTC(j, m - 1, d + dagen));
  return t.toISOString().slice(0, 10);
}

/** De standaard geldigheid van een nieuw voorstel: einde van de dag, over 30 dagen. */
export function standaardGeldigTot(nu: Date = new Date()): Date {
  return eindeVanDag(dagenLater(kalenderdag(nu), STANDAARD_GELDIG_DAGEN))!;
}

/** Het deel van een voorstel dat nodig is om over de geldigheid te beslissen. */
export type GeldigheidVoorstel = {
  status: string;
  geldigTot: Date | null;
  acceptedAt: Date | null;
};

/** Is dit voorstel geaccepteerd? Dan telt de geldigheidsdatum nooit meer. */
export function isGeaccepteerd(p: Pick<GeldigheidVoorstel, "status" | "acceptedAt">): boolean {
  return Boolean(p.acceptedAt) || p.status === "ACCEPTED";
}

/**
 * Het moment waarop het voorstel verloopt, of null als het niet verloopt.
 *
 * Een opgeslagen tijdstip wordt altijd teruggebracht tot zijn Nederlandse
 * kalenderdag en daarvan het einde genomen. Zo krijgt de klant altijd de hele
 * dag die hij op zijn scherm ziet staan — ook bij voorstellen die nog met een
 * willekeurig tijdstip zijn opgeslagen.
 */
export function vervaltOp(p: Pick<GeldigheidVoorstel, "geldigTot">): Date | null {
  return p.geldigTot ? eindeVanDag(kalenderdag(p.geldigTot)) : null;
}

/**
 * Is dit voorstel verlopen? Uitsluitend waar voor een verstuurd, nog NIET
 * geaccepteerd voorstel waarvan de geldigheidsdag voorbij is.
 */
export function isVoorstelVerlopen(p: GeldigheidVoorstel, nu: Date = new Date()): boolean {
  if (isGeaccepteerd(p)) return false;
  const einde = vervaltOp(p);
  return Boolean(einde && einde.getTime() < nu.getTime());
}

/**
 * Mag de geldigheid naar deze datum? Alleen vandaag of later, en niet
 * onbeperkt ver vooruit. Geeft de nieuwe vervaldatum of een reden.
 */
export function nieuweGeldigheid(
  datum: string,
  nu: Date = new Date(),
): { ok: true; geldigTot: Date } | { ok: false; reden: string } {
  if (!isKalenderdatum(datum)) return { ok: false, reden: "Kies een geldige datum." };
  const vandaag = kalenderdag(nu);
  if (datum < vandaag) return { ok: false, reden: "Die datum ligt in het verleden. Kies vandaag of later." };
  if (datum > dagenLater(vandaag, MAX_GELDIG_DAGEN)) {
    return { ok: false, reden: "Verlengen kan tot maximaal een jaar vooruit. Maak anders een nieuwe versie." };
  }
  return { ok: true, geldigTot: eindeVanDag(datum)! };
}

/** "30 september 2026" — altijd de Nederlandse kalenderdag. */
export function geldigheidLabel(geldigTot: Date | string): string {
  return new Date(geldigTot).toLocaleDateString("nl-NL", {
    timeZone: TIJDZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
