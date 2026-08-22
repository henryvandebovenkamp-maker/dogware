import { legalEntity, entityAddressLine } from "@/lib/legal-entity";

/**
 * De DogWare-samenwerkingsovereenkomst, met versiebeheer.
 *
 * Opgezet naar het model van de OneDaySite-overeenkomst (hoofdstukken →
 * artikelen, één builder per versie, een versieregister met een actieve
 * versie), maar met een eigen tekst: DogWare is het merk, OneDaySite de
 * contractpartij, en de hondenbranche de context.
 *
 * De reden voor versiebeheer is niet netheid maar noodzaak: een reeds
 * ondertekende overeenkomst moet over jaren nog exact dezelfde tekst tonen.
 * Een nieuwe versie voeg je toe aan CONTRACT_VERSIONS; ACTIVE_CONTRACT_VERSION
 * bepaalt wat nieuwe overeenkomsten krijgen. Bestaande blijven staan.
 *
 * Client-safe: puur data + pure functies.
 */

export interface Article {
  n: string;
  title: string;
  paragraphs: string[];
}
export interface Chapter {
  n: number;
  title: string;
  articles: Article[];
}

/** Alles wat de tekst nodig heeft om de afspraak concreet te maken. */
export interface AgreementContext {
  /** Bedrijfsnaam van de opdrachtgever */
  company: string;
  /** Gekozen modules/diensten, leesbaar */
  modules: string[];
  /** Omschrijving van de werkzaamheden, leesbaar */
  werkzaamheden: string[];
  setupExclLabel: string;
  setupInclLabel: string;
  vatPercent: number;
  monthlyExclLabel: string;
  monthlyInclLabel: string;
  depositLabel: string;
  depositPercent: number;
  finalLabel: string;
  finalPercent: number;
  freeMonths: number;
  /** Menselijke omschrijving van wanneer het abonnement start */
  subscriptionStartLabel: string;
  /** Afwijkende afspraken die de beheerder heeft vastgelegd (mag leeg zijn) */
  bijzonderheden?: string | null;
}

/** Vaste beheer- en contractvoorwaarden — één bron van waarheid. */
export const MAINTENANCE = {
  /** Minimale contractduur (maanden) vanaf oplevering */
  minContractMonths: 12,
  /** Opzegtermijn (maanden) na het eerste contractjaar */
  noticeMonths: 1,
} as const;

