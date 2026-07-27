/**
 * De branches waarvoor DogWare gebouwd is — de enige bron van waarheid.
 *
 * Dit bestand voedt tegelijk:
 *  - de branchekiezer op de homepage (dynamisch, zonder herladen)
 *  - de secties die meebewegen (hero, problem, solution, results, modules, cta)
 *  - de branchespecifieke SEO-landingspagina's (/hondenschool-software, …)
 *  - de sitemap, de footer en de demoflow
 *
 * Client-safe: geen server-only imports, geen fs. Iconen komen uit lucide-react
 * zodat zowel server- als clientcomponenten hieruit kunnen lezen.
 */

import {
  Activity,
  BadgeCheck,
  Bell,
  Brain,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Car,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  Footprints,
  Globe,
  GraduationCap,
  HandHeart,
  Heart,
  Home,
  Hotel,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Package,
  PawPrint,
  PhoneCall,
  Receipt,
  RefreshCw,
  ScanLine,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Sparkles,
  Star,
  Table2,
  Truck,
  UserPlus,
  Users,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ServiceKey } from "@/lib/demo-flow";

export type BrancheSlug =
  | "hondenschool"
  | "trimsalon"
  | "uitlaatservice"
  | "dagopvang"
  | "pension"
  | "gedragstherapie"
  | "dierenverzorging"
  | "chipservice"
  | "webshop";

export type Branche = {
  slug: BrancheSlug;
  /** URL van de landingspagina, bijv. "/trimsalon-software" */
  path: string;
  /** Enkelvoud met hoofdletter: "Trimsalon" */
  naam: string;
  /** Enkelvoud klein, ná "jouw": "trimsalon" */
  naamKlein: string;
  /** Meervoud klein: "trimsalons" */
  meervoud: string;
  /** Korte typering onder de naam op de keuzekaart */
  kaartTekst: string;
  icon: LucideIcon;
  /** Bestandsnaam in /public/photos — toont een placeholder zolang hij ontbreekt */
  photo: string;
  photoLabel: string;
  /** Koppeling naar de dienst in de demoflow, zodat de CTA de demo voorvult */
  demoService: ServiceKey | null;

  hero: {
    /** Losse delen zodat het accentwoord (met onderstreping) de branche is */
    kopVoor: string;
    kopAccent: string;
    kopNa: string;
    sub: string;
    /** De functiechips onder de hero */
    chips: string[];
    /** Tekst op de zwevende notificatiekaart in de hero-visual */
    notificatie: { titel: string; tekst: string };
  };

  /** De planning in het dashboardvoorbeeld — herkenbaar voor deze branche */
  dashboard: {
    /** Naam in de begroeting van het dashboard */
    naam: string;
    agenda: {
      time: string;
      title: string;
      who: string;
      tone: "brand" | "sage" | "gold" | "ink";
    }[];
  };

  problem: {
    titel: string;
    intro: string;
    items: { icon: LucideIcon; text: string }[];
    /** Vetgedrukte afsluiter onder het rijtje */
    conclusie: string;
    conclusieAccent: string;
  };

  solution: {
    titel: string;
    intro: string;
    flow: { icon: LucideIcon; label: string }[];
  };

  results: { icon: LucideIcon; titel: string; tekst: string }[];

  /** Wat DogWare voor deze branche doet — gebruikt in de modules-tab én op de landingspagina */
  moduleTitel: string;
  moduleDesc: string;
  features: string[];

  testimonial: {
    quote: string;
    name: string;
    role: string;
    emoji: string;
    photo: string;
  };

  cta: {
    /** "Bekijk een voorbeeld van een trimsalon" */
    voorbeeld: string;
    /** Regel onder de CTA op de landingspagina */
    belofte: string;
  };

  seo: {
    title: string;
    description: string;
    keywords: string[];
  };

  faq: { v: string; a: string }[];
};

