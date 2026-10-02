/**
 * De publieke prijscommunicatie van DogWare — de enige bron van waarheid.
 *
 * Homepage, /tarieven, de landingspagina's, de demo-aanvraag en de
 * structured data lezen allemaal hieruit. Zo kan er nergens een ander bedrag
 * of een andere belofte blijven staan.
 *
 * Het publieke bedrag is een VANAFprijs: een professionele website. Alles wat
 * daarbovenop komt (boeken, betalen, klantomgeving, branchemodules, maatwerk)
 * stellen we per bedrijf samen; wat dat kost staat in het persoonlijke
 * voorstel. Dat voorstel heeft altijd zijn eigen bedrag en leest hier niets
 * uit — deze module raakt geen enkele lopende afspraak of betaling.
 *
 * Bewust NIET hierin:
 *   - een maandprijs: die hangt af van de diensten die een bedrijf gebruikt en
 *     staat pas in het persoonlijke voorstel;
 *   - pakketten (Basic/Pro/…), kortingen of prijzen per uitbreiding: DogWare
 *     is modulair en wordt per bedrijf samengesteld;
 *   - termijnbedragen: de betaalafspraak wordt persoonlijk gemaakt.
 *
 * Client-safe: alleen data.
 */

/** Waar je bij DogWare mee begint: een professionele website. */
export const VANAF_PRIJS = {
  /** Voor structured data (schema.org AggregateOffer.lowPrice). */
  bedrag: 599,
  valuta: "EUR",
  /** Zoals het op de site staat, zonder "vanaf" — dat zet de plek er zelf bij. */
  label: "€ 599",
} as const;

/** De kernzin, voor koppen en metadata. */
export const VANAF_ZIN = `Een professionele website voor jouw hondenbedrijf vanaf ${VANAF_PRIJS.label}`;

/** Maximaal aantal termijnen dat we publiek toezeggen. */
export const MAX_TERMIJNEN_PUBLIEK = 6;

/**
 * Wat er in de vanafprijs zit: een professionele website, en niets wat
 * suggereert dat het hele platform erbij hoort.
 */
export const WEBSITE_BASIS = [
  { titel: "Een website in jouw stijl", tekst: "Professioneel ontworpen, passend bij jouw bedrijf en je aanbod." },
  { titel: "Je aanbod helder online", tekst: "Je diensten, je verhaal en je werkgebied overzichtelijk op een rij." },
  { titel: "Goed op elke telefoon", tekst: "Je klanten zoeken je op hun mobiel. Daar ziet het er net zo goed uit." },
  { titel: "Makkelijk contact", tekst: "Bellen, mailen of appen met één tik, vanaf elke pagina." },
] as const;

/**
 * Waarmee DogWare kan meegroeien. Geen prijslijst: welke onderdelen je kiest,
 * bepaalt de uiteindelijke investering en staat in je persoonlijke voorstel.
 */
export const UITBREIDINGEN = [
  "Online aanvragen en reserveren",
  "Planning en agenda",
  "Klantomgeving",
  "Online betalen",
  "Facturatie",
  "Automatische e-mails",
  "Abonnementen en strippenkaarten",
  "Modules voor jouw branche",
  "Maatwerk",
] as const;

/** Wat er in de maandelijkse kosten zit — dezelfde woorden als in de klantomgeving. */
export const MAANDKOSTEN_DEKKEN = "hosting, onderhoud, beveiligingsupdates en persoonlijke ondersteuning";

/** Eén alinea voor secundaire pagina's. */
export const PRIJS_KORT = `Een professionele website maken we vanaf ${VANAF_PRIJS.label}. Wil je ook online boeken, betalen of een klantomgeving? Dan stellen we DogWare samen op basis van wat jouw bedrijf nodig heeft, en zie je vooraf in je persoonlijke voorstel wat dat kost.`;

/**
 * De vanafprijs als schema.org-aanbod. Een AggregateOffer met alleen een
 * ondergrens: een vaste `price` zou zeggen dat het altijd dit bedrag is.
 */
export function vanafAanbod(url: string) {
  return {
    "@type": "AggregateOffer",
    lowPrice: VANAF_PRIJS.bedrag,
    priceCurrency: VANAF_PRIJS.valuta,
    description: `${VANAF_ZIN}. Uit te breiden met onder meer online boeken, betalingen en een klantomgeving.`,
    availability: "https://schema.org/InStock",
    url,
  };
}

export const TARIEVEN_FAQ = [
  {
    v: "Wat kost DogWare?",
    a: `Een professionele website maken we vanaf ${VANAF_PRIJS.label}. Wil je meer, zoals online boeken, betalingen, een klantomgeving of planning, dan stellen we DogWare samen op basis van wat jouw bedrijf nodig heeft. Wat je kiest, bepaalt de investering. Je ziet het exacte bedrag vooraf in je persoonlijke voorstel.`,
  },
  {
    v: `Wat krijg ik voor ${VANAF_PRIJS.label}?`,
    a: "Een professionele website in jouw stijl, met je aanbod en je verhaal helder op een rij, die goed werkt op elke telefoon en waarop klanten je makkelijk bereiken. Een stevige basis om goed online te starten.",
  },
  {
    v: "Wanneer wordt het meer?",
    a: "Zodra je website meer gaat doen dan laten zien wie je bent. Denk aan online aanvragen of reserveren, een planning, een klantomgeving, online betalen en facturatie, automatische e-mails, abonnementen of modules die speciaal bij jouw branche horen. Die onderdelen kies je zelf, en je kunt er ook later mee beginnen.",
  },
  {
    v: "Moet ik de investering in één keer betalen?",
    a: `Niet per se. Kies je voor een uitgebreidere oplossing, dan verdelen we de investering in overleg over maximaal ${MAX_TERMIJNEN_PUBLIEK} termijnen. Die afspraak maken we persoonlijk met je en staat in je voorstel.`,
  },
  {
    v: "Zijn er maandelijkse kosten?",
    a: `Ja. Daarin zitten ${MAANDKOSTEN_DEKKEN}. Hoe hoog ze zijn, hangt af van de onderdelen van DogWare die jouw bedrijf gebruikt. Je ziet het exacte bedrag vooraf in je persoonlijke voorstel.`,
  },
  {
    v: "Waarom geen vaste pakketten?",
    a: "Omdat niet ieder hondenbedrijf dezelfde dingen nodig heeft. Een hondenschool werkt anders dan een trimsalon of een hondenpension, en in een standaardpakket betaal je al snel voor wat je niet gebruikt. Bij DogWare begin je bij wat je nodig hebt, en groeit het mee met je bedrijf.",
  },
  {
    v: "Wanneer weet ik precies wat ik ga betalen?",
    a: "Voordat je iets tekent. In je persoonlijke voorstel staan de investering, de betaalafspraak en de maandelijkse kosten zwart op wit. Pas als alles klopt, gaan we aan de slag.",
  },
];
