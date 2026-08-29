/**
 * De bouwprompt — de complete opdracht voor een nieuwe klantomgeving,
 * geschreven uit de aanvraag die op dat moment in Dogware staat.
 *
 * Bij een nieuwe klant schrijf je in een eigen klantproject de website en zet
 * je de omgeving op. De opdracht daarvoor was elke keer handwerk: dezelfde
 * architectuur- en kwaliteitsregels overtypen met de gegevens van déze aanvraag
 * ertussen. Dit bestand doet dat.
 *
 * Twee lagen:
 *   laag A — de vaste Dogware-regels, in ./regels.ts;
 *   laag B — deze aanvraag, hieronder samengesteld uit de databaserij.
 *
 * De aanvraag is de enige bron. Er wordt niets opgeslagen en niets bevroren:
 * wijzig je morgen de plaats of voeg je een dienst toe, dan zegt de prompt dat
 * morgen ook. Geen AI ertussen, geen datum, geen willekeur — dezelfde aanvraag
 * geeft twee keer exact dezelfde tekst, zodat een verschil tussen twee prompts
 * altijd een verschil in de aanvraag ís.
 *
 * Wat hier NIET gebeurt: iets aanmaken. Geen map, geen repository, geen
 * database, geen Vercel-project, geen e-mail. Dit levert tekst op.
 *
 * Client-safe: geen server-only imports.
 */

import type { Lead } from "@/lib/db/schema";
import * as regels from "./regels";
import {
  FUNCTIE_ANKERS,
  MODULES,
  koppelDiensten,
  omgevingType,
  projectSlug,
  type Modulekeuze,
} from "./modules";

/** Wat de intake bedoelt met heeftWebsite. */
const WEBSITE_STATUS: Record<string, string> = {
  nee: "De klant heeft nog geen website.",
  ja: "De klant heeft een website en wil daarop verder bouwen.",
  "ja-nieuw": "De klant heeft een website, maar wil iets nieuws.",
};

/**
 * Ontbrekende velden mogen nooit als `undefined`, `null` of een lege regel in
 * de prompt komen: dat leest als een fout en zegt niets. "Niet aangeleverd"
 * zegt wél iets — namelijk dat er niets over bekend is en dat het dus ook niet
 * verzonnen mag worden.
 */
const ONBEKEND = "Niet aangeleverd.";

function tekst(waarde: string | null | undefined): string {
  const schoon = waarde?.trim();
  return schoon ? schoon : ONBEKEND;
}

/** Een opsomming, of `ONBEKEND` als er niets is aangevinkt. */
function lijst(items: readonly (string | null | undefined)[]): string {
  const schoon = items
    .map((i) => i?.trim())
    .filter((i): i is string => Boolean(i));
  if (schoon.length === 0) return ONBEKEND;
  return schoon.map((i) => `- ${i}`).join("\n");
}

/** Een `Label: waarde`-regel die verdwijnt als er geen waarde is. */
function regel(label: string, waarde: string | null | undefined): string | null {
  const schoon = waarde?.trim();
  return schoon ? `${label}: ${schoon}` : null;
}

function blok(regels: (string | null)[]): string {
  const schoon = regels.filter((r): r is string => Boolean(r));
  return schoon.length > 0 ? schoon.join("\n") : ONBEKEND;
}

/* ───────────────────────────────────────────────────── laag B — de aanvraag ─ */

/**
 * De kop: wie is dit, en bouwen we een voorbeeld of het echte werk.
 *
 * Het type staat hier omdat het alles erna kleurt. Een demo die per ongeluk
 * echte mail verstuurt of een incasso start, is een fout die je niet meer kunt
 * terugnemen.
 */
