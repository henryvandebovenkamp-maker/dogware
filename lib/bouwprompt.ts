/**
 * De bouwprompt — één centrale template, deterministisch gevuld.
 *
 * Bij een nieuwe klant schrijf je in een apart klantproject de custom website.
 * De opdracht daarvoor was elke keer handwerk: dezelfde architectuurregels
 * overtypen en er de gegevens van déze aanvraag tussen zetten. Dit bestand doet
 * dat: vaste tekst + de werkelijk opgeslagen intake, zonder AI ertussen. Twee
 * keer dezelfde aanvraag geeft twee keer exact dezelfde prompt.
 *
 * Wat hier NIET gebeurt: iets aanmaken. Geen map, geen repository, geen
 * database, geen Vercel-project. Dit levert tekst op; wat ermee gebeurt bepaal
 * je zelf in het klantproject.
 *
 * De vaste blokken staan alleen hier. Wil je alle toekomstige prompts strenger
 * of anders, dan pas je dit bestand aan — nergens anders staat een tweede
 * versie.
 *
 * Client-safe: geen server-only imports.
 */

import type { Lead } from "@/lib/db/schema";

/** Wat de intake bedoelt met heeftWebsite. */
const WEBSITE_STATUS: Record<string, string> = {
  nee: "De klant heeft nog geen website.",
  ja: "De klant heeft een website en wil daarop verder bouwen.",
  "ja-nieuw": "De klant heeft een website, maar wil iets nieuws.",
};

/**
 * Ontbrekende velden mogen nooit als `undefined`, `null` of een lege regel in de
 * prompt komen: dat leest als een fout en zegt niets. "Niet aangeleverd" zegt
 * wél iets — namelijk dat er niets over bekend is en dat het dus ook niet
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

/** Het gedeelte over de bestaande website — alleen onderzoeken als hij er is. */
function bestaandeWebsite(lead: Lead): string {
  const url = lead.website?.trim();
  const status = lead.heeftWebsite ? WEBSITE_STATUS[lead.heeftWebsite] : null;

  if (!url) {
    return blok([
      status,
      // De regelovergang zit in de string zelf: blok() gooit lege regels weg.
      "Er is geen website-URL aangeleverd.\n",
      "",
      "Alle inhoud over dit bedrijf komt dus uit de intake hierboven of moet bij",
      "de klant worden opgevraagd. Zoek geen website op goed geluk en neem geen",
      "informatie over van een bedrijf waarvan je niet zeker weet dat het deze",
      "klant is.",
    ]);
  }

  return blok([
    `URL: ${url}`,
    status,
    "",
    "Onderzoek eerst de officiële bestaande website van deze klant en gebruik,",
    "waar toegestaan, relevante bestaande informatie zoals logo, foto's, teksten,",
    "diensten, locaties, werkwijze en contactinformatie.",
    "",
    "Die website is de bron voor de INHOUD, niet voor het ontwerp. Neem het oude",
    "uiterlijk dus niet over — alleen de feiten die er staan.",
  ]);
}

/**
 * De volledige bouwprompt voor deze aanvraag.
 *
 * Alles boven `## DESIGN FACTSHEET` komt uit de aanvraag; alles daaronder is
 * vaste tekst en dus voor iedere klant gelijk.
 */