export const BRANCHES: Branche[] = [
  // ─────────────────────────────────────────────────────────── hondenschool ──
  {
    slug: "hondenschool",
    path: "/hondenschool-software",
    naam: "Hondenschool",
    naamKlein: "hondenschool",
    meervoud: "hondenscholen",
    kaartTekst: "Cursussen, inschrijvingen en lesplanning",
    icon: GraduationCap,
    photo: "branche-hondenschool.jpg",
    photoLabel: "Puppycursus op het trainingsveld",
    demoService: "hondenschool",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "hondenschool",
      kopNa: "nodig heeft.",
      sub: "Inschrijvingen, wachtlijsten, lesplanning, huiswerk en facturen in één omgeving. Cursisten schrijven zichzelf in en betalen meteen. Jij staat op het veld, niet achter je laptop.",
      chips: [
        "Online inschrijven",
        "Cursusbeheer",
        "Wachtlijsten",
        "Lesplanning",
        "Huiswerk delen",
        "Klantportaal",
        "Facturen",
        "iDEAL",
      ],
      notificatie: {
        titel: "Nieuwe inschrijving",
        tekst: "Puppycursus · automatisch verwerkt",
      },
    },
    dashboard: {
      naam: "Sanne",
      agenda: [
        { time: "09:00", title: "Puppycursus — groep A", who: "6 honden · Buitenterrein", tone: "brand" },
        { time: "10:30", title: "Basiscursus — groep C", who: "8 honden · Les 4 van 8", tone: "sage" },
        { time: "13:00", title: "Privéles — Bo", who: "Loslopen · Familie de Vries", tone: "gold" },
        { time: "19:00", title: "Gevorderden — groep B", who: "7 honden · Binnenhal", tone: "ink" },
      ],
    },
    problem: {
      titel: "Een cursus vol krijgen kost je meer avonden dan lesgeven.",
      intro:
        "Aanmeldingen komen binnen via de mail, de wachtlijst staat in een schriftje en wie er betaald heeft weet je pas als je de bank opent. Elke nieuwe cursus begint met hetzelfde uitzoekwerk.",
      items: [
        { icon: Mail, text: "Aanmeldingen die los in je inbox belanden" },
        { icon: Table2, text: "Een cursuslijst in Excel die nooit klopt" },
        { icon: ClipboardList, text: "Een wachtlijst op papier" },
        { icon: CalendarX, text: "Lestijden die je handmatig doorgeeft" },
        { icon: FileText, text: "Facturen die je 's avonds nog moet maken" },
        { icon: MessageCircle, text: "Huiswerk dat je per WhatsApp verstuurt" },
      ],
      conclusie: "Je bent hondentrainer geworden, geen administrateur.",
      conclusieAccent: "Toch gaat je avond eraan op.",
    },
    solution: {
      titel: "Van eerste aanmelding tot laatste les. Vanzelf.",
      intro:
        "Een cursist vindt je cursus, schrijft zich in, betaalt en krijgt automatisch alle lesinformatie. Jij ziet alleen een volle groep.",
      flow: [
        { icon: UserPlus, label: "Nieuwe cursist" },
        { icon: Globe, label: "Cursuspagina" },
        { icon: CalendarCheck, label: "Inschrijving" },
        { icon: CreditCard, label: "iDEAL-betaling" },
        { icon: CalendarDays, label: "Lesplanning" },
        { icon: Mail, label: "Lesherinnering" },
        { icon: LayoutDashboard, label: "Huiswerk in portaal" },
        { icon: BadgeCheck, label: "Diploma" },
        { icon: CalendarPlus, label: "Vervolgcursus" },
      ],
    },
    results: [
      { icon: Users, titel: "Vollere groepen", tekst: "Wachtlijsten schuiven automatisch door bij een afmelding." },
      { icon: Clock, titel: "Geen avondadministratie", tekst: "Inschrijving, betaling en bevestiging gaan in één beweging." },
      { icon: LayoutGrid, titel: "Elke cursist compleet", tekst: "Hond, vorderingen, aanwezigheid en facturen op één plek." },
      { icon: RefreshCw, titel: "Meer vervolgcursussen", tekst: "Cursisten zien zelf wat de logische volgende stap is." },
      { icon: Heart, titel: "Meer tijd op het veld", tekst: "Waar je het uiteindelijk allemaal voor doet." },
    ],
    moduleTitel: "Van inschrijving tot diploma.",
    moduleDesc:
      "Je cursusadministratie houdt zichzelf bij, van de eerste aanmelding tot de laatste les.",
    features: [
      "Online inschrijven",
      "Wachtlijsten",
      "Cursusbeheer",
      "Agenda & lesplanning",
      "Automatische e-mails",
      "Huiswerk delen",
      "Aanwezigheid bijhouden",
      "Eigen klantomgeving",
      "Automatische facturatie",
      "Strippenkaarten",
    ],
    testimonial: {
      quote:
        "Voor het eerst heb ik het gevoel dat alles samenwerkt. Geen losse lijstjes meer.",
      name: "Sanne Bakker",
      role: "Hondenschool De Vrije Loop",
      emoji: "🐕",
      photo: "testimonial-sanne.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een hondenschool",
      belofte:
        "Binnen 24 uur zie je jouw eigen cursusaanbod, inschrijfformulier en klantportaal live staan.",
    },
    seo: {
      title: "Software voor je hondenschool — inschrijvingen, planning en facturen",
      description:
        "Complete software voor hondenscholen: online inschrijven, wachtlijsten, cursusbeheer, lesplanning, klantenportaal en automatische facturatie. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software hondenschool",
        "hondenschool software",
        "cursusadministratie hondenschool",
        "klantenportaal hondenschool",
        "inschrijfsysteem hondenschool",
        "planning hondenschool",
        "website hondenschool",
      ],
    },
    faq: [
      {
        v: "Kunnen cursisten zichzelf online inschrijven?",
        a: "Ja. Je zet je cursussen klaar met data, tijden en aantal plekken. Cursisten kiezen zelf een groep, vullen de gegevens van hun hond in en betalen direct met iDEAL. De plek is dan meteen bezet.",
      },
      {
        v: "Werkt DogWare ook met wachtlijsten?",
        a: "Ja. Zit een groep vol, dan komt een aanmelding automatisch op de wachtlijst. Meldt iemand zich af, dan krijgt de eerste op de lijst bericht dat er plek is.",
      },
      {
        v: "Kan ik huiswerk en lesmateriaal delen?",
        a: "Elke cursist heeft een eigen klantomgeving. Daar zet je per les het huiswerk, filmpjes en documenten neer. Ze hebben het altijd bij de hand, zonder dat jij het per app hoeft te sturen.",
      },
      {
        v: "Kan ik meerdere trainers laten meewerken?",
        a: "Ja. Trainers krijgen een eigen inlog en zien alleen hun eigen lessen en groepen. Handig als je met een vast team of met invallers werkt.",
      },
      {
        v: "Moet ik mijn huidige website weggooien?",
        a: "Nee. DogWare bouwt je website mee in het platform, zodat inschrijven, betalen en het klantportaal echt op elkaar aansluiten. Bestaande teksten en foto's nemen we gewoon mee.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────── trimsalon ──
  {
    slug: "trimsalon",
    path: "/trimsalon-software",
    naam: "Trimsalon",
    naamKlein: "trimsalon",
    meervoud: "trimsalons",
    kaartTekst: "Online afspraken, herinneringen en behandelhistorie",
    icon: Scissors,
    photo: "branche-trimsalon.jpg",
    photoLabel: "Hond op de trimtafel",
    demoService: "trimsalon",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "trimsalon",
      kopNa: "nodig heeft.",
      sub: "Klanten boeken zelf een plekje in je agenda, ook 's avonds om elf uur. Herinneringen gaan automatisch, de factuur staat er al. Jij houdt je handen vrij voor de honden.",
      chips: [
        "Online afspraken",
        "Eigen agenda",
        "Automatische herinneringen",
        "Behandelhistorie",
        "Vachtnotities",
        "Klantportaal",
        "Facturen",
        "iDEAL",
      ],
      notificatie: {
        titel: "Nieuwe afspraak",
        tekst: "Trimbeurt vrijdag 10:30 · bevestigd",
      },
    },
    dashboard: {
      naam: "Linda",
      agenda: [
        { time: "09:00", title: "Trimbeurt — Luna", who: "Knippen & wassen · 90 min", tone: "brand" },
        { time: "10:30", title: "Puppyknipbeurt — Nova", who: "Eerste keer · rustig opbouwen", tone: "sage" },
        { time: "13:00", title: "Ontwollen — Bear", who: "Dubbele vacht · 120 min", tone: "gold" },
        { time: "15:30", title: "Nagels & oren — Tygo", who: "Korte behandeling", tone: "ink" },
      ],
    },
    problem: {
      titel: "Je handen zitten in een vacht. En de telefoon gaat.",
      intro:
        "Elke afspraak begint met heen-en-weer appen over een datum. Het afsprakenboek ligt vooraan, de klantgegevens staan achterin, en no-shows kosten je zomaar een halve dag.",
      items: [
        { icon: PhoneCall, text: "Bellen tijdens het trimmen" },
        { icon: MessageCircle, text: "Appjes over vrije plekken" },
        { icon: CalendarX, text: "Een papieren afsprakenboek" },
        { icon: Bell, text: "No-shows omdat niemand eraan dacht" },
        { icon: Table2, text: "Vachtnotities op losse briefjes" },
        { icon: FileText, text: "Facturen die je later nog moet maken" },
      ],
      conclusie: "Elke onderbreking kost je concentratie én tijd.",
      conclusieAccent: "En de hond op tafel wacht.",
    },
    solution: {
      titel: "Van online boeking tot betaalde factuur. Zonder telefoon.",
      intro:
        "Een klant kiest zelf een moment dat past, krijgt automatisch een herinnering en rekent direct af. Jij trimt gewoon door.",
      flow: [
        { icon: UserPlus, label: "Nieuwe klant" },
        { icon: Globe, label: "Jouw website" },
        { icon: CalendarCheck, label: "Online boeking" },
        { icon: Bell, label: "Herinnering" },
        { icon: Scissors, label: "Trimbeurt" },
        { icon: ClipboardList, label: "Vachtnotitie" },
        { icon: Receipt, label: "Factuur" },
        { icon: CreditCard, label: "iDEAL-betaling" },
        { icon: CalendarPlus, label: "Volgende afspraak" },
      ],
    },
    results: [
      { icon: PhoneCall, titel: "Veel minder telefoontjes", tekst: "Klanten boeken zelf, op het moment dat het hún uitkomt." },
      { icon: Bell, titel: "Bijna geen no-shows", tekst: "Automatische herinneringen per e-mail, ruim op tijd." },
      { icon: ClipboardList, titel: "Elke vacht gedocumenteerd", tekst: "Vorige behandeling, wensen en bijzonderheden staan klaar." },
      { icon: RefreshCw, titel: "Vaste klanten komen terug", tekst: "Na de beurt meteen een vervolgafspraak voorstellen." },
      { icon: Clock, titel: "Een vollere agenda", tekst: "Geen gaten meer door heen-en-weer geappte data." },
    ],
    moduleTitel: "Minder telefoontjes. Meer behandelingen.",
    moduleDesc:
      "Laat klanten zelf online boeken en stuur automatisch herinneringen. Jij houdt je handen vrij voor de honden.",
    features: [
      "Online afspraken",
      "Eigen agenda & openingstijden",
      "Automatische herinneringen",
      "Behandelhistorie per hond",
      "Vacht- en gedragsnotities",
      "Klantbeheer",
      "Facturen",
      "iDEAL-betalingen",
      "Klantportaal",
      "Strippenkaarten",
    ],
    testimonial: {
      quote:
        "Mijn klanten ervaren meer rust en professionaliteit. Dat zie ik echt terug.",
      name: "Linda Vermeer",
      role: "Trimsalon Pluis & Poot",
      emoji: "✂️",
      photo: "testimonial-linda.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een trimsalon",
      belofte:
        "Binnen 24 uur zie je jouw eigen behandelingen, prijzen en online agenda live staan.",
    },
    seo: {
      title: "Software voor je trimsalon — online afspraken en klantbeheer",
      description:
        "Trimsalon software waarmee klanten zelf online afspraken maken. Automatische herinneringen, behandelhistorie, facturatie en iDEAL. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software trimsalon",
        "trimsalon software",
        "afspraken trimsalon",
        "online afspraken trimsalon",
        "afsprakensysteem trimsalon",
        "klantenbeheer trimsalon",
        "website trimsalon",
      ],
    },
    faq: [
      {
        v: "Kunnen klanten zelf een afspraak inplannen?",
        a: "Ja. Je geeft aan welke behandelingen je doet, hoe lang ze duren en wanneer je open bent. Klanten zien alleen de momenten die écht kunnen en boeken zelf. Dubbele boekingen zijn onmogelijk.",
      },
      {
        v: "Kan ik verschillende duur en prijs per hond instellen?",
        a: "Zeker. Een puppy-knipbeurt is iets anders dan een dubbelvachtige herdershond. Je stelt per behandeling en per vachttype een eigen duur en prijs in.",
      },
      {
        v: "Krijgen klanten automatisch een herinnering?",
        a: "Ja, een bevestiging direct bij het boeken en een herinnering ruim voor de afspraak. Je bepaalt zelf hoeveel dagen van tevoren.",
      },
      {
        v: "Kan ik zien wat ik de vorige keer gedaan heb?",
        a: "Bij elke hond staat de volledige behandelhistorie: welke coupe, welke producten, hoe de hond reageerde en waar je op moet letten. Ook handig als een collega invalt.",
      },
      {
        v: "Kan ik ook producten verkopen?",
        a: "Ja. Met de webshopmodule verkoop je shampoo, borstels of snacks. Klanten kunnen bestellen bij het boeken en in één keer afrekenen.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── uitlaatservice ──
  {
    slug: "uitlaatservice",
    path: "/uitlaatservice-software",
    naam: "Uitlaatservice",
    naamKlein: "uitlaatservice",
    meervoud: "uitlaatservices",
    kaartTekst: "Routes, groepen, capaciteit en abonnementen",
    icon: Footprints,
    photo: "branche-uitlaatservice.jpg",
    photoLabel: "Groep honden in het bos",
    demoService: "uitlaatservice",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "uitlaatservice",
      kopNa: "nodig heeft.",
      sub: "Routes, groepen en capaciteit in één overzicht. Klanten geven zelf hun dagen door, abonnementen worden automatisch gefactureerd. Jij bent buiten met de honden.",
      chips: [
        "Routes & ritten",
        "Capaciteit per rit",
        "Hondenprofielen",
        "Vaste dagen",
        "Abonnementen",
        "Afmeldingen",
        "Facturen",
        "Klantportaal",
      ],
      notificatie: {
        titel: "Afmelding verwerkt",
        tekst: "Nova · dinsdagrit · plek vrijgegeven",
      },
    },
    dashboard: {
      naam: "Marco",
      agenda: [
        { time: "08:30", title: "Ochtendrit Noord", who: "5 honden · Route 2", tone: "brand" },
        { time: "11:00", title: "Middagrit Bos", who: "6 honden · vol", tone: "sage" },
        { time: "13:30", title: "Puppyrondje", who: "3 honden · rustige groep", tone: "gold" },
        { time: "15:30", title: "Avondrit Zuid", who: "4 honden · 1 plek vrij", tone: "ink" },
      ],
    },
    problem: {
      titel: "De rit van morgen puzzel je elke avond opnieuw.",
      intro:
        "Wie gaat er mee, wie is afgemeld, welke hond mag niet bij welke, en past dit nog in de bus? Het antwoord staat verspreid over WhatsApp, een schrift en je hoofd.",
      items: [
        { icon: MessageCircle, text: "Afmeldingen die in de groepsapp verdwijnen" },
        { icon: Table2, text: "Een routelijst in Excel" },
        { icon: Car, text: "Capaciteit die je uit je hoofd bijhoudt" },
        { icon: MapPin, text: "Adressen op een los briefje" },
        { icon: FileText, text: "Maandfacturen die je handmatig maakt" },
        { icon: FolderOpen, text: "Sleutelafspraken zonder vaste plek" },
      ],
      conclusie: "Je rijdt de mooiste routes van Nederland.",
      conclusieAccent: "En puzzelt 's avonds nog een uur.",
    },
    solution: {
      titel: "Van aanmelding tot maandfactuur. Volautomatisch.",
      intro:
        "Klanten kiezen hun vaste dagen, meldingen komen binnen bij de juiste rit en de facturatie loopt op de achtergrond mee.",
      flow: [
        { icon: UserPlus, label: "Nieuwe klant" },
        { icon: Globe, label: "Jouw website" },
        { icon: PawPrint, label: "Kennismaking" },
        { icon: CalendarDays, label: "Vaste dagen" },
        { icon: Truck, label: "Rit & route" },
        { icon: Users, label: "Groepsindeling" },
        { icon: Receipt, label: "Maandfactuur" },
        { icon: CreditCard, label: "iDEAL-betaling" },
        { icon: RefreshCw, label: "Volgende maand" },
      ],
    },
    results: [
      { icon: Car, titel: "Nooit een te volle bus", tekst: "Capaciteit per rit is hard begrensd. Vol is vol." },
      { icon: MapPin, titel: "Route in één blik", tekst: "Ophaalvolgorde, adressen en bijzonderheden op je telefoon." },
      { icon: Clock, titel: "Geen avondpuzzel meer", tekst: "Afmeldingen verwerken zichzelf en geven de plek vrij." },
      { icon: Receipt, titel: "Abonnementen die zichzelf innen", tekst: "Elke maand automatisch gefactureerd en geïncasseerd." },
      { icon: ShieldCheck, titel: "Alles vastgelegd", tekst: "Sleutels, chipnummers, dierenarts en toestemmingen." },
    ],
    moduleTitel: "Beheer jouw complete uitlaatservice.",
    moduleDesc:
      "Routes, capaciteit en beschikbaarheid in één overzicht. Volledig geïntegreerd met klanten, honden en facturen.",
    features: [
      "Klantbeheer",
      "Hondenprofielen",
      "Routes & ritten",
      "Capaciteit per rit",
      "Vaste dagen & abonnementen",
      "Afmeldingen en inhaaldagen",
      "Slimme planning",
      "Automatische facturatie",
      "iDEAL & incasso",
      "Personeelsportaal",
    ],
    testimonial: {
      quote:
        "Ik besteed veel minder tijd aan administratie en veel meer aan de honden zelf.",
      name: "Marco de Wit",
      role: "Uitlaatservice Vier Poten",
      emoji: "🦮",
      photo: "testimonial-marco.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een uitlaatservice",
      belofte:
        "Binnen 24 uur zie je jouw eigen ritten, tarieven en aanmeldformulier live staan.",
    },
    seo: {
      title: "Software voor je hondenuitlaatservice — routes, planning en facturatie",
      description:
        "Uitlaatservice software voor routes, groepen, capaciteit en abonnementen. Klanten melden zelf af, facturen gaan automatisch. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software uitlaatservice",
        "uitlaatservice software",
        "planning hondenuitlaatservice",
        "website uitlaatservice",
        "routeplanning hondenuitlaatservice",
        "administratie uitlaatservice",
        "abonnementen uitlaatservice",
      ],
    },
    faq: [
      {
        v: "Kan ik per rit een maximum aantal honden instellen?",
        a: "Ja. Per rit stel je in hoeveel honden er mee kunnen, eventueel per bus of per begeleider. Zit een rit vol, dan kan er niemand meer bij en gaat een aanvraag naar de wachtlijst.",
      },
      {
        v: "Hoe werken vaste dagen en afmeldingen?",
        a: "Klanten kiezen hun vaste dagen bij aanmelding. Kan hun hond een keer niet mee, dan melden ze zelf af in het klantportaal. De plek komt vrij voor iemand anders en jij ziet het direct in de rit van die dag.",
      },
      {
        v: "Kan ik maandelijks automatisch factureren?",
        a: "Ja. Abonnementen en strippenkaarten worden automatisch gefactureerd. Klanten betalen met iDEAL of automatische incasso, zonder dat jij iemand hoeft na te bellen.",
      },
      {
        v: "Kunnen mijn medewerkers de route op hun telefoon zien?",
        a: "Iedere medewerker heeft een eigen inlog en ziet de rit van die dag: ophaalvolgorde, adressen, sleutelafspraken en bijzonderheden per hond.",
      },
      {
        v: "Waar leg ik chipnummer en dierenarts vast?",
        a: "Elke hond heeft een eigen profiel met chipnummer, dierenarts, vaccinaties, medicijnen, gedrag en toestemmingen. Alles bij de hand als er onderweg iets is.",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────── dagopvang ──
  {
    slug: "dagopvang",
    path: "/dagopvang-software",
    naam: "Dagopvang",
    naamKlein: "dagopvang",
    meervoud: "dagopvangen",
    kaartTekst: "Dagplanning, groepen, strippenkaarten en abonnementen",
    icon: Home,
    photo: "branche-dagopvang.jpg",
    photoLabel: "Honden die samen spelen op de opvang",
    demoService: "dagopvang",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "dagopvang",
      kopNa: "nodig heeft.",
      sub: "Weet elke ochtend precies wie er komt. Klanten boeken hun dagen zelf, strippenkaarten tellen zichzelf af en de facturatie loopt vanzelf mee.",
      chips: [
        "Dagplanning",
        "Groepsindeling",
        "Capaciteit per dag",
        "Strippenkaarten",
        "Abonnementen",
        "Haal- & brengtijden",
        "Facturen",
        "Klantportaal",
      ],
      notificatie: {
        titel: "Nieuwe dagboeking",
        tekst: "Woensdag · strippenkaart afgeschreven",
      },
    },
    dashboard: {
      naam: "Esther",
      agenda: [
        { time: "07:30", title: "Brengen — groep Rustig", who: "8 honden · 2 nieuw", tone: "brand" },
        { time: "10:00", title: "Speelronde buitenveld", who: "Groep Actief · 11 honden", tone: "sage" },
        { time: "12:30", title: "Rustuur & voeren", who: "Alle groepen", tone: "gold" },
        { time: "16:30", title: "Ophalen", who: "19 honden · dagverslagen klaar", tone: "ink" },
      ],
    },
    problem: {
      titel: "Hoeveel honden komen er morgen? Even kijken in de app.",
      intro:
        "Boekingen komen per WhatsApp, strippenkaarten hou je bij op papier, en of de groep van morgen past weet je pas als iedereen binnen is.",
      items: [
        { icon: MessageCircle, text: "Dagen die per app doorgegeven worden" },
        { icon: Table2, text: "Strippenkaarten op een papieren lijst" },
        { icon: CalendarX, text: "Geen zicht op de capaciteit van morgen" },
        { icon: Users, text: "Groepsindeling die je elke dag opnieuw maakt" },
        { icon: FileText, text: "Facturen aan het eind van de maand" },
        { icon: FolderOpen, text: "Vaccinatiebewijzen in je mailbox" },
      ],
      conclusie: "De honden hebben de tijd van hun leven.",
      conclusieAccent: "Jij houdt de administratie maar net bij.",
    },
    solution: {
      titel: "Van proefdag tot vaste woensdag. Alles geregeld.",
      intro:
        "Klanten boeken zelf hun dagen binnen de ruimte die er is. Strippenkaart eraf, factuur erbij, groep ingedeeld.",
      flow: [
        { icon: UserPlus, label: "Nieuwe klant" },
        { icon: PawPrint, label: "Proefdag" },
        { icon: CalendarCheck, label: "Dagen boeken" },
        { icon: Users, label: "Groepsindeling" },
        { icon: ClipboardList, label: "Strippenkaart" },
        { icon: Smile, label: "Dagverslag" },
        { icon: Receipt, label: "Factuur" },
        { icon: CreditCard, label: "iDEAL-betaling" },
        { icon: RefreshCw, label: "Volgende week" },
      ],
    },
    results: [
      { icon: LayoutGrid, titel: "Elke ochtend overzicht", tekst: "Wie komt er, in welke groep, en wie haalt wanneer op." },
      { icon: ShieldCheck, titel: "Nooit te vol", tekst: "Per dag en per groep een harde grens die je zelf bepaalt." },
      { icon: ClipboardList, titel: "Strippenkaarten die kloppen", tekst: "Ze tellen zichzelf af en de klant ziet het saldo." },
      { icon: Receipt, titel: "Facturatie zonder werk", tekst: "Losse dagen, kaarten en abonnementen automatisch verwerkt." },
      { icon: Heart, titel: "Blijere baasjes", tekst: "Een dagverslag met foto's maakt hun dag ook goed." },
    ],
    moduleTitel: "Weet elke ochtend precies wie er komt.",
    moduleDesc:
      "Dagplanning, groepen en capaciteit in één beeld. Boekingen, strippenkaarten en facturen regelen zichzelf.",
    features: [
      "Dagplanning & capaciteit",
      "Groepsindeling",
      "Online dagen boeken",
      "Strippenkaarten",
      "Abonnementen",
      "Haal- en brengtijden",
      "Hondenprofielen & vaccinaties",
      "Dagverslagen met foto's",
      "Automatische facturatie",
      "Personeelsportaal",
    ],
    testimonial: {
      quote:
        "Ik weet 's ochtends met één blik wie er komt en wat er die dag moet gebeuren.",
      name: "Esther Kooij",
      role: "Dagopvang Het Speelveld",
      emoji: "🏡",
      photo: "testimonial-esther.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een dagopvang",
      belofte:
        "Binnen 24 uur zie je jouw eigen dagplanning, tarieven en aanmeldformulier live staan.",
    },
    seo: {
      title: "Software voor je hondendagopvang — dagplanning en administratie",
      description:
        "Software voor dierenopvang en hondendagopvang: dagplanning, groepen, capaciteit, strippenkaarten en automatische facturatie. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software dierenopvang",
        "software hondendagopvang",
        "dagopvang honden software",
        "planning hondendagopvang",
        "strippenkaart hondenopvang",
        "administratie dagopvang honden",
        "website hondendagopvang",
      ],
    },
    faq: [
      {
        v: "Kan ik een maximum aantal honden per dag instellen?",
        a: "Ja, per dag en desgewenst per groep. Klanten kunnen alleen boeken zolang er plek is. Zit een dag vol, dan komen ze op de wachtlijst.",
      },
      {
        v: "Werken strippenkaarten automatisch?",
        a: "Elke geboekte dag schrijft een strip af. De klant ziet zijn saldo in het klantportaal en krijgt bericht als de kaart bijna op is. Jij hoeft niets bij te houden.",
      },
      {
        v: "Kan ik vaccinatiebewijzen vastleggen?",
        a: "Ja. Bij elke hond leg je vaccinaties met vervaldatum vast, inclusief het geüploade bewijs. Je ziet vanzelf welke honden binnenkort verlopen.",
      },
      {
        v: "Kan ik dagverslagen naar baasjes sturen?",
        a: "Je maakt per hond of per groep een kort verslag met foto's. De klant vindt het terug in zijn eigen omgeving — een van de meest gewaardeerde onderdelen.",
      },
      {
        v: "Combineer ik dit met pension of uitlaatservice?",
        a: "Ja. Alle modules draaien in dezelfde omgeving met dezelfde klanten en honden. Bied je meerdere diensten aan, dan zie je alles in één agenda en op één factuur.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────── pension ──
  {
    slug: "pension",
    path: "/pension-software",
    naam: "Hondenpension",
    naamKlein: "pension",
    meervoud: "hondenpensions",
    kaartTekst: "Boekingen, kennels, bezetting en aanbetalingen",
    icon: Hotel,
    photo: "branche-pension.jpg",
    photoLabel: "Logeergast in een ruime kennel",
    demoService: "pension",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "pension",
      kopNa: "nodig heeft.",
      sub: "Reserveringen, kennelindeling en bezetting in één kalender. Klanten boeken hun vakantieperiode zelf en betalen meteen een aanbetaling. Nooit meer dubbel geboekt.",
      chips: [
        "Online reserveren",
        "Bezettingskalender",
        "Kennels & verblijven",
        "Aanbetalingen",
        "Voer- en medicatieschema",
        "Haal- & brengtijden",
        "Facturen",
        "Klantportaal",
      ],
      notificatie: {
        titel: "Nieuwe reservering",
        tekst: "Zomervakantie · aanbetaling ontvangen",
      },
    },
    dashboard: {
      naam: "Peter",
      agenda: [
        { time: "09:00", title: "Check-in — Nova", who: "Suite 3 · t/m 28 juni", tone: "brand" },
        { time: "10:30", title: "Check-out — Boris", who: "Eindfactuur automatisch", tone: "sage" },
        { time: "12:00", title: "Medicatieronde", who: "3 logees · voerschema", tone: "gold" },
        { time: "16:00", title: "Check-in — Saar & Mees", who: "Gezinsverblijf · aanbetaald", tone: "ink" },
      ],
    },
    problem: {
      titel: "De zomer is volgeboekt. Denk je.",
      intro:
        "Reserveringen komen per mail en telefoon, de bezetting staat in een kalender aan de muur en of iemand echt komt weet je pas als hij voor de deur staat.",
      items: [
        { icon: PhoneCall, text: "Reserveringen die telefonisch binnenkomen" },
        { icon: CalendarX, text: "Een bezettingskalender aan de muur" },
        { icon: Table2, text: "Kennelindeling in je hoofd" },
        { icon: CreditCard, text: "Geen aanbetaling, dus geen zekerheid" },
        { icon: ClipboardList, text: "Voer- en medicatieschema's op papier" },
        { icon: FileText, text: "Facturen die je pas achteraf maakt" },
      ],
      conclusie: "Eén dubbele boeking in de zomer kost je een weekend.",
      conclusieAccent: "En een klant.",
    },
    solution: {
      titel: "Van reservering tot uitcheck. Zonder dubbele boekingen.",
      intro:
        "Klanten zien exact welke periodes vrij zijn, reserveren zelf en betalen direct aan. De bezetting klopt altijd.",
      flow: [
        { icon: UserPlus, label: "Nieuwe klant" },
        { icon: Globe, label: "Jouw website" },
        { icon: CalendarCheck, label: "Reservering" },
        { icon: CreditCard, label: "Aanbetaling" },
        { icon: Hotel, label: "Kennelindeling" },
        { icon: ClipboardList, label: "Voer & medicatie" },
        { icon: Moon, label: "Verblijf" },
        { icon: Receipt, label: "Eindfactuur" },
        { icon: CalendarPlus, label: "Volgende vakantie" },
      ],
    },
    results: [
      { icon: ShieldCheck, titel: "Nooit dubbel geboekt", tekst: "De bezetting per verblijf is de waarheid, altijd actueel." },
      { icon: CreditCard, titel: "Zekerheid vooraf", tekst: "Een aanbetaling bij reservering scheelt lege kennels." },
      { icon: ClipboardList, titel: "Zorg tot in detail", tekst: "Voerschema, medicatie en gewoontes staan bij de hond." },
      { icon: CalendarDays, titel: "Vakanties vooruit gepland", tekst: "Vaste gasten reserveren maanden van tevoren zelf." },
      { icon: Clock, titel: "Rustiger haal- en brengmomenten", tekst: "Klanten kiezen een tijdslot dat jou uitkomt." },
    ],
    moduleTitel: "Een tweede thuis, tot in de puntjes geregeld.",
    moduleDesc:
      "Reserveringen, bezetting en verblijven in één kalender. Met aanbetalingen, voerschema's en automatische facturatie.",
    features: [
      "Online reserveren",
      "Bezettingskalender",
      "Kennels & verblijven",
      "Aanbetalingen",
      "Voer- en medicatieschema's",
      "Vaccinatiebeheer",
      "Haal- en brengtijden",
      "Hondenprofielen",
      "Automatische facturatie",
      "Klantportaal",
    ],
    testimonial: {
      quote:
        "Sinds de bezetting online staat heb ik geen enkele dubbele boeking meer gehad.",
      name: "Peter Aalbers",
      role: "Hondenpension De Buitenplaats",
      emoji: "🏨",
      photo: "testimonial-peter.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een hondenpension",
      belofte:
        "Binnen 24 uur zie je jouw eigen verblijven, tarieven en reserveringskalender live staan.",
    },
    seo: {
      title: "Software voor je hondenpension — reserveringen en bezetting",
      description:
        "Pension software voor hondenpensions: online reserveren, bezettingskalender, kennelindeling, aanbetalingen en automatische facturatie. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software hondenpension",
        "pension software honden",
        "reserveringssysteem hondenpension",
        "bezetting hondenpension",
        "website hondenpension",
        "administratie hondenpension",
        "software dierenpension",
      ],
    },
    faq: [
      {
        v: "Kunnen klanten zelf een periode reserveren?",
        a: "Ja. Ze kiezen aankomst- en vertrekdatum en zien meteen of er plek is in het verblijf van hun voorkeur. Is het vol, dan kunnen ze alleen op de wachtlijst.",
      },
      {
        v: "Kan ik een aanbetaling vragen?",
        a: "Je stelt zelf een percentage of vast bedrag in. De klant betaalt direct met iDEAL bij het reserveren; het restant zit op de eindfactuur.",
      },
      {
        v: "Kan ik verschillende verblijven en tarieven instellen?",
        a: "Ja. Losse kennels, ruimere suites, binnen of buiten, met eigen capaciteit en prijs. Ook toeslagen voor hoogseizoen, feestdagen of een tweede hond uit hetzelfde gezin.",
      },
      {
        v: "Waar leg ik voer en medicatie vast?",
        a: "Bij elke hond staat een voerschema en medicatieschema, plus bijzonderheden over gedrag en gezondheid. Je medewerkers zien het in hun eigen portaal.",
      },
      {
        v: "Kan ik zien hoe vol ik zit in de zomer?",
        a: "De bezettingskalender laat per dag en per verblijf zien hoeveel plekken bezet zijn. Zo weet je maanden vooruit waar nog ruimte is.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── gedragstherapie ──
  {
    slug: "gedragstherapie",
    path: "/gedragstherapie-software",
    naam: "Gedragstherapie",
    naamKlein: "gedragspraktijk",
    meervoud: "gedragstherapeuten",
    kaartTekst: "Intakes, dossiers, trajecten en rapportages",
    icon: Brain,
    photo: "branche-gedragstherapie.jpg",
    photoLabel: "Rustig consult met hond en baasje",
    demoService: "gedragstherapie",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "gedragspraktijk",
      kopNa: "nodig heeft.",
      sub: "Uitgebreide intakeformulieren, complete dossiers en trajecten die je zorgvuldig opvolgt. Zonder papierwerk, zonder losse documenten.",
      chips: [
        "Online intake",
        "Volledige dossiers",
        "Behandeltrajecten",
        "Verslagen",
        "Adviezen delen",
        "Vervolgafspraken",
        "Facturen",
        "Klantportaal",
      ],
      notificatie: {
        titel: "Intake ingevuld",
        tekst: "Nieuw traject · dossier aangemaakt",
      },
    },
    dashboard: {
      naam: "Joost",
      agenda: [
        { time: "09:30", title: "Intake — Bo", who: "Angst · dossier ingevuld", tone: "brand" },
        { time: "11:00", title: "Vervolgconsult — Nova", who: "Sessie 3 van 5", tone: "sage" },
        { time: "13:30", title: "Huisbezoek — Tygo", who: "Alleen-zijn · Familie Smit", tone: "gold" },
        { time: "16:00", title: "Evaluatie — Luna", who: "Traject afronden", tone: "ink" },
      ],
    },
    problem: {
      titel: "De sessie duurt een uur. Het verslag ook.",
      intro:
        "Intakes komen als ingevulde Word-bestanden binnen, verslagen typ je 's avonds uit en adviezen mail je los na. Een dossier bestaat uit tien plekken tegelijk.",
      items: [
        { icon: FileText, text: "Intakeformulieren als los document" },
        { icon: FolderOpen, text: "Dossiers verspreid over mappen" },
        { icon: Mail, text: "Adviezen die je per mail nastuurt" },
        { icon: Table2, text: "Trajecten bijgehouden in Excel" },
        { icon: CalendarX, text: "Vervolgafspraken die blijven liggen" },
        { icon: Receipt, text: "Facturen los van het traject" },
      ],
      conclusie: "Je wilt gedrag begrijpen, geen documenten beheren.",
      conclusieAccent: "En toch gaat je avond op aan typen.",
    },
    solution: {
      titel: "Van intake tot afgerond traject. Alles in één dossier.",
      intro:
        "De klant vult de intake vooraf online in. Jij begint het gesprek met het volledige beeld en legt alles vast waar het hoort.",
      flow: [
        { icon: UserPlus, label: "Aanmelding" },
        { icon: ClipboardList, label: "Online intake" },
        { icon: CalendarCheck, label: "Consult" },
        { icon: FolderOpen, label: "Dossier" },
        { icon: FileText, label: "Verslag" },
        { icon: LayoutDashboard, label: "Advies in portaal" },
        { icon: Activity, label: "Vervolgtraject" },
        { icon: Receipt, label: "Factuur" },
        { icon: BadgeCheck, label: "Afronding" },
      ],
    },
    results: [
      { icon: ClipboardList, titel: "Voorbereid het gesprek in", tekst: "De intake is al ingevuld voordat je elkaar ziet." },
      { icon: FolderOpen, titel: "Eén compleet dossier", tekst: "Historie, verslagen, adviezen en bestanden bij elkaar." },
      { icon: Activity, titel: "Trajecten die je opvolgt", tekst: "Je ziet welke stap er open staat en bij wie." },
      { icon: Clock, titel: "Minder avondwerk", tekst: "Verslag direct vastleggen in plaats van later uittypen." },
      { icon: ShieldCheck, titel: "Zorgvuldig vastgelegd", tekst: "Beveiligd, met inzage voor de klant zelf." },
    ],
    moduleTitel: "Meer aandacht voor de hond. Minder administratie.",
    moduleDesc:
      "Leg trajecten zorgvuldig vast en volg ze op. Zonder papierwerk en zonder losse documenten.",
    features: [
      "Online intakeformulieren",
      "Volledige dossiers",
      "Behandeltrajecten",
      "Verslagen per sessie",
      "Adviezen & huiswerk delen",
      "Bestanden en video's",
      "Vervolgafspraken",
      "Rapportages",
      "Facturatie",
      "Klantportaal",
    ],
    testimonial: {
      quote:
        "Ik kan me eindelijk weer focussen op het begeleiden van honden. Daar deed ik het voor.",
      name: "Joost Hendriks",
      role: "Gedragstherapie Kalm & Co",
      emoji: "🐶",
      photo: "testimonial-joost.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een gedragspraktijk",
      belofte:
        "Binnen 24 uur zie je jouw eigen intakeformulier, trajecten en klantportaal live staan.",
    },
    seo: {
      title: "Software voor gedragstherapie bij honden — dossiers en trajecten",
      description:
        "Software voor hondengedragstherapeuten: online intake, complete dossiers, behandeltrajecten, verslagen en facturatie. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software gedragstherapie hond",
        "hondengedragstherapeut software",
        "dossier gedragstherapie hond",
        "intakeformulier hondengedrag",
        "klantenportaal gedragstherapie",
        "website hondengedragstherapeut",
      ],
    },
    faq: [
      {
        v: "Kan ik mijn eigen intakevragen gebruiken?",
        a: "Ja. Je stelt je eigen intakeformulier samen met alle vragen die jij belangrijk vindt. De klant vult het online in voordat het eerste consult plaatsvindt.",
      },
      {
        v: "Hoe zit het met privacy van dossiers?",
        a: "Dossiers staan beveiligd binnen jouw eigen omgeving, op Europese servers. Alleen jij en de medewerkers die jij toegang geeft kunnen erbij. De klant ziet zijn eigen dossier in het klantportaal.",
      },
      {
        v: "Kan ik een traject van meerdere sessies vastleggen?",
        a: "Je maakt een traject aan met de sessies die erbij horen. Per sessie leg je een verslag en het huiswerk vast, en je ziet in één oogopslag waar een klant staat.",
      },
      {
        v: "Kan ik video's en documenten delen?",
        a: "Ja. Adviezen, oefeningen, filmpjes en documenten zet je in het dossier. De klant vindt ze terug in zijn eigen omgeving, zonder dat je iets hoeft te mailen.",
      },
      {
        v: "Kan ik dit combineren met een hondenschool?",
        a: "Zeker. Veel gedragstherapeuten geven ook cursussen. Beide modules draaien in dezelfde omgeving met dezelfde klanten, honden en facturatie.",
      },
    ],
  },

  // ────────────────────────────────────────────────────── dierenverzorging ──
  {
    slug: "dierenverzorging",
    path: "/dierenverzorging-software",
    naam: "Dierenverzorging aan huis",
    naamKlein: "dierenzorg aan huis",
    meervoud: "dierenverzorgers",
    kaartTekst: "Bezoeken aan huis, sleutelbeheer en routes",
    icon: HandHeart,
    photo: "branche-dierenverzorging.jpg",
    photoLabel: "Verzorger op bezoek bij hond thuis",
    demoService: "oppas",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "dierenzorg aan huis",
      kopNa: "nodig heeft.",
      sub: "Bezoeken, sleutels, voerinstructies en routes op één plek. Klanten boeken hun periode zelf en krijgen na elk bezoek een update. Vertrouwde zorg, vlekkeloos geregeld.",
      chips: [
        "Bezoeken plannen",
        "Sleutelbeheer",
        "Voer- & medicatie",
        "Routes",
        "Bezoekverslagen",
        "Vakantieperiodes",
        "Facturen",
        "Klantportaal",
      ],
      notificatie: {
        titel: "Bezoek afgerond",
        tekst: "Update met foto verstuurd naar het baasje",
      },
    },
    dashboard: {
      naam: "Nadia",
      agenda: [
        { time: "08:00", title: "Ochtendbezoek — Nova", who: "Kerkstraat 12 · sleutel 04", tone: "brand" },
        { time: "10:00", title: "Bezoek — Bo & Saar", who: "Voeren · medicatie", tone: "sage" },
        { time: "13:00", title: "Wandeling — Tygo", who: "45 min · update sturen", tone: "gold" },
        { time: "18:00", title: "Avondbezoek — Luna", who: "Laatste ronde van de dag", tone: "ink" },
      ],
    },
    problem: {
      titel: "Vier adressen, vier sleutels, vier voerinstructies.",
      intro:
        "Elke klant heeft eigen wensen, eigen tijden en een eigen sleutel. Dat past niet in een agenda-app, en al helemaal niet in je hoofd.",
      items: [
        { icon: MapPin, text: "Adressen en routes op losse briefjes" },
        { icon: ShieldCheck, text: "Sleutels zonder sluitende registratie" },
        { icon: ClipboardList, text: "Voerinstructies per WhatsApp" },
        { icon: CalendarX, text: "Vakantieperiodes in een papieren agenda" },
        { icon: MessageCircle, text: "Updates die je 's avonds nastuurt" },
        { icon: FileText, text: "Facturen per klant handmatig maken" },
      ],
      conclusie: "Je klanten vertrouwen je hun huis én hun hond toe.",
      conclusieAccent: "Dat verdient een strakke administratie.",
    },
    solution: {
      titel: "Van aanvraag tot bezoekverslag. Zonder losse eindjes.",
      intro:
        "Klanten geven hun periode en wensen door, jij plant de bezoeken in en stuurt na elk bezoek automatisch een update.",
      flow: [
        { icon: UserPlus, label: "Nieuwe klant" },
        { icon: Home, label: "Kennismaking" },
        { icon: ClipboardList, label: "Zorginstructies" },
        { icon: CalendarCheck, label: "Periode boeken" },
        { icon: MapPin, label: "Route & bezoeken" },
        { icon: PawPrint, label: "Bezoek" },
        { icon: Smile, label: "Update met foto" },
        { icon: Receipt, label: "Factuur" },
        { icon: CalendarPlus, label: "Volgende vakantie" },
      ],
    },
    results: [
      { icon: ShieldCheck, titel: "Sleutels sluitend geregistreerd", tekst: "Wie heeft welke sleutel, sinds wanneer, en waar hoort hij." },
      { icon: ClipboardList, titel: "Instructies bij de hand", tekst: "Voer, medicatie en gewoontes staan op je telefoon." },
      { icon: MapPin, titel: "Efficiëntere routes", tekst: "Bezoeken van een dag logisch achter elkaar gepland." },
      { icon: Smile, titel: "Gerustgestelde klanten", tekst: "Na elk bezoek automatisch een update met een foto." },
      { icon: Receipt, titel: "Facturatie zonder rekenwerk", tekst: "Aantal bezoeken maal tarief, automatisch verwerkt." },
    ],
    moduleTitel: "Vertrouwde zorg in hun eigen mand.",
    moduleDesc:
      "Bezoeken, sleutels, zorginstructies en routes op één plek. Met automatische updates naar het baasje.",
    features: [
      "Bezoeken plannen",
      "Sleutelbeheer",
      "Voer- en medicatieschema's",
      "Routes per dag",
      "Bezoekverslagen met foto's",
      "Vakantieperiodes",
      "Hondenprofielen",
      "Automatische facturatie",
      "Klantportaal",
      "Personeelsportaal",
    ],
    testimonial: {
      quote:
        "Mijn klanten krijgen na elk bezoek een berichtje met een foto. Dat geeft ze zoveel rust.",
      name: "Nadia el Amrani",
      role: "Dierenzorg aan Huis Zuid",
      emoji: "🏠",
      photo: "testimonial-nadia.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van dierenverzorging aan huis",
      belofte:
        "Binnen 24 uur zie je jouw eigen diensten, tarieven en aanvraagformulier live staan.",
    },
    seo: {
      title: "Software voor dierenverzorging aan huis — bezoeken en routes",
      description:
        "Software voor dierenoppas en dierenverzorging aan huis: bezoeken plannen, sleutelbeheer, zorginstructies, routes en automatische facturatie. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software dierenverzorging aan huis",
        "software dierenoppas",
        "hondenoppas software",
        "planning dierenverzorging",
        "sleutelbeheer dierenoppas",
        "website dierenoppas",
      ],
    },
    faq: [
      {
        v: "Hoe houd ik bij welke sleutel bij welke klant hoort?",
        a: "Elke sleutel krijgt een eigen registratie: welke klant, welk label, wie hem nu heeft en sinds wanneer. Je ziet altijd waar elke sleutel is.",
      },
      {
        v: "Kunnen klanten hun vakantieperiode zelf doorgeven?",
        a: "Ja. Ze kiezen de periode, het aantal bezoeken per dag en de gewenste tijden. Jij ziet de aanvraag binnenkomen en bevestigt met één klik.",
      },
      {
        v: "Krijgen klanten bericht na een bezoek?",
        a: "Je legt per bezoek kort vast hoe het ging en voegt eventueel een foto toe. De klant krijgt dat automatisch te zien in zijn eigen omgeving.",
      },
      {
        v: "Werkt dit ook voor katten en andere dieren?",
        a: "Ja. Al draait DogWare om honden, de dierenprofielen werken net zo goed voor katten, konijnen of vogels. Veel verzorgers combineren dat in één klantdossier.",
      },
      {
        v: "Kan ik met meerdere verzorgers werken?",
        a: "Iedere verzorger krijgt een eigen inlog en ziet alleen de bezoeken van die dag, met adres, sleutelafspraak en instructies.",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── chipservice ──
  {
    slug: "chipservice",
    path: "/chipservice-software",
    naam: "Chipservice",
    naamKlein: "chipservice",
    meervoud: "chippers",
    kaartTekst: "Chipafspraken, registraties en certificaten",
    icon: ScanLine,
    photo: "branche-chipservice.jpg",
    photoLabel: "Pup wordt gechipt",
    demoService: null,
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "chipservice",
      kopNa: "nodig heeft.",
      sub: "Chipafspraken, chipnummers, registraties en certificaten op één plek. Fokkers en baasjes boeken zelf, jij levert het bewijs met één klik.",
      chips: [
        "Online afspraken",
        "Chipnummers",
        "Nestregistraties",
        "Certificaten",
        "Locaties & rondes",
        "Klantportaal",
        "Facturen",
        "iDEAL",
      ],
      notificatie: {
        titel: "Nest geregistreerd",
        tekst: "7 pups · chipnummers vastgelegd",
      },
    },
    dashboard: {
      naam: "Rob",
      agenda: [
        { time: "09:00", title: "Nest chippen — 7 pups", who: "Kennel De Heuvel", tone: "brand" },
        { time: "11:00", title: "Chipafspraak — Nova", who: "Losse pup · certificaat", tone: "sage" },
        { time: "13:30", title: "Ronde Zuid", who: "3 adressen · onderweg", tone: "gold" },
        { time: "16:00", title: "Registraties bijwerken", who: "12 chipnummers vastgelegd", tone: "ink" },
      ],
    },
    problem: {
      titel: "Zeven pups, zeven chipnummers, één Excel-bestand.",
      intro:
        "Chipnummers overtypen, certificaten los opmaken en afspraken telefonisch plannen. Eén typefout in een chipnummer en je bent een middag verder.",
      items: [
        { icon: Table2, text: "Chipnummers overtypen in Excel" },
        { icon: PhoneCall, text: "Afspraken die telefonisch binnenkomen" },
        { icon: FileText, text: "Certificaten die je los opmaakt" },
        { icon: FolderOpen, text: "Nestgegevens verspreid over mappen" },
        { icon: MapPin, text: "Rondes langs adressen zonder planning" },
        { icon: Receipt, text: "Facturen per fokker handmatig" },
      ],
      conclusie: "Een chipnummer is vijftien cijfers.",
      conclusieAccent: "Die wil je één keer goed vastleggen.",
    },
    solution: {
      titel: "Van afspraak tot certificaat. In één handeling.",
      intro:
        "Een fokker boekt een chipronde, jij legt per pup het chipnummer vast en het certificaat rolt er automatisch uit.",
      flow: [
        { icon: UserPlus, label: "Fokker of baasje" },
        { icon: Globe, label: "Jouw website" },
        { icon: CalendarCheck, label: "Chipafspraak" },
        { icon: MapPin, label: "Ronde plannen" },
        { icon: ScanLine, label: "Chippen" },
        { icon: ClipboardList, label: "Nummers vastleggen" },
        { icon: BadgeCheck, label: "Certificaat" },
        { icon: Receipt, label: "Factuur" },
        { icon: LayoutDashboard, label: "Terug te vinden" },
      ],
    },
    results: [
      { icon: ShieldCheck, titel: "Geen typefouten meer", tekst: "Chipnummers worden gecontroleerd op lengte en dubbelen." },
      { icon: BadgeCheck, titel: "Certificaat met één klik", tekst: "Direct opgemaakt in je eigen huisstijl en verstuurd." },
      { icon: FolderOpen, titel: "Nesten compleet vastgelegd", tekst: "Moeder, pups, chipnummers en fokker bij elkaar." },
      { icon: MapPin, titel: "Efficiëntere rondes", tekst: "Adressen van een dag logisch achter elkaar gepland." },
      { icon: Receipt, titel: "Direct afgerekend", tekst: "Betaling met iDEAL bij de boeking of achteraf op factuur." },
    ],
    moduleTitel: "Chippen, registreren en certificeren op één plek.",
    moduleDesc:
      "Chipafspraken, nestregistraties en certificaten in dezelfde omgeving als je klanten, agenda en facturen.",
    features: [
      "Online chipafspraken",
      "Chipnummerregistratie",
      "Nestregistraties",
      "Certificaten in eigen huisstijl",
      "Locaties & rondes",
      "Fokkersbeheer",
      "Hondenprofielen",
      "Facturatie",
      "iDEAL-betalingen",
      "Klantportaal",
    ],
    testimonial: {
      quote:
        "Een heel nest chippen en registreren doe ik nu in de tijd die het vroeger voor één pup kostte.",
      name: "Rob Timmermans",
      role: "Chipservice Midden-Nederland",
      emoji: "📡",
      photo: "testimonial-rob.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een chipservice",
      belofte:
        "Binnen 24 uur zie je jouw eigen chipdiensten, tarieven en afspraakformulier live staan.",
    },
    seo: {
      title: "Software voor je chipservice — chipafspraken en registraties",
      description:
        "Software voor chipservices: online chipafspraken, chipnummerregistratie, nestregistraties, certificaten en facturatie. Alles op één plek. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "software chipservice",
        "chipservice honden software",
        "chipregistratie software",
        "nestregistratie chippen",
        "afspraken chipservice",
        "website chipservice",
      ],
    },
    faq: [
      {
        v: "Kan ik een heel nest in één keer vastleggen?",
        a: "Ja. Je maakt een nest aan bij de fokker en voegt de pups toe met hun chipnummer, geslacht en kleur. Certificaten maak je daarna voor het hele nest tegelijk aan.",
      },
      {
        v: "Worden chipnummers gecontroleerd?",
        a: "Een chipnummer wordt gecontroleerd op lengte en op dubbele registratie binnen jouw omgeving. Zo vang je typefouten af voordat ze in een certificaat belanden.",
      },
      {
        v: "Kan ik certificaten in mijn eigen huisstijl versturen?",
        a: "Ja. Certificaten en bevestigingen komen automatisch met jouw logo en gegevens erop, als PDF in de mail en in het klantportaal.",
      },
      {
        v: "Kan ik rondes langs meerdere adressen plannen?",
        a: "Je plant een ronde met meerdere afspraken op één dag. Je ziet de adressen in de juiste volgorde, met per adres wat er gedaan moet worden.",
      },
      {
        v: "Kan ik dit combineren met andere diensten?",
        a: "Ja. Veel chippers geven ook cursussen of doen paspoortcontroles. Alles draait in dezelfde omgeving met dezelfde klanten en facturatie.",
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────── webshop ──
  {
    slug: "webshop",
    path: "/webshop-software",
    naam: "Webshop",
    naamKlein: "webshop",
    meervoud: "webshops",
    kaartTekst: "Producten verkopen naast je diensten",
    icon: ShoppingBag,
    photo: "branche-webshop.jpg",
    photoLabel: "Assortiment riemen, snacks en speelgoed",
    demoService: "webshop",
    hero: {
      kopVoor: "De laatste website die jouw",
      kopAccent: "webshop",
      kopNa: "nodig heeft.",
      sub: "Verkoop riemen, snacks, voer en cadeaubonnen naast je diensten. Eén assortiment, één winkelwagen, één afrekening — in dezelfde omgeving als je agenda en klanten.",
      chips: [
        "Producten & varianten",
        "Voorraad",
        "Winkelwagen",
        "iDEAL & betaallinks",
        "Verzenden of afhalen",
        "Cadeaubonnen",
        "Facturen",
        "Klantportaal",
      ],
      notificatie: {
        titel: "Nieuwe bestelling",
        tekst: "2 artikelen · betaald met iDEAL",
      },
    },
    dashboard: {
      naam: "Iris",
      agenda: [
        { time: "09:00", title: "Nieuwe bestelling — #1042", who: "2 artikelen · betaald met iDEAL", tone: "brand" },
        { time: "10:15", title: "Cadeaubon verkocht", who: "€ 50 · verzilverbaar op diensten", tone: "sage" },
        { time: "13:00", title: "Pakketten klaarzetten", who: "6 bestellingen · verzenden", tone: "gold" },
        { time: "15:30", title: "Afhalen — Luna's baasje", who: "Bij de afspraak van 16:00", tone: "ink" },
      ],
    },
    problem: {
      titel: "Je verkoopt al producten. Alleen via een appje.",
      intro:
        "Klanten vragen of je die riem nog hebt, jij kijkt in de kast, tikt een tikkie en zoekt later uit wat er verkocht is. Verkopen zou makkelijker moeten zijn dan dit.",
      items: [
        { icon: MessageCircle, text: "Bestellingen per WhatsApp" },
        { icon: Table2, text: "Voorraad die je uit je hoofd bijhoudt" },
        { icon: CreditCard, text: "Betaalverzoeken die je los stuurt" },
        { icon: Package, text: "Geen zicht op wat er nog ligt" },
        { icon: Globe, text: "Een aparte webshop naast je website" },
        { icon: Receipt, text: "Verkopen die buiten je administratie vallen" },
      ],
      conclusie: "Een tweede systeem voor je webshop is een tweede probleem.",
      conclusieAccent: "Het hoort gewoon bij je bedrijf.",
    },
    solution: {
      titel: "Van product tot pakketje. In dezelfde omgeving.",
      intro:
        "Je zet producten klaar, klanten bestellen en betalen met iDEAL, en de bestelling staat bij dezelfde klant als zijn afspraken.",
      flow: [
        { icon: Package, label: "Product toevoegen" },
        { icon: Globe, label: "In jouw webshop" },
        { icon: ShoppingCart, label: "Bestelling" },
        { icon: CreditCard, label: "iDEAL-betaling" },
        { icon: Receipt, label: "Factuur" },
        { icon: Truck, label: "Verzenden of afhalen" },
        { icon: LayoutDashboard, label: "In klantportaal" },
        { icon: Star, label: "Review" },
        { icon: RefreshCw, label: "Herhaalaankoop" },
      ],
    },
    results: [
      { icon: Sparkles, titel: "Extra omzet zonder extra werk", tekst: "Klanten bestellen erbij terwijl ze toch al boeken." },
      { icon: Package, titel: "Voorraad die klopt", tekst: "Elke verkoop schrijft automatisch af." },
      { icon: CreditCard, titel: "Vooraf betaald", tekst: "iDEAL bij de bestelling. Geen tikkies meer nazoeken." },
      { icon: LayoutGrid, titel: "Eén klantbeeld", tekst: "Afspraken en bestellingen bij dezelfde klant." },
      { icon: Wind, titel: "Geen tweede systeem", tekst: "Geen los webshopabonnement, geen koppelingen." },
    ],
    moduleTitel: "Producten verkopen naast je diensten.",
    moduleDesc:
      "Een volwaardige webshop in dezelfde omgeving als je agenda, klanten en facturen. Zonder tweede abonnement.",
    features: [
      "Producten & varianten",
      "Voorraadbeheer",
      "Winkelwagen & afrekenen",
      "iDEAL-betalingen",
      "Verzenden of afhalen",
      "Cadeaubonnen",
      "Kortingscodes",
      "Bestellingen & pakbonnen",
      "Automatische facturatie",
      "Klantportaal",
    ],
    testimonial: {
      quote:
        "De webshop zit gewoon in dezelfde omgeving. Klanten bestellen erbij als ze toch al boeken.",
      name: "Iris de Groot",
      role: "Hondenschool & Shop Waakzaam",
      emoji: "🛍️",
      photo: "testimonial-iris.jpg",
    },
    cta: {
      voorbeeld: "Bekijk een voorbeeld van een webshop",
      belofte:
        "Binnen 24 uur zie je jouw eigen producten, prijzen en afrekenpagina live staan.",
    },
    seo: {
      title: "Webshop software voor je hondenbedrijf — verkopen naast je diensten",
      description:
        "Webshop voor hondenbedrijven: producten, voorraad, iDEAL-betalingen, cadeaubonnen en facturatie in dezelfde omgeving als je agenda en klanten. Vraag een kosteloos voorbeeld aan.",
      keywords: [
        "webshop hondenbedrijf",
        "webshop software honden",
        "hondenwebshop beginnen",
        "webshop trimsalon",
        "webshop hondenschool",
        "producten verkopen hondenbedrijf",
      ],
    },
    faq: [
      {
        v: "Heb ik hiervoor een aparte webshop nodig?",
        a: "Nee, en dat is precies het punt. De webshop zit in dezelfde omgeving als je website, agenda en klanten. Geen tweede abonnement, geen koppelingen die stukgaan.",
      },
      {
        v: "Kan ik varianten zoals maat en kleur instellen?",
        a: "Ja. Per product stel je varianten in met een eigen prijs en voorraad. Klanten kiezen de juiste maat of kleur bij het bestellen.",
      },
      {
        v: "Hoe werkt betalen?",
        a: "Klanten rekenen af met iDEAL. Het geld komt rechtstreeks op jouw rekening en de factuur wordt automatisch aangemaakt en verstuurd.",
      },
      {
        v: "Kan ik cadeaubonnen verkopen?",
        a: "Ja. Cadeaubonnen zijn te koop in je webshop en te verzilveren op producten én op je diensten, zoals een trimbeurt of een cursus.",
      },
      {
        v: "Kunnen klanten hun bestelling ook afhalen?",
        a: "Je bepaalt zelf of je verzendt, laat afhalen of allebei. Bij afhalen kunnen klanten meteen een moment kiezen dat aansluit op hun afspraak.",
      },
    ],
  },
];

/**
 * De algemene variant: precies de teksten die de homepage toonde vóór de
 * branchekiezer bestond. Wordt gebruikt zolang de bezoeker nog geen branche
 * heeft gekozen, zodat er niets van de bestaande basis verloren gaat.
 */
export const ALGEMEEN: Omit<Branche, "slug" | "path" | "seo" | "faq" | "kaartTekst"> & {
  slug: "algemeen";
} = {
  slug: "algemeen",
  naam: "Hondenbedrijf",
  naamKlein: "hondenbedrijf",
  meervoud: "hondenbedrijven",
  icon: PawPrint,
  photo: "training-veld.jpg",
  photoLabel: "Training op het veld",
  demoService: null,
  hero: {
    kopVoor: "De laatste website die jouw",
    kopAccent: "hondenbedrijf",
    kopNa: "nodig heeft.",
    sub: "Je website, planning, klanten, betalingen en communicatie in één veilige omgeving. Geen losse systemen, geen updates en geen technisch gedoe. Jij zorgt voor de honden. DogWare zorgt voor de rest.",
    chips: [
      "Website",
      "Planning",
      "Klanten",
      "Facturen",
      "Agenda",
      "Betalingen",
      "E-mail",
      "Klantportaal",
    ],
    notificatie: {
      titel: "Nieuwe inschrijving",
      tekst: "Puppycursus · automatisch verwerkt",
    },
  },
  dashboard: {
    naam: "Sanne",
    agenda: [
      { time: "09:00", title: "Puppycursus — groep A", who: "6 honden · Buitenterrein", tone: "brand" },
      { time: "10:30", title: "Gedragsconsult — Bo", who: "Intake · Familie de Vries", tone: "sage" },
      { time: "13:00", title: "Uitlaatronde Noord", who: "5 honden · Route 2", tone: "gold" },
      { time: "15:30", title: "Trimbehandeling — Luna", who: "Knippen & wassen", tone: "ink" },
    ],
  },
  problem: {
    titel: "Zoveel losse systemen. En dat voelt normaal.",
    intro:
      "De meeste hondenondernemers werken met een handvol programma's die niets van elkaar weten. Elk apart lijkt het te werken. Bij elkaar kost het je elke avond opnieuw tijd.",
    items: [
      { icon: Globe, text: "Een websitebouwer" },
      { icon: CalendarX, text: "Een losse agenda" },
      { icon: FileText, text: "Een apart factuurprogramma" },
      { icon: MessageCircle, text: "WhatsApp voor je klanten" },
      { icon: Table2, text: "Excel voor je administratie" },
      { icon: Mail, text: "Losse e-mails voor aanmeldingen" },
      { icon: FolderOpen, text: "Google Drive voor je bestanden" },
      { icon: CreditCard, text: "iDEAL via weer een ander systeem" },
    ],
    conclusie: "Acht systemen, acht wachtwoorden, nul overzicht.",
    conclusieAccent: "Waarom doe je dit eigenlijk nog zo?",
  },
  solution: {
    titel: "Van eerste klik tot vaste klant. Alles op één plek.",
    intro:
      "Geen losse programma's die je zelf aan elkaar moet knopen. Eén klant doorloopt je hele bedrijf, en elke stap gaat vanzelf in DogWare.",
    flow: [
      { icon: UserPlus, label: "Nieuwe klant" },
      { icon: Globe, label: "Jouw website" },
      { icon: CalendarCheck, label: "Boeking" },
      { icon: CalendarDays, label: "Planning" },
      { icon: Receipt, label: "Factuur" },
      { icon: CreditCard, label: "iDEAL-betaling" },
      { icon: LayoutDashboard, label: "Klantportaal" },
      { icon: Mail, label: "E-mail" },
      { icon: Star, label: "Review" },
      { icon: CalendarPlus, label: "Nieuwe afspraak" },
    ],
  },
  results: [
    { icon: Wind, titel: "Meer rust", tekst: "Minder losse systemen. Minder ruis. Minder stress." },
    { icon: LayoutGrid, titel: "Meer overzicht", tekst: "Alles centraal, altijd actueel en op één plek." },
    { icon: Sparkles, titel: "Minder administratie", tekst: "Automatisering neemt het werk uit handen." },
    { icon: BadgeCheck, titel: "Professionelere uitstraling", tekst: "Een moderne, verzorgde ervaring voor je klanten." },
    { icon: Clock, titel: "Meer tijd", tekst: "Voor klanten. Voor honden. Voor jezelf." },
  ],
  moduleTitel: "Eén platform, gebouwd voor jouw vakgebied.",
  moduleDesc:
    "Kies de onderdelen die bij jouw bedrijf passen. Combineer er zoveel als je wilt. Ze werken gewoon samen in dezelfde omgeving.",
  features: [
    "Website",
    "Online boeken",
    "Agenda & planning",
    "Klant- & hondenbeheer",
    "Automatische facturatie",
    "iDEAL-betalingen",
    "Klantportaal",
    "Personeelsportaal",
    "Webshop",
    "Nieuwsbrieven",
  ],
  testimonial: {
    quote:
      "Voor het eerst heb ik het gevoel dat alles samenwerkt. Geen losse lijstjes meer.",
    name: "Sanne Bakker",
    role: "Hondenschool De Vrije Loop",
    emoji: "🐕",
    photo: "testimonial-sanne.jpg",
  },
  cta: {
    voorbeeld: "Bekijk een voorbeeld voor mijn bedrijf",
    belofte:
      "Binnen 24 uur zie je jouw eigen diensten, tarieven en klantportaal live staan.",
  },
};

/** Alles waar de secties uit lezen: een echte branche óf de algemene variant. */
export type BrancheContent = Branche | typeof ALGEMEEN;

export const BRANCHE_BY_SLUG = new Map<string, Branche>(
  BRANCHES.map((b) => [b.slug, b]),
);

export const BRANCHE_BY_PATH = new Map<string, Branche>(
  BRANCHES.map((b) => [b.path.replace(/^\//, ""), b]),
);

export function getBranche(slug: string | null | undefined): Branche | null {
  if (!slug) return null;
  return BRANCHE_BY_SLUG.get(slug) ?? null;
}

/** De inhoud voor een (eventueel lege) branchekeuze — nooit null. */
export function brancheContent(slug: string | null | undefined): BrancheContent {
  return getBranche(slug) ?? ALGEMEEN;
}

/** Link naar de demoflow, met de branche al voorgeselecteerd. */
export function demoHref(content: BrancheContent): string {
  return content.demoService ? `/demo?branche=${content.demoService}` : "/demo";
}