function kop(lead: Lead, keuze: Modulekeuze): string {
  const omgeving = omgevingType(lead);

  const gevolg =
    omgeving.type === "DEMO"
      ? `Dit is een voorbeeldomgeving. Geen echte incasso's, geen
productiebetalingen, geen mail naar echte klanten van deze ondernemer, geen
echte klantgegevens invoeren — tenzij daar expliciet om gevraagd wordt.
Gebruik testsleutels waar die bestaan.`
      : `Dit is een productieomgeving. Er gaat straks een bedrijf op draaien.
Voer alle productiecontroles uit voordat je livegang als voltooid beschouwt:
eigen betaalconfiguratie, geverifieerd e-maildomein, werkende migraties,
werkende beheerderslogin en een gekoppeld domein.`;

  return `# NIEUWE DOGWARE KLANT

BEDRIJF:
${tekst(lead.bedrijfsnaam)}

TYPE:
${omgeving.type} — ${omgeving.reden}

CONTACTPERSOON:
${tekst(lead.naam)}

E-MAIL:
${tekst(lead.email)}

TELEFOON:
${tekst(lead.telefoon)}

PLAATS:
${tekst(lead.plaats)}

BESTAANDE WEBSITE:
${tekst(lead.website)}

DIENSTEN:
${lijst(keuze.koppelingen.map((k) => k.dienst))}

GEWENSTE FUNCTIONALITEIT:
${lijst(lead.functies)}

${gevolg}`;
}

/** De eigen map en de eigen reponaam, afgeleid uit de bedrijfsnaam. */
function projectmap(lead: Lead): string {
  const slug = projectSlug(lead.bedrijfsnaam, lead.id);

  return `## 3. EIGEN LOKALE PROJECTMAP

Werk NIET in de map van Dogware zelf en NIET in de map van een bestaande klant.
Maak een eigen map voor deze klant, naast de andere klantprojecten, volgens de
naamgeving die daar al gebruikt wordt.

Voorgestelde naam voor map en repository: \`${slug}\`

Wijkt de bestaande naamgeving hiervan af, volg dan die bestaande naamgeving.

Controleer eerst of de map en de repository al bestaan. Bestaat de omgeving al,
initialiseer dan niet opnieuw en overschrijf niets: kijk wat er staat en meld
wat je aantreft voordat je verdergaat.`;
}

/** De bedrijfsgegevens die we kennen, zodat ze op één plek terechtkomen. */
function bedrijfsconfiguratie(lead: Lead): string {
  return `## 8. EIGEN BEDRIJFSCONFIGURATIE

Alle bedrijfsgegevens komen in de centrale configuratie van dit project, zoals
Dogware dat al doet. Verspreid de bedrijfsnaam, het adres of het telefoonnummer
niet hardgecodeerd over componenten — één plek aanpassen moet genoeg zijn.

Wat we uit de aanvraag weten:

${blok([
  regel("Bedrijfsnaam", lead.bedrijfsnaam),
  regel("Contactpersoon", lead.naam),
  regel("E-mail", lead.email),
  regel("Telefoon", lead.telefoon),
  regel("Plaats", lead.plaats),
  regel("Website", lead.website),
  regel("Heeft al een logo", lead.heeftLogo === "ja" ? "Ja" : lead.heeftLogo === "nee" ? "Nee" : null),
])}

Wat er verder in die configuratie hoort — adres, logo, favicon, kleuren,
domein, socials, metadata en de mailafzender — vul je met wat er bevestigd is.
Wat ontbreekt, laat je leeg met een zichtbare TODO. Niet invullen met iets
plausibels.`;
}

/**
 * Welke modules aan mogen, en welke uit moeten blijven.
 *
 * Dat tweede is het punt: de code van alle modules zit in de master, dus
 * "staat er al" is geen reden om iets aan te zetten. Deze klant heeft om één
 * ding gevraagd en hoort één ding te krijgen.
 */
