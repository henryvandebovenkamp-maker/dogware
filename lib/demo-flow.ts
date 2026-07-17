/**
 * Inhoud van de DogWare demo-experience: keuzes, verhalen en reacties.
 * De experience-componenten lezen uitsluitend uit dit bestand.
 */

export type ServiceKey =
  | "hondenschool"
  | "uitlaatservice"
  | "dagopvang"
  | "pension"
  | "trimsalon"
  | "gedragstherapie"
  | "oppas"
  | "webshop";

export const SERVICES: {
  key: ServiceKey;
  /** Waarde die in de intake/database wordt opgeslagen */
  value: string;
  titel: string;
  verhaal: string;
}[] = [
  {
    key: "hondenschool",
    value: "Hondenschool",
    titel: "Lesgeven",
    verhaal: "Pups die eindelijk loslaten, baasjes die stralen.",
  },
  {
    key: "uitlaatservice",
    value: "Uitlaatservice",
    titel: "Eropuit met de groep",
    verhaal: "Modderpoten, natte neuzen, blije honden.",
  },
  {
    key: "dagopvang",
    value: "Dagopvang",
    titel: "Een dag vol spelen",
    verhaal: "Honden die 's avonds voldaan in de auto stappen.",
  },
  {
    key: "pension",
    value: "Pension",
    titel: "Een tweede thuis",
    verhaal: "Logeergasten die zich meteen thuis voelen.",
  },
  {
    key: "trimsalon",
    value: "Trimsalon",
    titel: "Vachten laten stralen",
    verhaal: "Binnenkomer met klitten, buitenloper om door een ringetje te halen.",
  },
  {
    key: "gedragstherapie",
    value: "Gedragstherapie",
    titel: "Gedrag begrijpen",
    verhaal: "Die ene doorbraak waar een gezin op wachtte.",
  },
  {
    key: "oppas",
    value: "Hondenoppas aan huis",
    titel: "Zorg aan huis",
    verhaal: "Vertrouwde zorg in hun eigen mand.",
  },
  {
    key: "webshop",
    value: "Webshop",
    titel: "Producten verkopen",
    verhaal: "Van riemen tot snacks. Jouw eigen assortiment.",
  },
];

export type DiscoveryKey = "mond" | "website" | "social";

export const DISCOVERY: {
  key: DiscoveryKey;
  /** Mapping naar intake.heeftWebsite */
  heeftWebsite: "nee" | "ja" | "";
  titel: string;
  verhaal: string;
}[] = [
  {
    key: "mond",
    heeftWebsite: "nee",
    titel: "Via via",
    verhaal: "Tevreden klanten vertellen het door. De mooiste reclame die er is.",
  },
  {
    key: "website",
    heeftWebsite: "ja",
    titel: "Via mijn website",
    verhaal: "Mensen vinden me online en nemen contact op.",
  },
  {
    key: "social",
    heeftWebsite: "nee",
    titel: "Via social media",
    verhaal: "Foto's en verhalen van de honden doen het werk.",
  },
];

export type EnergyKey =
  | "planning"
  | "berichten"
  | "facturen"
  | "administratie"
  | "boekingen";

export const ENERGY: {
  key: EnergyKey;
  /** Waarde die in de intake wordt opgeslagen */
  value: string;
  titel: string;
  verhaal: string;
  /** Wat DogWare ervan maakt — komt terug in de preview */
  belofte: string;
}[] = [
  {
    key: "planning",
    value: "Planning",
    titel: "Puzzelen met de planning",
    verhaal: "Schuiven, mailen, nog eens schuiven.",
    belofte: "Planning vult zichzelf",
  },
  {
    key: "berichten",
    value: "Klanten beantwoorden",
    titel: "Appjes en mailtjes",
    verhaal: "'Is er nog plek?' Voor de tiende keer vandaag.",
    belofte: "Klanten boeken zelf",
  },
  {
    key: "facturen",
    value: "Facturen",
    titel: "Facturen maken",
    verhaal: "Avondwerk dat niemand ziet.",
    belofte: "Facturen versturen zichzelf",
  },
  {
    key: "administratie",
    value: "Administratie",
    titel: "Losse lijstjes",
    verhaal: "Excel hier, schriftje daar, hoofd vol.",
    belofte: "Alles op één plek",
  },
  {
    key: "boekingen",
    value: "Boekingen",
    titel: "Boekingen bijhouden",
    verhaal: "Wie komt wanneer, en is er al betaald?",
    belofte: "Boeking, betaling en bevestiging in één",
  },
];

export type ModuleKey =
  | "boeken"
  | "portaal"
  | "betalen"
  | "personeel"
  | "strippenkaart"
  | "nieuwsbrief";

export const MODULES: {
  key: ModuleKey;
  /** Waarde die in de intake wordt opgeslagen */
  value: string;
  titel: string;
  verhaal: string;
}[] = [
  {
    key: "boeken",
    value: "Online boeken",
    titel: "Online boeken",
    verhaal: "Klanten kiezen zelf een plekje, ook 's avonds laat.",
  },
  {
    key: "portaal",
    value: "Klantportaal",
    titel: "Klantportaal",
    verhaal: "Elk baasje z'n eigen plek met alles op een rij.",
  },
  {
    key: "betalen",
    value: "Betalen",
    titel: "Direct betalen",
    verhaal: "iDEAL bij de boeking. Nooit meer achteraan bellen.",
  },
  {
    key: "personeel",
    value: "Personeelsportaal",
    titel: "Team & rooster",
    verhaal: "Iedereen weet wat er vandaag op de planning staat.",
  },
  {
    key: "strippenkaart",
    value: "Strippenkaarten",
    titel: "Strippenkaarten",
    verhaal: "Tellen zichzelf af. Klant ziet precies wat er over is.",
  },
  {
    key: "nieuwsbrief",
    value: "Nieuwsbrieven",
    titel: "Nieuwsbrieven",
    verhaal: "Eén bericht en iedereen weet van de zomerstop.",
  },
];

/** Menselijke reacties van DogWare tijdens de experience. */
export const REACTIONS = {
  naam: "Mooie naam. Die zetten we meteen boven jouw omgeving.",
  dienstenEen: "Leuk. Daar laat ik je straks iets moois voor zien.",
  dienstenMeer: "Mooi bedrijf. Dit gaan we straks allemaal samenbrengen.",
  websiteJa: "Fijn, dan bouwen we verder op wat er al staat.",
  websiteNee: "Dan bouwen we een thuisbasis die dit werk vanzelf doet.",
  energie: "Dat hoor ik vaker. Hier gaan we je veel tijd besparen.",
  modules: "Goeie keuzes. Kijk eens rechts, het begint al ergens op te lijken.",
  droom: "Hou dat gevoel vast. Daar bouwen we naartoe.",
} as const;
