/**
 * De juridische entiteit achter DogWare — de enige bron van waarheid.
 *
 * DogWare is het merk waar de klant mee te maken heeft. De contractpartij en
 * de facturerende partij is OneDaySite: dezelfde gegevens die OneDaySite op
 * zijn eigen facturen voert. Dat onderscheid is bewust:
 *
 *   - de klant ziet DogWare (mail, portaal, voorstel, voortgang);
 *   - de overeenkomst, de factuurregel en de juridische footer noemen
 *     OneDaySite, omdat dáár de verplichting ligt.
 *
 * Zet nooit een tweede entiteitsdefinitie elders in de code neer: voorstel,
 * overeenkomst, facturen, klantomgeving en e-mails lezen allemaal hier.
 *
 * Client-safe: geen server-only imports.
 */

export const legalEntity = {
  /** Statutaire/handelsnaam waarmee wordt gecontracteerd en gefactureerd. */
  name: "OneDaySite",
  /** Hoe de entiteit in de overeenkomst wordt aangeduid. */
  contractRole: "Opdrachtnemer",
  address: "Hogeweg 15 H",
  postcode: "3814 CB",
  city: "Amersfoort",
  country: "Nederland",
  email: "info@onedaysite.nl",
  phone: "06-13 97 15 25",
  website: "https://onedaysite.nl",

  /**
   * KvK- en btw-nummer staan bewust leeg.
   *
   * Ze komen in geen van beide codebases voor — ook niet op de OneDaySite-
   * factuur — en zijn niet iets om te reconstrueren of aan te nemen. Vul ze
   * hier in met de echte waarden; alles wat ze nodig heeft (overeenkomst,
   * factuur, voorwaarden) leest dit bestand en toont ze dan automatisch.
   *
   * Zolang ze leeg zijn blokkeert `entityReady()` het definitief versturen
   * van een voorstel niet — een voorstel is nog geen factuur — maar toont de
   * admin wel een duidelijke waarschuwing bij de overeenkomst en de facturen.
   */
  kvk: "",
  btw: "",
  iban: "",
} as const;

/** Adres op één regel, zoals in een factuurkop of contractaanhef. */
export function entityAddressLine(): string {
  return `${legalEntity.address}, ${legalEntity.postcode} ${legalEntity.city}`;
}

/** Adresregels onder elkaar (facturen, PDF, e-mailfooter). */
export function entityAddressLines(): string[] {
  return [
    legalEntity.name,
    legalEntity.address,
    `${legalEntity.postcode} ${legalEntity.city}`,
    legalEntity.email,
    legalEntity.phone,
  ];
}

/**
 * Zijn de gegevens compleet genoeg om een rechtsgeldige factuur te voeren?
 * Een Nederlandse factuur hoort KvK- en btw-nummer te vermelden; ontbreken
 * die, dan mag dat zichtbaar zijn in plaats van stilzwijgend weggelaten.
 */
export function entityReady(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!legalEntity.kvk.trim()) missing.push("KvK-nummer");
  if (!legalEntity.btw.trim()) missing.push("btw-nummer");
  return { ok: missing.length === 0, missing };
}

/**
 * Juridische ondertekst voor voorstel, overeenkomst, facturen en e-mails.
 * Kort en feitelijk: DogWare blijft het merk, OneDaySite de partij.
 */
export function legalFooterLine(): string {
  const ids = [
    legalEntity.kvk && `KvK ${legalEntity.kvk}`,
    legalEntity.btw && `btw ${legalEntity.btw}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `DogWare is een dienst van ${legalEntity.name} · ${entityAddressLine()}${ids ? ` · ${ids}` : ""}`;
}