function modules(keuze: Modulekeuze): string {
  const gekoppeld = keuze.koppelingen.filter((k) => k.module !== null);

  const activeer =
    keuze.actief.length > 0
      ? keuze.actief.map((m) => `- ${MODULES[m]} (${m})`).join("\n")
      : "Geen enkele module — er is geen aangevraagde dienst die aan een\nbestaande Dogware-module te koppelen is.";

  const herkomst =
    gekoppeld.length > 0
      ? `\nGekoppeld vanuit de intake:\n${gekoppeld
          .map((k) => `- "${k.dienst}" → ${MODULES[k.module!]} (${k.module})`)
          .join("\n")}\n`
      : "";

  const onbekend =
    keuze.ongekoppeld.length > 0
      ? `

Voor deze opgegeven dienst${keuze.ongekoppeld.length > 1 ? "en" : ""} is geen bevestigde bestaande Dogware-module gevonden:

${keuze.ongekoppeld.map((d) => `- ${d}`).join("\n")}

Onderzoek eerst de bestaande architectuur van de master die je zojuist hebt
opgehaald. Koppel deze dienst niet aan een module die er toevallig een beetje
op lijkt, en bouw er ook niet blind een nieuwe module voor. Meld wat je vindt
en wacht op een beslissing.`
      : "";

  return `## 10. MODULES: ALLEEN WAT IS AANGEVRAAGD

ACTIVEER:
${activeer}
${herkomst}
LAAT UITGESCHAKELD:
${keuze.uitgeschakeld.map((m) => `- ${MODULES[m]} (${m})`).join("\n")}

Die tweede lijst is geen restje. De code van die modules zit in de master, maar
deze klant heeft er niet om gevraagd: ze horen niet in het menu, niet in de
routes, niet in de e-mails en niet in de beheeromgeving.

Activeer uitsluitend de diensten die uit de klantintake volgen.

Alle geselecteerde diensten moeten volledig gekoppeld zijn aan hun bestaande
Dogware-module en relevante automatische e-mails. Aan betekent hier: de
beheerpagina's, de navigatie, de aanvraag- of boekingsflow, het klantportaal, de
personeelskant, de facturatie en de bijbehorende automatische e-mails doen het
echt. Een module die alleen in het menu staat is niet geleverd.

Niet-geselecteerde diensten mogen niet operationeel zichtbaar of beschikbaar
zijn en mogen geen dienstspecifieke automatische e-mails versturen. Een
verborgen menu-item is daarvoor niet genoeg: een rechtstreeks ingetypt adres,
een oude geplande taak of een API-aanroep hoort er evenmin langs te komen. De
master regelt dit centraal — het moduleregister met requireModule voor de
routes, de modulepoort voor de e-mail en cronModuleGuard voor de
achtergrondtaken. Gebruik die, en schrijf geen eigen controle per scherm.

Generieke e-mail blijft hier buiten: account, inloglink, factuur, betaling en
contact horen bij geen enkele dienst en mogen nooit stilvallen doordat een
module uitstaat.

Controleer dit expliciet tijdens de eindtest.${onbekend}`;
}

/** De gewenste functies — eerst zoeken, dan pas bouwen. */
function functies(lead: Lead): string {
  if (lead.functies.length === 0) {
    return `## 11. GEWENSTE FUNCTIONALITEIT

De klant heeft geen specifieke functiewensen aangevinkt.

Bouw dus niet vast een klantportaal, betaalflow of personeelsomgeving "omdat
het kan". Lever wat bij de aangevraagde diensten hoort, en vraag de rest na.`;
  }

  const wensen = lead.functies
    .map((f) => {
      const anker = FUNCTIE_ANKERS[f];
      return anker ? `- ${f} — zoek in ${anker}` : `- ${f}`;
    })
    .join("\n");

  return `## 11. GEWENSTE FUNCTIONALITEIT

Dit heeft de klant aangevinkt:

${wensen}

Voor elk van deze wensen geldt dezelfde volgorde: zoek eerst in de
Dogware-master die je hebt opgehaald of het er al staat. Staat het er, hergebruik
het dan — inclusief de bijbehorende database-, mail- en portaalstructuur. Bouw
niets opnieuw naast iets dat al werkt.

Staat het er niet, bouw het dan niet zomaar en meld het als openstaand punt.
Wat hier hoort te zitten is een beslissing over de master, niet iets dat in het
project van één klant thuishoort.`;
}

