/**
 * De behoeften waarmee ondernemers binnenkomen — de tweede ingang naast de
 * branchekiezer. Iemand denkt niet altijd "ik heb een trimsalon", maar vaak
 * "ik wil minder administratie".
 *
 * Voedt het blok "Of zoek je een oplossing voor…" op de homepage én de
 * bijbehorende SEO-landingspagina's. Client-safe, net als lib/branches.ts.
 */

import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Package,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Table2,
  Users,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BrancheSlug } from "@/lib/branches";

export type Need = {
  slug: string;
  /** URL van de landingspagina, bijv. "/minder-administratie" */
  path: string;
  /** Korte titel op de kaart: "Minder administratie" */
  titel: string;
  /** Eén regel eronder */
  kort: string;
  icon: LucideIcon;

  /** Kop op de landingspagina */
  h1: string;
  intro: string;

  /** Wat er nu misgaat */
  pijn: { titel: string; items: string[] };
  /** Hoe DogWare het oplost */
  oplossing: { titel: string; stappen: { icon: LucideIcon; titel: string; tekst: string }[] };
  /** Concrete onderdelen */
  features: string[];
  /** Branches waarvoor dit het meest speelt — voor interne links */
  branches: BrancheSlug[];

  seo: { title: string; description: string; keywords: string[] };
  faq: { v: string; a: string }[];
};

