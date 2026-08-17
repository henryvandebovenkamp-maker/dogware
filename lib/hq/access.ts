/**
 * De toegangsmatrix van DogWare HQ — bewust zonder enige import.
 *
 * Dit bestand bevat géén database, géén cookies en géén Next.js. Het is pure
 * logica die één vraag beantwoordt: mag deze aanvraag HQ zien, ja of nee?
 * Daardoor is de matrix volledig te testen zonder de rest van de applicatie
 * op te tuigen, en kan er nooit per ongeluk een netwerk- of cookie-fout
 * ontstaan die tot "wel toegang" leidt.
 *
 * De regel is simpel en staat hier maar op één plek: alleen een expliciete
 * eigenaartoekenning geeft toegang. Beheerdersrollen doen dat nooit.
 */

/**
 * De eigenaarrol. Deze waarde staat bewust NIET in `USER_ROLES` in
 * lib/db/schema.ts: hij hoort niet thuis in de gewone rollenwereld met
 * labels, bestemmingen en sessieduur, en mag daardoor ook nergens in de
 * beheerinterface opduiken of toegekend worden. Hij leeft als losse rij in
 * `user_roles.role` (een text-kolom, geen enum) en wordt uitsluitend door
 * lib/hq-auth.ts uitgelezen.
 */
export const HQ_OWNER_ROLE = "DOGWARE_OWNER";

/** Waarom HQ dichtblijft. Uitsluitend voor serverlogs — nooit voor de bezoeker. */
export type HqDenyReason =
  | "flag_uit"
  | "geen_sessie"
  | "account_niet_actief"
  | "geen_eigenaar";

export type HqAccessResult =
  | { allowed: true }
  | { allowed: false; reason: HqDenyReason };

export type HqAccessInput = {
  /** Uitkomst van de server-side feature flag (HQ_ENABLED). */
  hqEnabled: boolean;
  /**
   * De ingelogde persoon, of null. `roles` zijn de gewone rollen
   * (SUPER_ADMIN, AFFILIATE_PARTNER, CUSTOMER). Ze worden hier bewust
   * NIET geraadpleegd voor toegang — ze staan er alleen zodat de reden
   * van weigering en de logging kloppen.
   */
  session: { status: string; roles: readonly string[] } | null;
  /**
   * De uitkomst van de aparte `user_roles`-query naar DOGWARE_OWNER.
   * Dit is het enige veld dat toegang kan geven.
   */
  hasOwnerGrant: boolean;
};

/**
 * Bepaal of HQ open mag. Fail closed: elke twijfel is een weigering.
 *
 * Volgorde is bewust. De feature flag gaat voorop, zodat een uitgezette HQ
 * zich exact hetzelfde gedraagt voor de eigenaar als voor een vreemde en er
 * geen verschil in timing of gedrag te meten valt vóór de sessie is gelezen.
 */
export function evaluateHqAccess(input: HqAccessInput): HqAccessResult {
  if (!input.hqEnabled) return { allowed: false, reason: "flag_uit" };
  if (!input.session) return { allowed: false, reason: "geen_sessie" };
  if (input.session.status !== "ACTIVE") {
    return { allowed: false, reason: "account_niet_actief" };
  }
  // Let op: hier staat met opzet geen enkele controle op input.session.roles.
  // Een Super Admin is géén eigenaar; alleen de expliciete toekenning telt.
  if (!input.hasOwnerGrant) return { allowed: false, reason: "geen_eigenaar" };
  return { allowed: true };
}

/**
 * Lees de HQ-feature flag uit een ruwe environmentwaarde.
 *
 * Fail closed: uitsluitend de exacte string "true" zet HQ aan. Ontbrekend,
 * leeg, "1", "TRUE", "yes" of wat dan ook betekent uit. Bewust géén trim of
 * hoofdletterconversie — dan is er precies één waarde die werkt en kan een
 * slordige environmentregel HQ niet per ongeluk openzetten.
 */
export function parseHqFlag(raw: string | undefined | null): boolean {
  return raw === "true";
}