/** Het gedeelte over de bestaande website — alleen onderzoeken als hij er is. */
function bestaandeWebsite(lead: Lead): string {
  const url = lead.website?.trim();
  const status = lead.heeftWebsite ? WEBSITE_STATUS[lead.heeftWebsite] : null;

  if (!url) {
    return `## 12. BESTAANDE WEBSITE

${blok([status, "Er is geen bevestigde website-URL aangeleverd."])}

Zoek niet op goed geluk een website met dezelfde bedrijfsnaam en neem geen
gegevens over van een bedrijf waarvan je niet zeker weet dat het deze klant is.

Alle inhoud over dit bedrijf komt dus uit de intake hierboven, of moet bij de
klant worden opgevraagd.`;
  }

  return `## 12. BESTAANDE WEBSITE

${blok([`URL: ${url}`, status])}

Dit is de door de klant bevestigde bestaande website. Analyseer die op
bedrijfsinformatie, tone of voice, dienstverlening, fotografie en merkcontext.

Die website is de bron voor de INHOUD, niet voor het ontwerp. Neem het oude
uiterlijk dus niet over — alleen de feiten die er staan.`;
}

/** Alles wat de klant verder heeft ingevuld, ongefilterd doorgegeven. */
function overigeIntake(lead: Lead): string {
  const software =
    lead.software.length > 0
      ? `Wat de klant daar nu voor gebruikt:\n${lijst(lead.software)}`
      : `Welke software de klant nu gebruikt: ${ONBEKEND}`;

  return `## 13. DE REST VAN DE INTAKE

Wat er nu misgaat op de huidige website:

${blok([
  regel("Wat de klant mist", lead.websiteMist),
  regel("Wat er nu wél goed werkt", lead.websiteGoed),
])}

Grootste tijdverspillers:

${lijst(lead.tijdvreters)}

${software}

${lead.droomscenario?.trim() ? `Het droomscenario, in de eigen woorden van de klant:\n"${lead.droomscenario.trim()}"\n` : ""}
Over de gewenste uitstraling:

${blok([
  regel("Inspiratie die de klant noemde", lead.inspiratie),
  regel("Over de huisstijl", lead.huisstijl),
  regel("Opmerkingen bij de aanvraag", lead.opmerkingen),
  lead.uploads.length > 0
    ? `Meegestuurde bestanden:\n${lead.uploads.map((u) => `- ${u}`).join("\n")}`
    : null,
])}

Is er bij deze opdracht een brandsheet, screenshot of visuele referentie
meegeleverd, gebruik die dan als belangrijkste visuele ontwerprichting. De
factsheet bepaalt de LOOK & FEEL, de intake en de officiële website bepalen de
INHOUD, en Dogware bepaalt de TECHNIEK.`;
}

/**
 * De acceptatie: vaste eisen plus de eisen die uit déze aanvraag volgen.
 *
 * De klantspecifieke regels staan erbij omdat "alles getest" niets betekent.
 * "De strippenkaartflow doorlopen" is na te lopen; dat is het verschil tussen
 * een checklist en een gebaar.
 */