export const NEEDS: Need[] = [
  {
    slug: "meer-online-boekingen",
    path: "/meer-online-boekingen",
    titel: "Meer online boekingen",
    kort: "Klanten die zelf boeken, ook buiten kantooruren",
    icon: CalendarCheck,
    h1: "Meer online boekingen, zonder dat je er iets voor hoeft te doen.",
    intro:
      "De meeste klanten kijken 's avonds op de bank of jij nog plek hebt. Kunnen ze op dat moment niet boeken, dan kijken ze verder. Met DogWare boeken ze meteen — en is de plek meteen van hen.",
    pijn: {
      titel: "Waarom je nu boekingen misloopt",
      items: [
        "Je bent overdag met honden bezig en pakt de telefoon niet op",
        "Aanvragen komen 's avonds binnen, jij reageert de volgende dag",
        "Klanten moeten eerst vragen wanneer je kunt",
        "Er staat nergens duidelijk wat je aanbiedt en wat het kost",
        "Wie twijfelt, stelt het uit — en boekt uiteindelijk niet",
      ],
    },
    oplossing: {
      titel: "Zo komen de boekingen vanzelf binnen",
      stappen: [
        { icon: Globe, titel: "Je aanbod staat online", tekst: "Diensten, duur en prijs staan helder op je eigen website." },
        { icon: CalendarDays, titel: "Alleen echte momenten", tekst: "Klanten zien uitsluitend tijden die daadwerkelijk kunnen." },
        { icon: CreditCard, titel: "Meteen vastgelegd", tekst: "Met iDEAL of aanbetaling is de plek direct van hen." },
        { icon: Bell, titel: "Herinnering volgt", tekst: "Automatische bevestiging en herinnering, dus veel minder no-shows." },
      ],
    },
    features: [
      "Online boekingsmodule",
      "Beschikbaarheid & openingstijden",
      "Capaciteit per dienst of groep",
      "Wachtlijsten",
      "Aanbetalingen en iDEAL",
      "Automatische bevestiging",
      "Herinneringen per e-mail",
      "Boeken vanaf de mobiel",
    ],
    branches: ["trimsalon", "hondenschool", "dagopvang", "pension"],
    seo: {
      title: "Meer online boekingen voor je hondenbedrijf",
      description:
        "Laat klanten zelf online boeken, ook 's avonds. Beschikbaarheid, capaciteit, aanbetalingen en automatische herinneringen voor hondenscholen, trimsalons, opvang en pension.",
      keywords: [
        "online boekingen hondenbedrijf",
        "online boekingssysteem honden",
        "meer boekingen trimsalon",
        "online reserveren hondenpension",
        "boekingssysteem hondenschool",
      ],
    },
    faq: [
      {
        v: "Kan ik zelf bepalen wanneer klanten kunnen boeken?",
        a: "Ja. Je stelt je openingstijden, pauzes en vrije dagen in, plus hoeveel tijd elke dienst kost. Klanten zien alleen momenten die echt passen.",
      },
      {
        v: "Kan ik een aanbetaling vragen bij het boeken?",
        a: "Zeker. Je stelt per dienst een bedrag of percentage in dat direct met iDEAL wordt betaald. Dat scheelt aanzienlijk in no-shows.",
      },
      {
        v: "Wat als ik vol zit?",
        a: "Dan komt de klant automatisch op de wachtlijst en krijgt hij bericht zodra er een plek vrijvalt.",
      },
    ],
  },

  {
    slug: "minder-administratie",
    path: "/minder-administratie",
    titel: "Minder administratie",
    kort: "Werk dat zichzelf doet in plaats van jouw avond",
    icon: Wind,
    h1: "Minder administratie. Zonder dat er iets blijft liggen.",
    intro:
      "Administratie is zelden het probleem. Het overtypen is het probleem. In DogWare voer je gegevens één keer in, en de rest van je bedrijf gebruikt ze automatisch.",
    pijn: {
      titel: "Waar je avond nu heen gaat",
      items: [
        "Dezelfde klantgegevens in drie verschillende systemen zetten",
        "Facturen 's avonds handmatig opmaken en versturen",
        "Bijhouden wie er al betaald heeft en wie niet",
        "Bevestigingen en herinneringen zelf typen",
        "Excel-lijstjes die nooit helemaal kloppen",
      ],
    },
    oplossing: {
      titel: "Zo neemt DogWare het over",
      stappen: [
        { icon: RefreshCw, titel: "Eén keer invoeren", tekst: "Een klant of hond leg je één keer vast en gebruikt het hele platform." },
        { icon: Receipt, titel: "Facturen maken zichzelf", tekst: "Uit de boeking rolt automatisch een correcte factuur." },
        { icon: Mail, titel: "Berichten gaan vanzelf", tekst: "Bevestiging, herinnering en bedankje zonder dat jij iets stuurt." },
        { icon: LayoutGrid, titel: "Altijd één waarheid", tekst: "Geen losse lijstjes meer die uit elkaar lopen." },
      ],
    },
    features: [
      "Klant- en hondendossiers",
      "Automatische facturatie",
      "Automatische e-mails",
      "Betaalstatus per factuur",
      "Herinneringen bij openstaande bedragen",
      "Overzicht van omzet en openstaande posten",
      "Exports voor je boekhouder",
      "Alles doorzoekbaar",
    ],
    branches: ["hondenschool", "uitlaatservice", "gedragstherapie", "dagopvang"],
    seo: {
      title: "Minder administratie voor je hondenbedrijf",
      description:
        "Automatische facturatie, dossiers en e-mails voor hondenscholen, uitlaatservices, trimsalons en opvang. Voer gegevens één keer in en laat de rest zichzelf doen.",
      keywords: [
        "minder administratie hondenbedrijf",
        "administratie hondenschool",
        "administratie uitlaatservice",
        "automatische administratie honden",
        "boekhouding hondenbedrijf",
      ],
    },
    faq: [
      {
        v: "Kan ik mijn bestaande klanten importeren?",
        a: "Ja. Lever je klanten- en hondenlijst aan zoals je hem hebt — vaak een Excel-bestand — dan zetten wij hem bij het opzetten van je omgeving voor je klaar.",
      },
      {
        v: "Werkt dit samen met mijn boekhouder?",
        a: "Je facturen en omzetoverzichten exporteer je per periode. Veel boekhouders zijn daar direct mee geholpen.",
      },
      {
        v: "Hoeveel tijd scheelt dit echt?",
        a: "Dat verschilt per bedrijf, maar het grootste verschil zit in het wegvallen van dubbel invoeren en het handmatig maken van facturen en bevestigingen.",
      },
    ],
  },

  {
    slug: "professionele-website",
    path: "/professionele-website-hondenbedrijf",
    titel: "Een professionele website",
    kort: "Een site die werkt, niet alleen mooi is",
    icon: Globe,
    h1: "Een professionele website die ook echt iets doet.",
    intro:
      "Een mooie website die alleen maar mooi is, levert niets op. Bij DogWare is je website de voorkant van je bedrijf: klanten boeken, betalen en loggen er direct in.",
    pijn: {
      titel: "Wat er mis is met de meeste websites",
      items: [
        "Een visitekaartje waar klanten niets kunnen dóen",
        "Losse boekingstool die er anders uitziet dan de rest",
        "Zelf plug-ins en updates bijhouden",
        "Traag op mobiel, terwijl daar de meeste bezoekers zitten",
        "Teksten aanpassen kan alleen via de bouwer",
      ],
    },
    oplossing: {
      titel: "Wat je bij DogWare krijgt",
      stappen: [
        { icon: Sparkles, titel: "Ontworpen voor jouw bedrijf", tekst: "Eigen huisstijl, eigen foto's, eigen teksten — geen sjabloon dat je zelf moet vullen." },
        { icon: Smartphone, titel: "Perfect op mobiel", tekst: "Snel en overzichtelijk op elk scherm, want daar komt je klant binnen." },
        { icon: CalendarCheck, titel: "Boeken zonder omweg", tekst: "Boeken, betalen en inloggen zit in dezelfde site — geen doorlink naar een vreemde tool." },
        { icon: ShieldCheck, titel: "Onderhoud inbegrepen", tekst: "Updates, beveiliging en hosting doen wij. Jij hoeft nooit iets bij te werken." },
      ],
    },
    features: [
      "Website in eigen huisstijl",
      "Eigen domeinnaam",
      "Snel en mobielvriendelijk",
      "Vindbaar in Google",
      "Boeken en betalen ingebouwd",
      "Klantportaal met eigen inlog",
      "Teksten zelf aanpassen",
      "Hosting, updates en beveiliging inbegrepen",
    ],
    branches: ["uitlaatservice", "trimsalon", "hondenschool", "pension"],
    seo: {
      title: "Professionele website voor je hondenbedrijf",
      description:
        "Een website voor je hondenschool, trimsalon, uitlaatservice of pension waarin boeken, betalen en het klantportaal zijn ingebouwd. Inclusief hosting, updates en onderhoud.",
      keywords: [
        "website hondenbedrijf",
        "website hondenschool",
        "website trimsalon",
        "website uitlaatservice",
        "website hondenpension laten maken",
      ],
    },
    faq: [
      {
        v: "Kan ik mijn bestaande domeinnaam behouden?",
        a: "Ja. Je huidige domeinnaam koppelen we aan je nieuwe omgeving, zodat klanten en Google je op dezelfde plek blijven vinden.",
      },
      {
        v: "Kan ik zelf teksten en foto's aanpassen?",
        a: "Ja, dat doe je in je eigen beheeromgeving. Voor grotere wijzigingen kun je ons altijd vragen.",
      },
      {
        v: "Moet ik nog een hostingpakket afsluiten?",
        a: "Nee. Hosting, beveiligingscertificaat, updates en back-ups zitten bij DogWare inbegrepen.",
      },
    ],
  },

  {
    slug: "klantenportaal",
    path: "/klantenportaal-hondenbedrijf",
    titel: "Een klantenportaal",
    kort: "Elke klant een eigen omgeving met alles erin",
    icon: LayoutDashboard,
    h1: "Een klantenportaal waarin je klanten alles zelf kunnen vinden.",
    intro:
      "De meeste vragen die je krijgt zijn dezelfde vragen: wanneer is mijn afspraak, wat was het huiswerk, heb ik al betaald? In een eigen klantomgeving staat het antwoord er gewoon.",
    pijn: {
      titel: "De vragen die je nu telkens beantwoordt",
      items: [
        "\"Wanneer had ik ook alweer mijn afspraak?\"",
        "\"Kun je het huiswerk nog een keer sturen?\"",
        "\"Heb ik die factuur al betaald?\"",
        "\"Hoeveel strippen heb ik nog?\"",
        "\"Kun je de gegevens van mijn hond aanpassen?\"",
      ],
    },
    oplossing: {
      titel: "Wat je klant in zijn portaal ziet",
      stappen: [
        { icon: CalendarDays, titel: "Zijn afspraken", tekst: "Komende en afgelopen afspraken, met de mogelijkheid zelf te wijzigen." },
        { icon: ClipboardList, titel: "Zijn honden", tekst: "Gegevens, vaccinaties en bijzonderheden die hij zelf bijwerkt." },
        { icon: FileText, titel: "Documenten en huiswerk", tekst: "Verslagen, adviezen, oefeningen en video's die jij deelt." },
        { icon: Receipt, titel: "Facturen en betalingen", tekst: "Alles op een rij, met een betaalknop bij wat nog openstaat." },
      ],
    },
    features: [
      "Eigen inlog per klant",
      "Afspraken bekijken en wijzigen",
      "Hondenprofielen zelf bijwerken",
      "Documenten en huiswerk",
      "Facturen en betaalstatus",
      "Strippenkaartsaldo",
      "Dagverslagen en foto's",
      "Berichten van jou"
    ],
    branches: ["hondenschool", "gedragstherapie", "dagopvang", "uitlaatservice"],
    seo: {
      title: "Klantenportaal voor je hondenbedrijf",
      description:
        "Geef klanten een eigen omgeving met hun afspraken, honden, facturen, huiswerk en strippenkaarten. Klantenportaal voor hondenscholen, opvang, uitlaatservices en therapeuten.",
      keywords: [
        "klantenportaal hondenschool",
        "klantenportaal hondenbedrijf",
        "klantomgeving hondenschool",
        "mijn omgeving hondenopvang",
        "klantportaal uitlaatservice",
      ],
    },
    faq: [
      {
        v: "Moeten klanten een app installeren?",
        a: "Nee. Het portaal zit in je eigen website en werkt in elke browser, ook op de telefoon.",
      },
      {
        v: "Kunnen klanten zelf hun gegevens wijzigen?",
        a: "Ja, en dat scheelt jou het meeste werk. Adreswijzigingen, nieuwe telefoonnummers en gegevens van de hond werken ze zelf bij.",
      },
      {
        v: "Bepaal ik zelf wat een klant te zien krijgt?",
        a: "Ja. Per onderdeel stel je in of het zichtbaar is. Sommige bedrijven delen alleen afspraken en facturen, andere ook dossiers en dagverslagen.",
      },
    ],
  },

  {
    slug: "automatische-betalingen",
    path: "/automatische-betalingen",
    titel: "Automatische betalingen",
    kort: "iDEAL bij de boeking, geen achteraf bellen",
    icon: CreditCard,
    h1: "Betaald worden zonder erachteraan te gaan.",
    intro:
      "Achter je geld aan bellen is het vervelendste onderdeel van ondernemen. Laat klanten meteen bij de boeking betalen, dan is dat gesprek nooit meer nodig.",
    pijn: {
      titel: "Waarom betalen nu blijft hangen",
      items: [
        "Je stuurt een tikkie en zoekt later uit wie betaald heeft",
        "Facturen die pas na de dienst de deur uitgaan",
        "Klanten die het simpelweg vergeten",
        "Handmatig afletteren van je bankafschrift",
        "Herinneringen sturen die je liever niet stuurt",
      ],
    },
    oplossing: {
      titel: "Zo loopt het geld binnen",
      stappen: [
        { icon: CreditCard, titel: "iDEAL bij de boeking", tekst: "Betaald voordat de afspraak in je agenda staat." },
        { icon: Receipt, titel: "Factuur automatisch", tekst: "Correcte factuur met btw, meteen in de mail en in het portaal." },
        { icon: RefreshCw, titel: "Abonnementen lopen door", tekst: "Maandbedragen worden automatisch gefactureerd en geïnd." },
        { icon: Bell, titel: "Vriendelijk herinneren", tekst: "Staat er toch iets open, dan gaat de herinnering vanzelf." },
      ],
    },
    features: [
      "iDEAL-betalingen",
      "Betaallinks",
      "Aanbetalingen",
      "Automatische incasso voor abonnementen",
      "Facturen met btw",
      "Betaalstatus per klant",
      "Automatische herinneringen",
      "Omzet- en openstaandeoverzicht",
    ],
    branches: ["uitlaatservice", "dagopvang", "trimsalon", "pension"],
    seo: {
      title: "Automatische betalingen voor je hondenbedrijf",
      description:
        "iDEAL bij de boeking, automatische facturatie, incasso voor abonnementen en herinneringen. Nooit meer achter betalingen aan voor je hondenbedrijf.",
      keywords: [
        "automatische betalingen hondenbedrijf",
        "ideal hondenschool",
        "betalingen uitlaatservice",
        "incasso hondenopvang",
        "online betalen trimsalon",
      ],
    },
    faq: [
      {
        v: "Komt het geld op mijn eigen rekening?",
        a: "Ja. Betalingen lopen via een eigen betaalaccount op jouw naam en komen rechtstreeks op jouw rekening.",
      },
      {
        v: "Kan ik ook achteraf factureren?",
        a: "Zeker. Je bepaalt per dienst of er vooraf betaald wordt, een aanbetaling geldt of dat je achteraf factureert.",
      },
      {
        v: "Werkt dit ook voor maandabonnementen?",
        a: "Ja. Vaste maandbedragen, zoals bij een uitlaatservice of dagopvang, worden automatisch gefactureerd en geïnd.",
      },
    ],
  },

  {
    slug: "planning-medewerkers",
    path: "/planning-medewerkers",
    titel: "Planning van medewerkers",
    kort: "Iedereen weet wat er die dag te doen staat",
    icon: Users,
    h1: "Een rooster waarin iedereen ziet wat er die dag moet gebeuren.",
    intro:
      "Zodra je met meer mensen werkt, wordt de planning het kwetsbaarste onderdeel van je bedrijf. Met een eigen personeelsportaal weet iedereen wat er van hem verwacht wordt.",
    pijn: {
      titel: "Waar het nu misgaat",
      items: [
        "Roosters die je per WhatsApp doorstuurt",
        "Wijzigingen die niet iedereen bereiken",
        "Medewerkers die klantgegevens niet bij de hand hebben",
        "Onduidelijk wie welke rit of groep doet",
        "Uren die je achteraf moet reconstrueren",
      ],
    },
    oplossing: {
      titel: "Zo werkt het met DogWare",
      stappen: [
        { icon: CalendarDays, titel: "Eén rooster", tekst: "Je plant medewerkers in op ritten, lessen, groepen of afspraken." },
        { icon: Smartphone, titel: "Op hun telefoon", tekst: "Iedere medewerker ziet zijn eigen dag, altijd actueel." },
        { icon: ShieldCheck, titel: "Alleen wat nodig is", tekst: "Rechten per rol: een invaller ziet niet je hele administratie." },
        { icon: ClipboardList, titel: "Alles bij de hand", tekst: "Adressen, sleutels, bijzonderheden en instructies per hond." },
      ],
    },
    features: [
      "Personeelsportaal",
      "Rooster per dag en per medewerker",
      "Toewijzen aan ritten, lessen en groepen",
      "Rollen en rechten",
      "Bijzonderheden per hond zichtbaar",
      "Wijzigingen direct doorgevoerd",
      "Beschikbaarheid van medewerkers",
      "Overzicht van gewerkte diensten",
    ],
    branches: ["uitlaatservice", "dagopvang", "pension", "hondenschool"],
    seo: {
      title: "Planning van medewerkers in je hondenbedrijf",
      description:
        "Rooster en personeelsportaal voor uitlaatservices, dagopvang, pension en hondenscholen. Iedereen ziet zijn eigen dag, met alle klant- en hondengegevens erbij.",
      keywords: [
        "planning medewerkers hondenbedrijf",
        "rooster uitlaatservice",
        "personeelsplanning hondenopvang",
        "medewerkers hondenpension",
        "personeelsportaal hondenbedrijf",
      ],
    },
    faq: [
      {
        v: "Kan ik per medewerker instellen wat hij mag zien?",
        a: "Ja. Je werkt met rollen. Een vaste kracht kan bijvoorbeeld klanten beheren, een invaller ziet alleen de planning van die dag.",
      },
      {
        v: "Zien medewerkers de bijzonderheden van een hond?",
        a: "Ja. Bij elke hond staan gedrag, medicatie, sleutelafspraken en instructies, zodat ook een invaller precies weet wat er speelt.",
      },
      {
        v: "Werkt het op de telefoon?",
        a: "Het personeelsportaal is gemaakt voor onderweg en werkt in de browser op elke telefoon. Geen installatie nodig.",
      },
    ],
  },

  {
    slug: "alles-op-een-plek",
    path: "/alles-op-een-plek",
    titel: "Alles op één plek",
    kort: "Eén systeem in plaats van acht losse tools",
    icon: LayoutGrid,
    h1: "Alles op één plek. Eén inlog, één waarheid.",
    intro:
      "Losse tools zijn ieder voor zich prima. Bij elkaar kosten ze je overzicht, geld en tijd. DogWare vervangt ze allemaal door één omgeving die van zichzelf samenwerkt.",
    pijn: {
      titel: "Wat losse systemen je kosten",
      items: [
        "Acht abonnementen die elk maandelijks aftikken",
        "Dezelfde gegevens op meerdere plekken bijhouden",
        "Koppelingen die zonder waarschuwing stoppen",
        "Nooit één betrouwbaar overzicht van je bedrijf",
        "Bij elke vraag eerst uitzoeken in welk systeem het staat",
      ],
    },
    oplossing: {
      titel: "Eén omgeving voor je hele bedrijf",
      stappen: [
        { icon: Globe, titel: "Website en boeken", tekst: "Je voorkant en je agenda zijn hetzelfde systeem." },
        { icon: Users, titel: "Klanten en honden", tekst: "Eén dossier dat elk onderdeel gebruikt." },
        { icon: Receipt, titel: "Facturen en betalingen", tekst: "Direct gekoppeld aan de boeking waar ze bij horen." },
        { icon: LayoutDashboard, titel: "Portalen voor klant en team", tekst: "Iedereen ziet precies wat voor hem bedoeld is." },
      ],
    },
    features: [
      "Website",
      "Online boeken en agenda",
      "Klant- en hondendossiers",
      "Facturatie en iDEAL",
      "Klantportaal",
      "Personeelsportaal",
      "Webshop",
      "E-mail en nieuwsbrieven",
    ],
    branches: ["hondenschool", "trimsalon", "uitlaatservice", "dagopvang"],
    seo: {
      title: "Alles op één plek voor je hondenbedrijf",
      description:
        "Vervang losse tools voor website, agenda, facturen en klantbeheer door één platform voor je hondenbedrijf. Eén inlog, één abonnement, één overzicht.",
      keywords: [
        "alles in één software hondenbedrijf",
        "hondenbedrijf platform",
        "software dierenbedrijf",
        "systeem hondenschool",
        "bedrijfssoftware honden",
      ],
    },
    faq: [
      {
        v: "Moet ik alles tegelijk overzetten?",
        a: "Nee. Veel ondernemers beginnen met website en boeken en zetten daarna facturatie en het klantportaal aan. De modules werken los én samen.",
      },
      {
        v: "Wat gebeurt er met mijn huidige gegevens?",
        a: "Klanten, honden en historie nemen we mee bij het inrichten van je omgeving. Aanleveren mag in het formaat dat je nu hebt.",
      },
      {
        v: "Betaal ik per module?",
        a: "Je kiest de modules die je nodig hebt en betaalt daar één maandbedrag voor. Geen losse abonnementen per onderdeel.",
      },
    ],
  },

  {
    slug: "online-afspraken",
    path: "/online-afspraken-maken",
    titel: "Online afspraken",
    kort: "Een agenda die zichzelf vult, zonder telefoon",
    icon: CalendarDays,
    h1: "Online afspraken maken, zonder één telefoontje.",
    intro:
      "Heen-en-weer appen over een datum kost je per afspraak zo tien minuten. Laat je agenda het werk doen: klanten zien wat kan en kiezen zelf.",
    pijn: {
      titel: "Wat een afspraak je nu kost",
      items: [
        "Vier berichten heen en weer voor één datum",
        "Bellen terwijl je handen in een vacht zitten",
        "Dubbele afspraken door een agenda op papier",
        "Klanten die niet weten hoe lang iets duurt",
        "No-shows omdat er geen herinnering ging",
      ],
    },
    oplossing: {
      titel: "Zo werkt online afspreken",
      stappen: [
        { icon: CalendarCheck, titel: "Klant kiest zelf", tekst: "Uit de momenten die jij beschikbaar hebt gesteld." },
        { icon: ShieldCheck, titel: "Nooit dubbel", tekst: "Een gekozen moment is direct geblokkeerd voor anderen." },
        { icon: Bell, titel: "Bevestiging en herinnering", tekst: "Automatisch, zodat niemand het vergeet." },
        { icon: RefreshCw, titel: "Zelf verzetten", tekst: "Verzetten of annuleren doet de klant binnen jouw regels." },
      ],
    },
    features: [
      "Online agenda",
      "Afspraken per dienst en duur",
      "Openingstijden en pauzes",
      "Automatische bevestiging",
      "Herinneringen",
      "Zelf verzetten en annuleren",
      "Terugkerende afspraken",
      "Wachtlijst bij volle agenda",
    ],
    branches: ["trimsalon", "gedragstherapie", "chipservice", "hondenschool"],
    seo: {
      title: "Online afspraken maken voor je hondenbedrijf",
      description:
        "Laat klanten zelf online een afspraak inplannen bij je trimsalon, gedragspraktijk of hondenschool. Met bevestiging, herinneringen en geen dubbele boekingen.",
      keywords: [
        "online afspraken maken hondenbedrijf",
        "afspraken trimsalon",
        "afsprakensysteem honden",
        "online agenda hondenbedrijf",
        "afspraak inplannen gedragstherapeut hond",
      ],
    },
    faq: [
      {
        v: "Kan een klant zelf verzetten?",
        a: "Ja, binnen de regels die jij bepaalt. Je stelt bijvoorbeeld in dat verzetten tot 48 uur van tevoren mag.",
      },
      {
        v: "Kan ik terugkerende afspraken instellen?",
        a: "Ja. Voor klanten die elke acht weken komen, plan je in één keer de hele reeks in.",
      },
      {
        v: "Zie ik mijn agenda ook op mijn telefoon?",
        a: "Je agenda is overal beschikbaar in de browser, ook onderweg.",
      },
    ],
  },

  {
    slug: "automatische-facturatie",
    path: "/automatische-facturatie",
    titel: "Facturatie automatiseren",
    kort: "Facturen die zichzelf maken en versturen",
    icon: Receipt,
    h1: "Facturatie die zichzelf doet. Ook op de eerste van de maand.",
    intro:
      "Facturen maken is werk dat niemand ziet en dat altijd 's avonds gebeurt. In DogWare komt de factuur voort uit de boeking — je hoeft er niets voor te doen.",
    pijn: {
      titel: "Hoe factureren nu gaat",
      items: [
        "Aan het eind van de maand alle diensten bij elkaar zoeken",
        "Handmatig bedragen en btw uitrekenen",
        "Facturen één voor één mailen",
        "Bijhouden wie betaald heeft in een apart lijstje",
        "Herinneringen die je steeds uitstelt",
      ],
    },
    oplossing: {
      titel: "Zo verloopt het automatisch",
      stappen: [
        { icon: CalendarCheck, titel: "Uit de boeking", tekst: "Elke afspraak, dag of rit levert de juiste regel op de factuur." },
        { icon: FileText, titel: "Correct opgemaakt", tekst: "Btw, nummering en jouw huisstijl kloppen automatisch." },
        { icon: Mail, titel: "Vanzelf verstuurd", tekst: "In de mail en terug te vinden in het klantportaal." },
        { icon: BadgeCheck, titel: "Betaling afgeletterd", tekst: "iDEAL-betalingen worden direct aan de factuur gekoppeld." },
      ],
    },
    features: [
      "Automatische facturatie uit boekingen",
      "Maandfacturen voor abonnementen",
      "Verzamelfacturen per klant",
      "Btw-tarieven per dienst",
      "Doorlopende factuurnummering",
      "Facturen in eigen huisstijl",
      "Betaalstatus en herinneringen",
      "Export voor de boekhouder",
    ],
    branches: ["uitlaatservice", "dagopvang", "hondenschool", "pension"],
    seo: {
      title: "Automatische facturatie voor je hondenbedrijf",
      description:
        "Facturen die automatisch uit je boekingen ontstaan, inclusief btw, maandfacturen voor abonnementen, betaalstatus en herinneringen. Voor elk hondenbedrijf.",
      keywords: [
        "automatische facturatie hondenbedrijf",
        "facturatie hondenschool",
        "facturen uitlaatservice",
        "factuurprogramma hondenbedrijf",
        "maandfactuur hondenopvang",
      ],
    },
    faq: [
      {
        v: "Voldoen de facturen aan de eisen van de Belastingdienst?",
        a: "Ja. Factuurnummer, datum, je gegevens, de gegevens van de klant, de omschrijving en het btw-bedrag staan er allemaal op.",
      },
      {
        v: "Kan ik meerdere diensten op één factuur zetten?",
        a: "Ja. Voor klanten die meerdere diensten afnemen maak je een verzamelfactuur per maand.",
      },
      {
        v: "Kan ik mijn eigen factuurnummering aanhouden?",
        a: "Je stelt zelf in met welk nummer de reeks begint, zodat hij aansluit op je bestaande administratie.",
      },
    ],
  },

  {
    slug: "webshop-toevoegen",
    path: "/webshop-toevoegen",
    titel: "Webshop toevoegen",
    kort: "Producten verkopen naast je diensten",
    icon: ShoppingCart,
    h1: "Een webshop toevoegen, zonder tweede systeem.",
    intro:
      "Je verkoopt waarschijnlijk al iets: een riem, een zak brokken, een cadeaubon. Zet het in je eigen webshop, in dezelfde omgeving waar je klanten toch al boeken.",
    pijn: {
      titel: "Waarom een losse webshop tegenvalt",
      items: [
        "Een tweede abonnement voor iets wat je er even bij doet",
        "Klanten die opnieuw een account moeten maken",
        "Voorraad die je op twee plekken bijhoudt",
        "Bestellingen die buiten je administratie vallen",
        "Een webshop die er anders uitziet dan je site",
      ],
    },
    oplossing: {
      titel: "Zo werkt de webshop van DogWare",
      stappen: [
        { icon: Package, titel: "Producten klaarzetten", tekst: "Met varianten, prijzen, foto's en voorraad." },
        { icon: ShoppingCart, titel: "Bestellen in dezelfde site", tekst: "Zelfde inlog, zelfde uitstraling, zelfde winkelwagen." },
        { icon: CreditCard, titel: "Direct betaald", tekst: "iDEAL bij het afrekenen, factuur volgt automatisch." },
        { icon: Table2, titel: "In één administratie", tekst: "Bestellingen staan bij dezelfde klant als zijn afspraken." },
      ],
    },
    features: [
      "Producten en varianten",
      "Voorraadbeheer",
      "Winkelwagen en afrekenen",
      "iDEAL-betalingen",
      "Verzenden of afhalen",
      "Cadeaubonnen",
      "Kortingscodes",
      "Bestellingen en pakbonnen",
    ],
    branches: ["webshop", "trimsalon", "hondenschool", "dagopvang"],
    seo: {
      title: "Webshop toevoegen aan je hondenbedrijf",
      description:
        "Voeg een webshop toe aan je hondenschool, trimsalon of opvang. Producten, voorraad, iDEAL en cadeaubonnen in dezelfde omgeving als je agenda en klanten.",
      keywords: [
        "webshop toevoegen hondenbedrijf",
        "webshop hondenschool",
        "webshop trimsalon",
        "producten verkopen hondenbedrijf",
        "cadeaubon hondenbedrijf",
      ],
    },
    faq: [
      {
        v: "Kan ik cadeaubonnen verkopen?",
        a: "Ja, en ze zijn te verzilveren op producten én op je diensten, zoals een trimbeurt of een cursus.",
      },
      {
        v: "Moet ik verzenden?",
        a: "Nee. Je kiest zelf voor verzenden, afhalen of allebei. Veel bedrijven laten klanten afhalen bij hun eerstvolgende afspraak.",
      },
      {
        v: "Wordt de voorraad automatisch bijgewerkt?",
        a: "Ja. Elke verkoop schrijft af, en je ziet welke producten bijna op zijn.",
      },
    ],
  },
];

export const NEED_BY_PATH = new Map<string, Need>(
  NEEDS.map((n) => [n.path.replace(/^\//, ""), n]),
);

export function getNeed(slug: string): Need | null {
  return NEED_BY_PATH.get(slug) ?? null;
}

/** Niet gebruikt in de kaarten, maar handig als losse icoonverwijzing. */
export const SEARCH_ICON = Search;
