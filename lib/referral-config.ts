/**
 * Centrale instellingen van de referral-attributie.
 *
 * Bewust een apart bestand zonder `server-only`: de cookiepagina, de tests en
 * de partnerteksten hebben dezelfde getallen nodig als de attributiemotor. Eén
 * plek, geen losse getallen verspreid door de code.
 */

/** Veilige uitlezing van een positief aantal dagen uit de environment. */
function dagenUitEnv(waarde: string | undefined, standaard: number): number {
  const n = Number(waarde);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : standaard;
}

/**
 * Hoe lang een referral blijft gelden, gerekend vanaf het EERSTE bezoek via de
 * partnerlink. Verlengt dus niet bij elk volgend bezoek: de partner die de
 * bezoeker binnenbracht houdt precies dit venster, niet langer.
 *
 * Aanpasbaar met `REFERRAL_WINDOW_DAYS`. (De oude naam `ATTRIBUTION_DAYS` is
 * vervallen — zie de release-notitie; hij stuurde een last-touch-venster aan
 * dat niet meer bestaat.)
 */
export const REFERRAL_WINDOW_DAYS = dagenUitEnv(process.env.REFERRAL_WINDOW_DAYS, 60);

export const REFERRAL_WINDOW_MS = REFERRAL_WINDOW_DAYS * 86_400_000;

/**
 * Het attributiemodel van DogWare: de EERSTE partnerlink waarlangs iemand
 * binnenkwam verdient de aanvraag. Een latere directe sessie of een tweede
 * partnerlink neemt die aanbreng niet stilletjes over.
 */
export const ATTRIBUTION_MODEL = "FIRST_TOUCH" as const;

/** Ondertekende attributiecookie (first + last touch). Alleen server leesbaar. */
export const REF_COOKIE = "dw_ref";
/** Anonieme bezoekers-id, uitsluitend om dubbele clicks te herkennen. */
export const VISITOR_COOKIE = "dw_vid";

/** Zelfde bezoeker + partner binnen dit venster = geen nieuw clickrecord. */
export const CLICK_DEDUPE_MINUTES = 30;

/** Hoe lang de bezoekers-id meegaat. Ruim boven het attributievenster. */
export const VISITOR_COOKIE_DAYS = 365;

/**
 * De marketingparameters die we bewaren. Een vaste lijst en geen "alles wat
 * met utm_ begint": zo kan niemand via de URL onbeperkt eigen sleutels in onze
 * database schrijven.
 */
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

/** Maximale lengte van een bewaarde UTM-waarde. */
export const UTM_MAX_LENGTH = 120;
/** Maximale lengte van een bewaarde landingspagina. */
export const LANDING_PAGE_MAX_LENGTH = 300;
/** Maximale lengte van de bewaarde verwijzende bron (Referer). */
export const REFERRER_MAX_LENGTH = 300;
