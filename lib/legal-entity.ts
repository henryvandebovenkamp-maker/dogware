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
   * KvK- en btw-nummer van de facturerende partij.
   *
   * Alles wat ze nodig heeft — factuur, overeenkomst, voorwaarden, de footer
   * onder de commerciële mails — leest ze hier. Zet ze nergens anders nog een
   * keer neer: twee plekken betekent vroeg of laat twee verschillende nummers
   * op twee documenten.
   *
   * Let op bij wijzigen: facturen die al zijn uitgegeven leggen deze gegevens
   * bevroren vast in hun eigen momentopname (zie lib/documents.ts). Een
   * wijziging hier werkt dus NIET met terugwerkende kracht door in bestaande
   * facturen, en dat hoort ook zo.
   */
  kvk: "92105815",
  btw: "NL004936558B58",

  /**
   * Nog leeg. Zodra dit is ingevuld, toont een openstaande factuur het
   * rekeningnummer waarop overgemaakt kan worden. Betaalde facturen hebben het
   * niet nodig — daar is al betaald — dus zolang alles via Mollie loopt, valt
   * het ontbreken niet op.
   */
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
