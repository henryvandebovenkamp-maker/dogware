/**
 * De voornaam van de contactpersoon uit een DogWare-aanvraag.
 *
 * De aanvraag kent één veld voor de contactpersoon (`leads.naam`) en één voor
 * het bedrijf (`leads.bedrijfsnaam`). Dat is de juiste bron; het probleem zit
 * in wat mensen intypen. Niet iedereen vult netjes "Pieke Everaert" in — er
 * komt ook "hond & gedrag Pieke Everaert" binnen, waarbij de bedrijfsnaam voor
 * de eigen naam is geplakt. Het eerste woord pakken levert dan "Hoi hond," op,
 * en dat is precies de mail die een potentiële klant niet moet krijgen.
 *
 * Daarom eerst de ruis eruit, en pas dan de voornaam. Twee signalen dragen dat:
 *
 * 1. Een woordenlijst met branche-, bedrijfs- en rechtsvormwoorden. Die staan
 *    wél in bedrijfsnamen en nóóit in een voornaam.
 * 2. De hoofdletter. Mensen schrijven hun eigen naam met een hoofdletter; de
 *    beschrijvende woorden ervoor typen ze meestal klein.
 *
 * Blijft er niets over, dan geeft deze functie `undefined` terug. Er wordt
 * nooit een naam verzonnen en nooit teruggevallen op de bedrijfsnaam — de mail
 * begint dan gewoon met "Hoi,".
 *
 * Client-safe: geen imports, geen bijwerkingen.
 */

/**
 * Woorden die in een bedrijfsnaam thuishoren, niet in een voornaam.
 *
 * Bewust conservatief: alleen woorden waarvan een Nederlandse voornaam
 * uitgesloten is. Bij twijfel hoort een woord hier níét in te staan — een
 * voornaam ten onrechte weggooien is erger dan een bedrijfswoord laten staan,
 * want het eerste kost de klant zijn naam in de aanhef.
 */
const BEDRIJFSWOORDEN = new Set([
  // Branches en diensten
  "hond", "honden", "hondje", "hondjes", "hondenschool", "hondenscholen",
  "gedrag", "gedragstherapie", "gedragstherapeut", "trimsalon", "trimmen",
  "uitlaatservice", "uitlaat", "uitlaatdienst", "pension", "dagopvang",
  "opvang", "oppas", "kennel", "kynologenclub", "dierenverzorging",
  "chipservice", "webshop", "school", "service", "diensten", "training",
  "trainingen", "academy", "academie", "praktijk", "centrum", "salon",
  "bedrijf", "dog", "dogs", "pet", "pets", "care", "walk", "walks", "walking",
  // Rechtsvormen
  "bv", "b.v.", "nv", "n.v.", "vof", "v.o.f.", "eenmanszaak", "cv", "stichting",
  // Verbindingswoorden en tussenvoegsels
  "en", "de", "het", "van", "der", "den", "ter", "te", "aan", "voor",
]);

/** Losse leestekens die als woord tussen de naam kunnen staan. */
const SYMBOOL = /^[&+|/\\\-–—·•,.]+$/;

/** Een initiaal ("P" of "P.") is geen voornaam om iemand mee aan te spreken. */
const INITIAAL = /^[A-Za-zÀ-ÿ]\.?$/;

/**
 * De voornaam waarmee de mail begint, of `undefined` als die niet met
 * voldoende zekerheid uit de aanvraag te halen is.
 *
 * @param naam         `leads.naam` — de contactpersoon uit de aanvraag.
 * @param bedrijfsnaam `leads.bedrijfsnaam`, alleen als vangnet: is de hele
 *                     contactpersoon niets anders dan de bedrijfsnaam, dan is
 *                     er geen voornaam bekend.
 */
export function voornaamUitAanvraag(
  naam: string | null | undefined,
  bedrijfsnaam?: string | null,
): string | undefined {
  const volledig = (naam ?? "").trim();
  if (!volledig) return undefined;

  const woorden = volledig
    .split(/\s+/)
    .map((w) => w.replace(/^[("'«]+|[)"'»,;:]+$/g, ""))
    .filter(Boolean)
    .filter((w) => !SYMBOOL.test(w))
    .filter((w) => !INITIAAL.test(w))
    .filter((w) => !BEDRIJFSWOORDEN.has(w.toLowerCase()));

  if (woorden.length === 0) return undefined;

  // Iemands eigen naam krijgt een hoofdletter; de omschrijving ervoor niet.
  // Is er geen enkel woord met hoofdletter, dan is het eerste woord het beste
  // wat we hebben (iemand die alles klein typt, heet nog steeds zo).
  const gekozen = woorden.find((w) => /^[A-ZÀ-Þ]/.test(w)) ?? woorden[0];

  // Staat er in het contactveld alleen de bedrijfsnaam? Dan is de voornaam
  // niet bekend — liever "Hoi," dan iemand aanspreken met zijn eigen bedrijf.
  const bedrijf = (bedrijfsnaam ?? "").trim().toLowerCase();
  if (bedrijf && gekozen.toLowerCase() === bedrijf) return undefined;

  return netjes(gekozen);
}

/**
 * "pieke" wordt "Pieke" en "MARJON" wordt "Marjon"; geschreven vormen als
 * "McDonald" of "Jan-Willem" blijven staan zoals iemand ze zelf schrijft.
 */
function netjes(woord: string): string {
  const kaal = woord.replace(/[.]+$/, "") || woord;
  const heeftKleineLetter = /[a-zà-ÿ]/.test(kaal);
  const heeftHoofdletter = /[A-ZÀ-Þ]/.test(kaal);
  if (!heeftKleineLetter || !heeftHoofdletter) {
    return kaal.charAt(0).toUpperCase() + kaal.slice(1).toLowerCase();
  }
  return kaal;
}