function nl(n: number): string {
  const woorden = ["nul", "één", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf"];
  return woorden[n] ?? String(n);
}

function opsomming(items: string[], leeg: string): string {
  const schoon = items.map((i) => i.trim()).filter(Boolean);
  return schoon.length ? schoon.join(", ") : leeg;
}

/**
 * Zet de maatwerkafspraken om in losse, genummerde artikelen.
 *
 * Conventie: een lege regel begint een nieuwe bepaling. Eindigt de eerste
 * regel van zo'n blok op een dubbele punt, dan is dat de kop van het artikel.
 *
 * Reden: afwijkende afspraken zijn contractueel het zwaarst — ze gaan vóór op
 * de standaardtekst. Als één blok tekst zijn ze slecht te lezen en slecht aan
 * te wijzen ("artikel 11.3" bestaat dan niet). Als losse artikelen zijn ze dat
 * wel.
 */
function maatwerkArtikelen(bijzonderheden: string, hoofdstuk: number): Article[] {
  const blokken = bijzonderheden
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const artikelen: Article[] = [
    {
      n: `${hoofdstuk}.1`,
      title: "Voorrang",
      paragraphs: [
        "In aanvulling op het bovenstaande zijn de volgende afspraken gemaakt. Bij tegenstrijdigheid met de voorgaande artikelen gaan deze aanvullende afspraken voor.",
      ],
    },
  ];

  blokken.forEach((blok, i) => {
    const regels = blok.split("\n").map((r) => r.trim()).filter(Boolean);
    const heeftKop = regels.length > 1 && regels[0].endsWith(":");
    artikelen.push({
      n: `${hoofdstuk}.${i + 2}`,
      title: heeftKop ? regels[0].replace(/:$/, "") : "Afwijkende afspraak",
      paragraphs: heeftKop ? regels.slice(1) : regels,
    });
  });

  return artikelen;
}

/* =========================================================================
 * Versie 1.0 (actief)
 * ========================================================================= */

function buildV1(ctx: AgreementContext): Chapter[] {
  const modulesText = opsomming(ctx.modules, "de in het voorstel opgenomen onderdelen");
  const werkText = opsomming(ctx.werkzaamheden, "de in het voorstel omschreven werkzaamheden");

  const chapters: Chapter[] = [
    {
      n: 1,
      title: "Partijen en overeenkomst",
      articles: [
        {
          n: "1.1",
          title: "Partijen",
          paragraphs: [
            `Deze samenwerkingsovereenkomst wordt aangegaan tussen ${legalEntity.name}, gevestigd te ${entityAddressLine()} (hierna: "Opdrachtnemer"), en ${ctx.company} (hierna: "Opdrachtgever").`,
            `DogWare is het platform en de handelsnaam waaronder Opdrachtnemer zijn dienstverlening aan hondenprofessionals levert. Waar in deze overeenkomst "DogWare" staat, wordt de door Opdrachtnemer geleverde dienst bedoeld; de contracterende en facturerende partij is ${legalEntity.name}.`,
            "Door ondertekening verklaren beide partijen akkoord te gaan met de in deze overeenkomst opgenomen voorwaarden.",
          ],
        },
        {
          n: "1.2",
          title: "Voorwerp van de overeenkomst",
          paragraphs: [
            "Opdrachtnemer ontwikkelt, levert en onderhoudt voor Opdrachtgever een website en digitaal platform met de bijbehorende diensten, zoals omschreven in het voorstel waarvan deze overeenkomst onlosmakelijk onderdeel uitmaakt.",
            "Bij tegenstrijdigheid tussen het voorstel en deze overeenkomst gaat de tekst van deze overeenkomst voor, met uitzondering van de bedragen en de omvang van de opdracht: die volgen altijd de voorstelversie waarnaar deze overeenkomst verwijst.",
          ],
        },
      ],
    },
    {
      n: 2,
      title: "De dienstverlening",
      articles: [
        {
          n: "2.1",
          title: "Omvang",
          paragraphs: [
            `De dienstverlening omvat de in het voorstel gekozen onderdelen: ${modulesText}.`,
            `De overeengekomen werkzaamheden betreffen: ${werkText}.`,
            "Opdrachtnemer levert het platform op als een werkend geheel, inclusief de benodigde inrichting, koppelingen en oplevering.",
          ],
        },
        {
          n: "2.2",
          title: "Medewerking Opdrachtgever",
          paragraphs: [
            "Opdrachtgever levert tijdig de benodigde content, gegevens, beeldmateriaal en feedback aan. Vertraging in aanlevering kan de oplevertermijn beïnvloeden.",
          ],
        },
        {
          n: "2.3",
          title: "Oplevering",
          paragraphs: [
            "Oplevering vindt plaats na afronding van de bouwfase en de overeengekomen feedbackronde(s), mits Opdrachtgever de benodigde content en gegevens tijdig heeft aangeleverd. De opgegeven doorlooptijd is een inspanningsverplichting en kan in onderling overleg worden bijgesteld.",
            "De website gaat live nadat de tweede termijn is voldaan.",
          ],
        },
      ],
    },
    {
      n: 3,
      title: "Eigendom en rechten",
      articles: [
        {
          n: "3.1",
          title: "Eigendom van data",
          paragraphs: [
            "Opdrachtgever blijft te allen tijde volledig eigenaar van alle data die in en via het platform wordt verwerkt en opgeslagen, waaronder klant-, hond- en boekingsgegevens.",
          ],
        },
        {
          n: "3.2",
          title: "Eigendom van inhoud",
          paragraphs: [
            "Opdrachtgever blijft eigenaar van alle inhoud van de website: teksten, afbeeldingen, logo's en overige content.",
          ],
        },
        {
          n: "3.3",
          title: "Eigendom van het domein",
          paragraphs: [
            "Het domein staat op naam van Opdrachtgever en blijft eigendom van Opdrachtgever. Opdrachtnemer verzorgt uitsluitend de technische koppeling en instellingen.",
          ],
        },
        {
          n: "3.4",
          title: "Gebruiksrecht",
          paragraphs: [
            "Gedurende de looptijd van het abonnement verkrijgt Opdrachtgever een niet-exclusief gebruiksrecht op het DogWare-platform en de onderliggende software van Opdrachtnemer.",
          ],
        },
      ],
    },
    {
      n: 4,
      title: "Hosting, beveiliging en gegevensbeheer",
      articles: [
        {
          n: "4.1",
          title: "Infrastructuur",
          paragraphs: [
            "Het platform draait op moderne cloudinfrastructuur. Opdrachtnemer host de website en applicatie op Vercel, in combinatie met het Next.js-framework, waardoor pagina's dicht bij de bezoeker worden geserveerd.",
            "Gegevens worden opgeslagen in een Neon PostgreSQL-database. Deze database is niet publiek toegankelijk en uitsluitend bereikbaar vanuit het platform via een versleutelde verbinding.",
          ],
        },
        {
          n: "4.2",
          title: "Verwerkte diensten van derden",
          paragraphs: [
            "Voor bestandsopslag, transactionele e-mail en betalingen maakt Opdrachtnemer gebruik van gespecialiseerde diensten. Betalingen verlopen via Mollie; e-mail via Resend; bestanden via UploadThing.",
            "Deze diensten zijn hulpmiddelen van derden en geen eigendom van Opdrachtnemer.",
          ],
        },
        {
          n: "4.3",
          title: "Veilige verbindingen en toegangsbeheer",
          paragraphs: [
            "Alle gegevens worden versleuteld verzonden via HTTPS. Toegang tot beheeromgevingen is beperkt tot geautoriseerde gebruikers; iedere gebruiker krijgt uitsluitend toegang tot de onderdelen die bij zijn of haar rol horen.",
            "Formulieren en betalingen worden server-side gevalideerd voordat ze worden verwerkt of opgeslagen. Bedragen worden nooit uit de browser overgenomen.",
          ],
        },
        {
          n: "4.4",
          title: "Updates en monitoring",
          paragraphs: [
            "Opdrachtnemer voert structureel updates en beveiligingspatches uit, monitort systemen en prestaties en signaleert storingen. Hosting, updates en beveiliging zijn inbegrepen zolang het abonnement actief is.",
          ],
        },
      ],
    },
    {
      n: 5,
      title: "Beheer, ondersteuning en meerwerk",
      articles: [
        {
          n: "5.1",
          title: "Zelfbeheer",
          paragraphs: [
            "Opdrachtgever beheert de inhoud van de website zelf via de beheeromgeving en kan daarin zonder meerkosten onbeperkt teksten, afbeeldingen, openingstijden, contactgegevens, teamleden, veelgestelde vragen en overige content wijzigen. Er geldt geen maximum op het aantal aanpassingen.",
          ],
        },
        {
          n: "5.2",
          title: "Inbegrepen ondersteuning",
          paragraphs: [
            "Bij een actief abonnement is persoonlijke ondersteuning inbegrepen: hulp bij inloggen en toegang, vragen over het gebruik van de beheeromgeving, en het melden en verhelpen van technische storingen aan de geleverde dienst.",
          ],
        },
        {
          n: "5.3",
          title: "Meerwerk",
          paragraphs: [
            "Werkzaamheden die verder gaan dan het beheren van bestaande inhoud gelden als meerwerk. Hieronder vallen onder meer: nieuwe pagina's of paginatypes, nieuwe functionaliteiten, extra formulieren, koppelingen en integraties, nieuwe automatiseringen, maatwerk-programmeerwerk, databasewijzigingen en grote ontwerpwijzigingen.",
            "Voor meerwerk verstrekt Opdrachtnemer vooraf altijd een offerte of prijsindicatie. Meerwerk wordt pas uitgevoerd na akkoord van Opdrachtgever; er worden nooit onverwachte kosten in rekening gebracht.",
          ],
        },
      ],
    },
    {
      n: 6,
      title: "Vergoeding en betaling",
      articles: [
        {
          n: "6.1",
          title: "Eenmalige investering",
          paragraphs: [
            `De eenmalige investering bedraagt ${ctx.setupExclLabel} exclusief btw, oftewel ${ctx.setupInclLabel} inclusief ${ctx.vatPercent}% btw.`,
            `Hiervan is ${ctx.depositPercent}% (${ctx.depositLabel} inclusief btw) verschuldigd bij het aangaan van deze overeenkomst, vóór aanvang van de bouwfase. De resterende ${ctx.finalPercent}% (${ctx.finalLabel} inclusief btw) is verschuldigd bij oplevering, voorafgaand aan de livegang.`,
          ],
        },
        {
          n: "6.2",
          title: "Maandelijks abonnement",
          paragraphs: [
            `Het DogWare-abonnement bedraagt ${ctx.monthlyExclLabel} exclusief btw, oftewel ${ctx.monthlyInclLabel} inclusief btw per maand.`,
            ctx.freeMonths > 0
              ? `De eerste ${nl(ctx.freeMonths)} ${ctx.freeMonths === 1 ? "maand is" : "maanden zijn"} kosteloos. ${ctx.subscriptionStartLabel}`
              : ctx.subscriptionStartLabel,
            "Opdrachtgever gaat met de ondertekening van deze overeenkomst uitdrukkelijk akkoord met dit maandbedrag, ook al vangt de incasso pas later aan.",
          ],
        },
        {
          n: "6.3",
          title: "Automatische incasso",
          paragraphs: [
            "Het maandbedrag wordt automatisch geïncasseerd. Opdrachtgever verleent Opdrachtnemer hiertoe een doorlopende machtiging via Mollie.",
            "De machtiging wordt technisch geactiveerd bij de betaling van de tweede termijn. Vanaf dat moment kan de maandelijkse incasso plaatsvinden volgens het in artikel 6.2 bepaalde startmoment; niet eerder.",
            "Lukt een incasso niet, dan informeert Opdrachtnemer Opdrachtgever en kan het bedrag alsnog handmatig worden voldaan.",
          ],
        },
        {
          n: "6.4",
          title: "Transactiekosten",
          paragraphs: [
            "Transactiekosten van Mollie zijn niet in de genoemde bedragen inbegrepen.",
          ],
        },
      ],
    },
    {
      n: 7,
      title: "Contractduur en opzegging",
      articles: [
        {
          n: "7.1",
          title: "Minimale contractduur",
          paragraphs: [
            `Het abonnement wordt aangegaan voor een minimale duur van ${nl(MAINTENANCE.minContractMonths)} maanden, gerekend vanaf de opleverdatum. Gedurende deze periode kan het abonnement niet tussentijds worden beëindigd.`,
          ],
        },
        {
          n: "7.2",
          title: "Voortzetting en opzegging",
          paragraphs: [
            `Na afloop van deze eerste periode wordt de overeenkomst automatisch voortgezet voor onbepaalde tijd, met een opzegtermijn van ${nl(MAINTENANCE.noticeMonths)} kalendermaand. Opzeggen kan schriftelijk of per e-mail.`,
          ],
        },
      ],
    },
    {
      n: 8,
      title: "Aansprakelijkheid",
      articles: [
        {
          n: "8.1",
          title: "Beperking",
          paragraphs: [
            "De aansprakelijkheid van Opdrachtnemer is per gebeurtenis beperkt tot maximaal het bedrag van de eenmalige investering zoals genoemd in artikel 6.1. Een reeks samenhangende gebeurtenissen geldt als één gebeurtenis.",
          ],
        },
        {
          n: "8.2",
          title: "Uitsluitingen",
          paragraphs: [
            "Opdrachtnemer is niet aansprakelijk voor indirecte schade, gevolgschade, of schade die voortvloeit uit onjuist of onvolledig door Opdrachtgever aangeleverde gegevens.",
          ],
        },
      ],
    },
    {
      n: 9,
      title: "Gegevensbescherming",
      articles: [
        {
          n: "9.1",
          title: "Verwerking persoonsgegevens",
          paragraphs: [
            "Voor zover Opdrachtnemer persoonsgegevens verwerkt in het kader van deze dienstverlening, gebeurt dit conform de Algemene Verordening Gegevensbescherming (AVG).",
          ],
        },
        {
          n: "9.2",
          title: "Data-export en dataretentie",
          paragraphs: [
            "Opdrachtgever kan te allen tijde een export van zijn gegevens opvragen in een gangbaar, herbruikbaar formaat.",
            "Na beëindiging van de overeenkomst worden de gegevens gedurende negentig dagen bewaard zodat export of overdracht mogelijk blijft. Daarna worden ze definitief verwijderd, behoudens een wettelijke bewaarplicht.",
          ],
        },
      ],
    },
    {
      n: 10,
      title: "Slotbepalingen",
      articles: [
        {
          n: "10.1",
          title: "Wijzigingen",
          paragraphs: [
            "Wijzigingen van deze overeenkomst zijn uitsluitend geldig indien schriftelijk overeengekomen. Een wijziging in de opdracht of de bedragen leidt tot een nieuwe voorstelversie en een nieuwe overeenkomst; de reeds ondertekende overeenkomst blijft ongewijzigd bewaard.",
          ],
        },
        {
          n: "10.2",
          title: "Toepasselijk recht",
          paragraphs: [
            `Op deze overeenkomst is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar ${legalEntity.name} is gevestigd.`,
          ],
        },
      ],
    },
  ];

  // Afwijkende afspraken staan bewust achteraan als eigen hoofdstuk, zodat de
  // standaardtekst één bron van waarheid blijft en maatwerk zichtbaar is.
  const bijzonder = ctx.bijzonderheden?.trim();
  if (bijzonder) {
    chapters.push({
      n: 11,
      title: "Aanvullende afspraken",
      articles: maatwerkArtikelen(bijzonder, 11),
    });
  }

  return chapters;
}

/* =========================================================================
 * Versieregister
 * ========================================================================= */

export interface ContractVersion {
  id: string;
  name: string;
  number: string;
  /** Ingangsdatum (ISO) */
  effectiveDate: string;
  build: (ctx: AgreementContext) => Chapter[];
}

export const CONTRACT_VERSIONS: ContractVersion[] = [
  {
    id: "dw-1.0",
    name: "DogWare Samenwerkingsovereenkomst v1.0",
    number: "1.0",
    effectiveDate: "2026-08-22",
    build: buildV1,
  },
];

/** De versie die nieuwe overeenkomsten krijgen. */
export const ACTIVE_CONTRACT_VERSION = "dw-1.0";

const BY_ID = new Map(CONTRACT_VERSIONS.map((v) => [v.id, v]));

/**
 * Resolveert een versie-id. Een onbekende of ontbrekende versie valt terug op
 * de OUDSTE versie, niet de nieuwste: een bestaande overeenkomst mag nooit
 * ineens nieuwe tekst tonen.
 */
export function resolveContractVersion(versionId?: string | null): ContractVersion {
  if (versionId && BY_ID.has(versionId)) return BY_ID.get(versionId)!;
  return CONTRACT_VERSIONS[0];
}

export function buildAgreement(
  ctx: AgreementContext,
  versionId: string = ACTIVE_CONTRACT_VERSION,
): Chapter[] {
  return resolveContractVersion(versionId).build(ctx);
}

/** Leesbare ingangsdatum van een contractversie. */
export function contractVersionDateLabel(versionId?: string | null): string {
  return new Date(resolveContractVersion(versionId).effectiveDate).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * De punten waar de klant vóór ondertekenen expliciet mee akkoord gaat.
 * Eén bron van waarheid voor het ondertekenformulier én voor wat we in de
 * overeenkomst vastleggen — zodat die twee niet uit elkaar kunnen lopen.
 */
export const CONSENT_KEYS = [
  "agreesOpdracht",
  "agreesInvestering",
  "agreesTermijnen",
  "agreesMaandbedrag",
  "agreesVoorwaarden",
  "agreesBevoegd",
] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export function consentLabels(ctx: {
  setupExclLabel: string;
  depositLabel: string;
  depositPercent: number;
  finalLabel: string;
  finalPercent: number;
  monthlyExclLabel: string;
  versionLabel: string;
}): Record<ConsentKey, string> {
  return {
    agreesOpdracht: "Ik ga akkoord met de opdracht zoals omschreven in het voorstel.",
    agreesInvestering: `Ik ga akkoord met de eenmalige investering van ${ctx.setupExclLabel} excl. btw.`,
    agreesTermijnen: `Ik ga akkoord met de betaling in twee termijnen: ${ctx.depositPercent}% (${ctx.depositLabel} incl. btw) nu en ${ctx.finalPercent}% (${ctx.finalLabel} incl. btw) bij oplevering.`,
    agreesMaandbedrag: `Ik ga akkoord met de maandelijkse DogWare-kosten van ${ctx.monthlyExclLabel} excl. btw en met automatische incasso daarvan.`,
    agreesVoorwaarden: `Ik heb de ${ctx.versionLabel} gelezen en ga daarmee akkoord.`,
    agreesBevoegd: "Ik ben bevoegd om namens dit bedrijf te tekenen.",
  };
}