export function bouwprompt(lead: Lead): string {
  return `# NIEUWE DOGWARE KLANT

## BEDRIJF

${tekst(lead.bedrijfsnaam)}

## CONTACTPERSOON

${tekst(lead.naam)}

## CONTACTGEGEVENS

${blok([regel("E-mail", lead.email), regel("Telefoon", lead.telefoon)])}

## PLAATS

${tekst(lead.plaats)}

## BESTAANDE WEBSITE

${bestaandeWebsite(lead)}

## DIENSTEN

Dit zijn de diensten die dit bedrijf levert, precies zoals opgegeven in de
intake. Voeg er niets aan toe.

${lijst([...lead.diensten, lead.dienstenAnders])}

Koppel iedere dienst hierboven aan de bestaande Dogware-module die erbij hoort.
Bestaat er voor een dienst geen module, meld dat dan — bouw er geen tweede
systeem naast.

## KLANT MIST

${blok([
  regel("Wat de klant mist", lead.websiteMist),
  regel("Wat er nu wél goed werkt", lead.websiteGoed),
])}

## GROOTSTE TIJDVERSPILLERS

${lijst(lead.tijdvreters)}

${lead.software.length > 0 ? `Wat de klant daar nu voor gebruikt:\n${lijst(lead.software)}` : "Welke software de klant nu gebruikt: " + ONBEKEND}

## GEWENSTE FUNCTIONALITEIT

${lijst(lead.functies)}

${lead.droomscenario?.trim() ? `In de eigen woorden van de klant:\n"${lead.droomscenario.trim()}"\n\n` : ""}Gebruik hiervoor de bestaande Dogware-functionaliteit. Deze dingen bestaan al —
online boeken, planning, intakeformulieren, klantportaal, personeelsportaal,
betalingen, facturatie en e-mail. Bouw ze niet opnieuw.

## OVERIGE INTAKE-ANTWOORDEN

${blok([
  regel("Inspiratie die de klant noemde", lead.inspiratie),
  regel("Over de huisstijl", lead.huisstijl),
  regel(
    "Heeft al een logo",
    lead.heeftLogo === "ja" ? "Ja" : lead.heeftLogo === "nee" ? "Nee" : null,
  ),
  regel("Opmerkingen bij de aanvraag", lead.opmerkingen),
  lead.uploads.length > 0
    ? `Meegestuurde bestanden:\n${lead.uploads.map((u) => `- ${u}`).join("\n")}`
    : null,
])}

## DESIGN FACTSHEET

Als bij deze opdracht een design-factsheet, screenshot of visuele referentie is
toegevoegd, gebruik deze als belangrijkste visuele ontwerprichting.

De factsheet bepaalt de LOOK & FEEL.
De klantintake en officiële website bepalen de INHOUD.
Dogware bepaalt de TECHNIEK.

Is er geen factsheet meegeleverd, ga dan niet gokken: stel een visuele richting
voor op basis van het type bedrijf, de doelgroep en de bestaande merkidentiteit,
en leg die eerst vast voordat je begint met bouwen.

## OPDRACHT

Bouw de publieke website van dit bedrijf, en zorg dat alles wat erop staat
werkelijk werkt via de bestaande Dogware-functionaliteit.

De voorkant wordt volledig op maat ontworpen voor deze onderneming. De
achterkant is Dogware zoals die er al staat.

## TECHNISCHE RANDVOORWAARDEN

Je werkt in een nieuw klantproject dat gebaseerd is op de actuele Dogware-master.

De Dogware-backend en businesslogica zijn de technische basis en mogen niet
opnieuw worden uitgevonden.

Gebruik bestaande Dogware-modules, flows, databasearchitectuur, authenticatie,
planning, klantbeheer, betalingen, facturatie, e-mail, klantportaal en
personeelsfunctionaliteit waar beschikbaar.

De publieke website mag juist volledig custom worden ontworpen voor deze
onderneming.

CUSTOM AAN DE VOORKANT.
STABIEL DOGWARE AAN DE ACHTERKANT.

Businesslogica hoort dus niet in een websitecomponent. Een component mag
gegevens opvragen en tonen; hij mag niet zelf uitrekenen wat iets kost of
wanneer er plek is.

## FUNCTIONELE KOPPELINGEN

De opdracht is niet alleen een mooie website maken.

Alle diensten en belangrijke CTA's moeten daadwerkelijk gekoppeld worden aan de
bestaande Dogware-functionaliteit.

Dus geen visuele knop "Boeken" die nergens heen gaat.

Website → aanvraag/boeking → intake → klant/hond → planning → personeel →
betaling/factuur → klantportaal moet waar relevant gebruikmaken van de bestaande
Dogware-flows.

## DESIGN

Ontwerp iets eigens. Kopieer geen bestaande Dogware-klant.

Niet: "Spin & Kwispel met een ander logo."

Wel: een ontwerp dat volgt uit het type bedrijf, de doelgroep, de diensten, de
bestaande merkidentiteit, de officiële website, de meegeleverde factsheet, de
beschikbare fotografie en de gewenste uitstraling.

De publieke pagina's mogen volledig custom zijn: hero, layout, navigatie,
kleuren, typografie, vormen, secties, kaarten, CTA's en animaties.

## MOBILE

De meeste bezoekers komen op een telefoon. Ontwerp en test op 375px breed en
schaal daarna op.

Alles moet met één duim te bedienen zijn: menu, dienstkeuze, formulieren, boeken
en betalen. Geen horizontale scroll, geen tekst onder 14px, tikdoelen minstens
44px.

## KLANTISOLATIE

Gebruik geen naam, tekst, foto, prijs, adres, persoon of instelling van een
andere Dogware-klant of van een eerdere demo.

Gedeelde code en generieke modules uit de master zijn uiteraard wél de
bedoeling; die horen er te zijn.

## FEITENCONTROLE

Gebruik alleen:

BEVESTIGD — de intake hierboven, de officiële website van deze klant, en wat er
expliciet is aangeleverd.

DESIGN — de factsheet en je eigen ontwerpkeuzes.

ONBEKEND — niet invullen als feit.

Verzin nooit: prijzen, adressen, KvK, btw, IBAN, medewerkers, certificaten,
werkgebieden, openingstijden, cursusdata, capaciteit of testimonials.

Weet je iets niet, zet er dan een zichtbare TODO neer en meld het. Een lege plek
is te herstellen, een verzonnen feit niet.

## ACCEPTATIE

Meld pas gereed als dit allemaal waar is:

[ ] typecheck, lint, tests en productiebuild zijn groen
[ ] elke dienst uit DIENSTEN heeft een pagina én een werkende flow
[ ] geen dode knoppen en geen dode formulieren
[ ] geen businesslogica opnieuw gebouwd in websitecomponenten
[ ] bedrijfsgegevens komen uit de kern, niet hardgecodeerd in de website
[ ] alleen de diensten van deze klant zijn zichtbaar in menu en routes
[ ] de site ziet er onmiskenbaar uit als dit bedrijf, niet als een sjabloon
[ ] mobiel volledig bruikbaar op 375px
[ ] geen inhoud van een andere klant, nergens
[ ] geen verzonnen feiten; openstaande punten staan als TODO en zijn gemeld

Is één regel niet waar, meld dan wat er ontbreekt in plaats van gereed.
`;
}
