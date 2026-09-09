import type { PartnerStatus } from "@/lib/db/schema";
import {
  LANDING_PAGE_MAX_LENGTH,
  REFERRAL_WINDOW_MS,
  REFERRER_MAX_LENGTH,
  UTM_KEYS,
  UTM_MAX_LENGTH,
  type Utm,
} from "@/lib/referral-config";

/**
 * De rekenkern van de referral-attributie: alles wat je kunt beslissen zonder
 * database, cookiejar of request. Bewust puur, zodat de regels die over
 * commissie gaan met gewone tests te controleren zijn.
 *
 * De regel in één zin: WIE de bezoeker binnenbracht wordt bij het eerste
 * bezoek bepaald en verandert daarna niet meer.
 */

/* ------------------------------------------------------------- codes ----- */

/**
 * Normaliseer een referralcode uit de URL: niet hoofdlettergevoelig, alleen
 * veilige tekens, en niets wat op een pad of een stuk markup lijkt. Alles wat
 * hier null oplevert komt nooit bij de database in de buurt.
 */
export function normalizeReferralCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,38}[A-Z0-9]$/.test(code)) return null;
  return code;
}

/* ------------------------------------------------------------- cookie ---- */

/**
 * De inhoud van de attributiecookie. Korte sleutels omdat hij bij elk verzoek
 * meereist; uitsluitend id's en codes, nooit iets over de persoon.
 *
 * `v` maakt de vorm herkenbaar. Een cookie zonder `v` komt uit de vorige,
 * last-touch-versie: die wordt gelezen als eerste aanraking, zodat bezoekers
 * die al onderweg waren hun partner houden.
 */
export type ReferralCookie = {
  v: 2;
  /** First touch — de partner die de bezoeker binnenbracht. */
  p: string;
  c: string;
  k: string | null;
  t: number;
  /** Last touch — de laatst gebruikte partnerlink (kan dezelfde zijn). */
  lp: string;
  lc: string;
  lk: string | null;
  lt: number;
};

/** Eén aanraking: een geldig bezoek via een partnerlink. */
export type Touch = {
  partnerId: string;
  referralCode: string;
  clickId: string | null;
  at: number;
};

function isNietLegeString(waarde: unknown): waarde is string {
  return typeof waarde === "string" && waarde.length > 0;
}

/**
 * Lees de cookie-inhoud. Geeft null bij alles wat niet klopt — een kapotte of
 * geknutselde cookie leidt tot "geen attributie", nooit tot een fout.
 */
export function parseReferralCookie(payload: string): ReferralCookie | null {
  let ruw: unknown;
  try {
    ruw = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof ruw !== "object" || ruw === null) return null;
  const o = ruw as Record<string, unknown>;

  if (!isNietLegeString(o.p) || !isNietLegeString(o.c)) return null;
  if (typeof o.t !== "number" || !Number.isFinite(o.t)) return null;

  const eerste: Omit<ReferralCookie, "lp" | "lc" | "lk" | "lt"> = {
    v: 2,
    p: o.p,
    c: o.c,
    k: isNietLegeString(o.k) ? o.k : null,
    t: o.t,
  };

  // Cookie uit de vorige versie: die kende alleen één aanraking.
  const heeftLaatste =
    isNietLegeString(o.lp) && isNietLegeString(o.lc) && typeof o.lt === "number";

  return {
    ...eerste,
    lp: heeftLaatste ? (o.lp as string) : eerste.p,
    lc: heeftLaatste ? (o.lc as string) : eerste.c,
    lk: heeftLaatste ? (isNietLegeString(o.lk) ? o.lk : null) : eerste.k,
    lt: heeftLaatste ? (o.lt as number) : eerste.t,
  };
}

/**
 * Verwerk een nieuw partnerbezoek in de bestaande cookie.
 *
 * De eerste aanraking blijft staan zolang het venster loopt — ook wanneer de
 * bezoeker daarna een ándere partnerlink opent. Die tweede partner wordt wel
 * als last touch bewaard, zodat zichtbaar blijft dat hij er was.
 *
 * Is het venster verlopen, dan begint de reis opnieuw en wordt de nieuwe
 * partner de eerste aanraking.
 */
export function mergeTouch(
  bestaand: ReferralCookie | null,
  nieuw: Touch,
): ReferralCookie {
  const versVenster =
    bestaand !== null && nieuw.at - bestaand.t <= REFERRAL_WINDOW_MS;

  if (!bestaand || !versVenster) {
    return {
      v: 2,
      p: nieuw.partnerId,
      c: nieuw.referralCode,
      k: nieuw.clickId,
      t: nieuw.at,
      lp: nieuw.partnerId,
      lc: nieuw.referralCode,
      lk: nieuw.clickId,
      lt: nieuw.at,
    };
  }

  return {
    ...bestaand,
    lp: nieuw.partnerId,
    lc: nieuw.referralCode,
    lk: nieuw.clickId,
    lt: nieuw.at,
  };
}