function acceptatie(lead: Lead, keuze: Modulekeuze): string {
  const specifiek: string[] = [];

  for (const slug of keuze.actief) {
    specifiek.push(
      `[ ] de module ${MODULES[slug]} is aan, heeft een eigen pagina en een werkende flow van begin tot eind`,
    );
  }
  for (const dienst of keuze.ongekoppeld) {
    specifiek.push(
      `[ ] voor de dienst "${dienst}" is gemeld dat er geen bevestigde module bestaat — er is niets blind gekoppeld of bijgebouwd`,
    );
  }
  for (const functie of lead.functies) {
    specifiek.push(
      `[ ] "${functie}" is gecontroleerd: hergebruikt uit de master, of gemeld dat het er niet is`,
    );
  }
  if (lead.website?.trim()) {
    specifiek.push(
      "[ ] de bestaande website van de klant is bekeken en de inhoud daaruit klopt",
    );
  } else {
    specifiek.push(
      "[ ] er is geen website van internet gehaald die misschien van deze klant is",
    );
  }
  if (keuze.uitgeschakeld.length > 0) {
    specifiek.push(
      "[ ] geen enkele niet-aangevraagde module is zichtbaar in menu, routes, e-mails of beheer",
    );
    specifiek.push(
      "[ ] een niet-aangevraagde dienst is ook via een rechtstreeks ingetypt adres niet\n    bereikbaar — niet verborgen, maar een echte 404",
    );
    specifiek.push(
      "[ ] geen enkele niet-aangevraagde dienst verstuurt een dienstspecifieke automatische\n    e-mail, ook niet vanuit een geplande taak of een API-aanroep",
    );
  }
  specifiek.push(
    "[ ] account-, inlog-, factuur-, betaal- en contactmail werken, onafhankelijk van\n    welke dienst aan of uit staat",
  );

  return `## 26. ACCEPTATIE

Meld pas gereed als dit allemaal waar is.

De omgeving:

[ ] eigen lokale projectmap, niet die van Dogware of van een andere klant
[ ] eigen GitHub-repository, gebaseerd op de nieuwste stabiele master, met
    Dogware als upstream bereikbaar
[ ] eigen database, met eigen credentials en eigen migraties
[ ] eigen Vercel-project met een geslaagde deployment
[ ] eigen environment variables, geen waarde overgenomen van een andere klant
[ ] geen secrets in de repository of in een commit
[ ] eigen bedrijfsconfiguratie op één centrale plek
[ ] het Dogware-beheeraccount kan daadwerkelijk inloggen op deze omgeving

Het werk:

[ ] typecheck, lint, tests en productiebuild zijn groen
[ ] geen dode knoppen en geen dode formulieren
[ ] geen businesslogica opnieuw gebouwd in websitecomponenten
[ ] de site is bekeken op 1920px, ±1440px, tablet en telefoon
[ ] mobiel volledig bruikbaar: geen horizontale scroll, tikdoelen minstens 44px
[ ] contentbreedte blijft binnen de afgesproken maximale breedte
[ ] de site ziet er onmiskenbaar uit als dit bedrijf, niet als een sjabloon
[ ] formulieren, portaalpagina's en e-mails dragen dezelfde huisstijl
[ ] geen inhoud, gegevens of restanten van een andere klant, nergens
[ ] geen verzonnen feiten; openstaande punten staan als TODO en zijn gemeld

Deze aanvraag in het bijzonder:

${specifiek.join("\n")}

Is één regel niet waar, meld dan wat er ontbreekt in plaats van gereed.`;
}

/* ─────────────────────────────────────────────────────────── de samenstelling ─ */

/**
 * De volledige bouwprompt voor deze aanvraag.
 *
 * De volgorde is de volgorde waarin het gebouwd wordt: eerst waar het komt te
 * staan, dan wat erin komt, dan hoe het eruitziet, dan of het klopt.
 */
export function bouwprompt(lead: Lead): string {
  const keuze = koppelDiensten(lead.diensten, lead.dienstenAnders);

  return [
    kop(lead, keuze),
    regels.eigenOmgeving,
    regels.eersteDeMaster,
    projectmap(lead),
    regels.eigenRepository,
    regels.eigenDatabase,
    regels.eigenVercel,
    regels.eigenEnvironment,
    bedrijfsconfiguratie(lead),
    regels.beheeraccount,
    modules(keuze),
    functies(lead),
    bestaandeWebsite(lead),
    overigeIntake(lead),
    regels.branding,
    regels.designSysteem,
    regels.layout,
    regels.heroEnFotografie,
    regels.homepage,
    regels.koppelingen,
    regels.geenAndereKlant,
    regels.geenFeitenVerzinnen,
    regels.betalenEnMail,
    regels.technischeQa,
    regels.visueleQa,
    regels.lekcontrole,
    acceptatie(lead, keuze),
  ].join("\n\n");
}

export { koppelDiensten, omgevingType, projectSlug, MODULES } from "./modules";
