/**
 * De publieke prijscommunicatie van DogWare — de enige bron van waarheid.
 *
 * Homepage, /tarieven, de landingspagina's, de demo-aanvraag en de
 * structured data lezen allemaal hieruit. Zo kan er nergens een ander bedrag
 * of een andere belofte blijven staan.
 *
 * Bewust NIET hierin:
 *   - een maandprijs: die hangt af van de diensten die een bedrijf gebruikt en
 *     staat pas in het persoonlijke voorstel;
 *   - pakketten, kortingen, opstartkosten of andere bedragen;
 *   - termijnbedragen: de betaalafspraak wordt persoonlijk gemaakt.
 *
 * Client-safe: alleen data.
 */

/** Wat het bouwen en inrichten van een compleet DogWare-platform kost. */
export const PLATFORM_PRIJS = {
  /** Voor structured data (schema.org Offer). */
  bedrag: 2500,
  valuta: "EUR",
  /** Zoals het op de site staat. */
  label: "€ 2.500",
} as const;

/** Maximaal aantal termijnen dat we publiek toezeggen. */
export const MAX_TERMIJNEN_PUBLIEK = 6;

/**
 * Wat er in de € 2.500 zit. Alleen onderdelen die de site en het platform
 * vandaag al leveren; welke precies aan gaan, stemmen we af op de diensten
 * van het bedrijf.
 */
export const INBEGREPEN = [
  { titel: "Professionele website", tekst: "Een eigen website die past bij jouw bedrijf en je aanbod." },
  { titel: "Eigen DogWare-omgeving", tekst: "Eén plek waar alles van je bedrijf samenkomt." },
  { titel: "Ingericht voor jouw diensten", tekst: "Afgestemd op hoe jij werkt: lessen, afspraken, routes of verblijven." },
  { titel: "Klanten en honden", tekst: "Elke klant en elke hond één keer vastgelegd, met complete historie." },
  { titel: "Planning en boekingen", tekst: "Klanten boeken en schrijven zelf online in, jij houdt overzicht." },
  { titel: "Betalingen en facturatie", tekst: "Online betalen met iDEAL en facturen die zichzelf maken." },
  { titel: "Klantportaal", tekst: "Je klanten regelen hun zaken zelf, zonder heen-en-weer appen." },
  { titel: "Automatische berichten", tekst: "Bevestigingen, herinneringen en bedankjes gaan vanzelf." },
] as const;

/** Wat er in de maandelijkse kosten zit — dezelfde woorden als in de klantomgeving. */
export const MAANDKOSTEN_DEKKEN = "hosting, onderhoud, beveiligingsupdates en persoonlijke ondersteuning";

/** Eén alinea voor secundaire pagina's. */
export const PRIJS_KORT = `Een compleet DogWare-platform bouwen en richten we voor je in voor ${PLATFORM_PRIJS.label}. Betalen kan in overleg in maximaal ${MAX_TERMIJNEN_PUBLIEK} termijnen. De maandelijkse kosten hangen af van de diensten die je gebruikt en staan vooraf in je persoonlijke voorstel.`;

export const TARIEVEN_FAQ = [
  {
    v: "Wat kost DogWare?",
    a: `Het bouwen en inrichten van een compleet DogWare-platform, inclusief je website, kost ${PLATFORM_PRIJS.label}. Daarnaast zijn er maandelijkse kosten voor het gebruik en beheer, afhankelijk van de diensten die je gebruikt.`,
  },
  {
    v: `Moet ik ${PLATFORM_PRIJS.label} in één keer betalen?`,
    a: `Nee. In overleg verdelen we de investering over maximaal ${MAX_TERMIJNEN_PUBLIEK} termijnen. Die afspraak maken we persoonlijk met je en staat in je voorstel.`,
  },
  {
    v: "Zijn er maandelijkse kosten?",
    a: `Ja. Daarin zitten ${MAANDKOSTEN_DEKKEN}. Hoe hoog ze zijn, hangt af van de diensten en onderdelen van DogWare die jouw bedrijf gebruikt. Je ziet het exacte bedrag vooraf in je persoonlijke voorstel.`,
  },
  {
    v: "Waarom staat er geen vast maandbedrag op de site?",
    a: "Omdat niet ieder hondenbedrijf dezelfde onderdelen gebruikt. Een hondenschool heeft andere dingen nodig dan een trimsalon of een hondenpension. We spreken liever vooraf een passend en helder bedrag af dan dat we een standaardprijs publiceren die voor jou niet klopt.",
  },
  {
    v: "Wanneer weet ik precies wat ik ga betalen?",
    a: "Voordat je iets tekent. In je persoonlijke voorstel staan de eenmalige investering, de betaalafspraak en de maandelijkse kosten zwart op wit. Pas als alles klopt, gaan we aan de slag.",
  },
];