/** Loopt het attributievenster nog, gerekend vanaf de eerste aanraking? */
export function vensterOpen(cookie: ReferralCookie, nu: number): boolean {
  return nu - cookie.t <= REFERRAL_WINDOW_MS;
}

/**
 * Resterende geldigheid in seconden, verankerd aan de EERSTE aanraking.
 *
 * Zonder deze verankering zou elk volgend bezoek de cookie weer op zestig
 * dagen zetten en zou een partner die één keer een link deelde eindeloos
 * kunnen blijven claimen.
 */
export function resterendeSeconden(cookie: ReferralCookie, nu: number): number {
  const over = cookie.t + REFERRAL_WINDOW_MS - nu;
  return Math.max(0, Math.floor(over / 1000));
}

/* ------------------------------------------------------------ toekennen -- */

/**
 * Statussen waarbij een partnerlink "leeft": bezoek registreren, welkom tonen
 * én attribueren. Een net uitgenodigde partner (INVITED) telt mee — de link
 * hoort meteen te werken. PAUSED/BLOCKED/ENDED (gepauzeerd/geblokkeerd/
 * beëindigd) doen bewust niets: geen attributie, geen korting, geen commissie.
 */
const REFERRAL_ACTIVE_STATUSES: PartnerStatus[] = ["ACTIVE", "INVITED"];

export function partnerCanRefer(status: PartnerStatus): boolean {
  return REFERRAL_ACTIVE_STATUSES.includes(status);
}

/** Wat we van een partner moeten weten om te kunnen toekennen. */
export type PartnerToestand = {
  id: string;
  status: PartnerStatus;
  /** De actuele code uit de database — die kan hernoemd zijn sinds het bezoek. */
  referralCode: string;
};

export type Toekenning = {
  partnerId: string;
  referralCode: string;
  clickId: string | null;
  model: "FIRST_TOUCH" | "LAST_VALID_REFERRAL";
};

/**
 * Wie krijgt deze aanvraag?
 *
 * First touch wint. Mag die partner niet meer attribueren — gepauzeerd,
 * geblokkeerd, beëindigd of helemaal verdwenen — dan schuift de aanvraag door
 * naar de laatste geldige partnerlink, en anders naar niemand. Zo levert een
 * geblokkeerde partner nooit een stille commissie op, en verliest een aanvraag
 * ook niet zijn herkomst wanneer er wél een geldige latere aanbrenger is.
 *
 * De partnerstatus komt uit de database, nooit uit de cookie: die zegt alleen
 * wíe er langskwam, niet of dat nu nog mag.
 */
export function kenToe(
  cookie: ReferralCookie,
  partners: Map<string, PartnerToestand>,
): Toekenning | null {
  const eerste = partners.get(cookie.p);
  if (eerste && partnerCanRefer(eerste.status)) {
    return {
      partnerId: eerste.id,
      referralCode: eerste.referralCode,
      clickId: cookie.k,
      model: "FIRST_TOUCH",
    };
  }

  const laatste = partners.get(cookie.lp);
  if (laatste && laatste.id !== cookie.p && partnerCanRefer(laatste.status)) {
    return {
      partnerId: laatste.id,
      referralCode: laatste.referralCode,
      clickId: cookie.lk,
      model: "LAST_VALID_REFERRAL",
    };
  }

  return null;
}

/* -------------------------------------------------------------- opschonen - */

/**
 * Alleen de vaste marketingparameters, elk begrensd. Onbekende `utm_*`-namen
 * worden genegeerd: de URL is invoer van buiten en mag niet bepalen welke
 * sleutels er in onze database belanden.
 */
export function schoneUtm(params: URLSearchParams | undefined): Utm | null {
  if (!params) return null;
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const waarde = params.get(key)?.trim();
    if (waarde) utm[key] = waarde.slice(0, UTM_MAX_LENGTH);
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

/**
 * De pagina waarop de bezoeker binnenkwam. Alleen een intern pad; een
 * volledige URL of een pad met een host erin wordt geweigerd.
 */
export function schoneLandingspagina(pad: string | null | undefined): string | null {
  if (!pad) return null;
  if (!pad.startsWith("/") || pad.startsWith("//")) return null;
  if (pad.includes("://") || pad.includes("\\")) return null;
  return pad.slice(0, LANDING_PAGE_MAX_LENGTH);
}

/**
 * De verwijzende bron (Referer), teruggebracht tot herkomst + pad. Zoekopdracht
 * en fragment gaan eraf: daar staan soms zoektermen of tokens in, en die horen
 * niet in een marketingveld thuis.
 */
export function schoneVerwijzer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`.slice(0, REFERRER_MAX_LENGTH);
  } catch {
    return null;
  }
}
