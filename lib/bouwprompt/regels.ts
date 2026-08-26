/**
 * De vaste Dogware-regels — laag A van elke bouwprompt.
 *
 * Alles in dit bestand is voor iedere klant gelijk. Verander je hier één regel,
 * dan schrijft élke prompt die daarna wordt gegenereerd die nieuwe regel. Dat
 * is de reden dat deze tekst hier staat en niet in een component: één plek om
 * strenger te worden.
 *
 * Wat hier NIET hoort: iets over een specifieke klant. Geen naam, geen
 * uitzondering, geen "behalve bij". De klant komt uit de aanvraag; deze
 * blokken weten niet wie het is.
 *
 * Wat hier ook niet hoort: geheimen. Geen adminadres, geen sleutel, geen
 * connection string. Een prompt gaat op het klembord en daarna wie weet waar
 * naartoe. De prompt wijst naar waar iets veilig te vinden is, meer niet.
 *
 * Client-safe: geen server-only imports.
 */

/**
 * De regel waar alle andere regels aan hangen. Staat bewust bovenaan de prompt:
 * wie hierna gaat bouwen moet eerst begrijpen dát dit een eigen project wordt,
 * anders is elke volgende instructie voor niets.
 */
export const eigenOmgeving = `## 1. DIT WORDT EEN VOLLEDIG EIGEN OMGEVING

Deze klant krijgt een zelfstandige technische omgeving. Niet een plekje in een
bestaande omgeving, niet een extra tenant, niet een tweede vestiging onder een
andere klant.

EIGEN lokale projectmap.
EIGEN GitHub-repository.
EIGEN database.
EIGEN Vercel-project en deployment.
EIGEN environment variables.
EIGEN bedrijfsconfiguratie, branding, content en gebruikers.

Zet deze klant dus NIET als tenant, filiaal, vestiging of extra rij in de
omgeving van een bestaande Dogware-klant. Deel geen database, geen projectmap,
geen repository en geen Vercel-project met een andere klant.

Dogware master levert de software. De omgeving van deze klant staat daarna op
zichzelf:

    DOGWARE MASTER
          │
          └── DEZE KLANT
              ├── eigen map
              ├── eigen repository
              ├── eigen database
              ├── eigen Vercel-project
              └── eigen configuratie en branding

Kom je er tijdens het bouwen achter dat iets alleen kan door te delen met een
andere klant, bouw het dan niet en meld het.`;

/**
 * Beginnen vanuit een oude lokale kopie is de fout die je pas maanden later
 * ontdekt, als de klant een bugfix mist die allang bestaat.
 */
export const eersteDeMaster = `## 2. BEGIN BIJ DE NIEUWSTE DOGWARE

Voordat je iets aanmaakt, kijk je eerst wat de actuele Dogware-master is:

- welke branch en welke laatste stabiele tag/release de master heeft;
- of je lokale kopie daarmee gelijk loopt of achterloopt;
- welke provisioning- en migratiescripts er in die master staan;
- hoe database, authenticatie en moduleconfiguratie daar geregeld zijn.

Bouw nooit bewust verder op een verouderde lokale kopie. Loopt je kopie achter,
haal dan eerst op.

Vind je geen bestaand provisioningscript voor een nieuwe klantomgeving, verzin
er dan geen. Doe de stappen hieronder expliciet, en meld aan het eind welke
stappen handwerk waren — dan weten we wat er de volgende keer geautomatiseerd
moet worden.`;

export const eigenRepository = `## 4. EIGEN GITHUB-REPOSITORY

Deze klant krijgt een eigen repository. Niet een map in een repository waar
meer klanten in staan.

- basis: de nieuwste stabiele Dogware-master/release;
- eigen history vanaf die basis;
- Dogware master blijft als upstream bereikbaar, zodat latere Dogware-releases
  gecontroleerd naar dit project kunnen worden gehaald;
- de eerste commit beschrijft waar dit project vandaan komt en op welke
  Dogware-versie het is gebaseerd.

Push niets naar de Dogware-master zelf. Wat hier gebouwd wordt is van deze
klant; wat in de master hoort is een aparte beslissing.`;

export const eigenDatabase = `## 5. EIGEN DATABASE

Harde regel: deze klant krijgt een eigen database. Geen gedeelde database met
een kolom \`klant_id\` erbij.

    KLANT A → eigen database
    KLANT B → eigen database
    DEZE KLANT → eigen database

Wel overnemen uit Dogware: het schema, de migraties, de technische
initialisatie en de configuratie die de software nodig heeft om te draaien.

Nooit overnemen: de bedrijfsdata van een andere klant. Kloon dus geen bestaande
klantdatabase "om alvast wat in te hebben staan".

De database van deze klant begint leeg op bedrijfsdata. Alleen wat deze klant
zelf heeft aangeleverd of wat technisch noodzakelijk is (rollen, instellingen,
het beheeraccount) mag erin.

Eigen database, eigen credentials, eigen connection string, eigen migraties.`;

export const eigenVercel = `## 6. EIGEN VERCEL-PROJECT

Een eigen Vercel-project, gekoppeld aan de eigen repository van deze klant.

Niet meeliften op de deployment van een andere klant en niet als extra domein
onder een bestaand project hangen.

Volg de deploymentarchitectuur zoals die in de master staat: dezelfde build,
dezelfde runtime-instellingen, dezelfde regio-keuze. Het domein wordt gekoppeld
zodra het beschikbaar is; tot die tijd is de Vercel-URL genoeg.`;

export const eigenEnvironment = `## 7. EIGEN ENVIRONMENT VARIABLES

Neem de volledige lijst variabelen over uit \`.env.example\` van dit nieuwe
project — dat bestand is de actuele lijst, niet je geheugen.

Voor elke variabele geldt: een eigen waarde voor deze klant. Nooit een waarde
van een andere klant hergebruiken. Zeker niet bij:

- de database-connectiestring;
- de sessie-/auth-sleutel;
- de e-mail-API-sleutel en de afzender;
- de betaal-API-sleutel;
- de upload-token;
- de site-URL.

Geen secrets in de repository. Geen \`.env\` met echte waarden committen. Geen
sleutel in code, in een component of in een commitbericht. De secrets horen in
de environment van het Vercel-project en lokaal in \`.env.local\`, dat in
\`.gitignore\` staat.

Ontbreekt een sleutel nog (de klant heeft bijvoorbeeld nog geen eigen
betaalaccount), verzin er dan niets omheen: laat de variabele leeg, zorg dat de
software daar netjes mee omgaat, en meld het als openstaand punt.`;

/**
 * Het beheeraccount is de enige reden dat een geslaagde provisioning ook
 * bewijsbaar geslaagd is: kun je er niet in, dan heb je niets opgeleverd.
 */
export const beheeraccount = `## 9. HET DOGWARE-BEHEERACCOUNT MOET WERKEN

De nieuwe omgeving moet toegankelijk zijn voor het vaste Dogware-beheeraccount.

Het adres daarvan staat NIET in deze prompt, en hoort daar ook niet: het komt
uit de bestaande Dogware-configuratie (de omgevingsvariabelen van de master en
het beheeraccount dat daar al bestaat). Zoek het daar op.

Verzin geen nieuw adminadres. Zet geen wachtwoord in een bestand, een commit of
een bericht — Dogware is wachtwoordloos en werkt met een magic link/code.

Te doen:

- maak of koppel het beheeraccount in de nieuwe database;
- geef het de juiste rol (SUPER_ADMIN);
- controleer dat de rechten kloppen;
- log daadwerkelijk in op het beheerportaal van de nieuwe omgeving;
- controleer dat de beheeromgeving opent en werkt.

Werkt dat inloggen niet, dan is de omgeving niet opgeleverd. Meld het dan als
blokkade in plaats van als klaar.`;

export const geenAndereKlant = `## 20. GEEN DATA VAN EEN ANDERE KLANT

Neem van geen enkele andere Dogware-klant en van geen enkele eerdere demo over:

klanten · honden en andere dieren · medewerkers · aanvragen · planning ·
boekingen · facturen · betalingen · abonnementen · strippenkaarten · cursussen ·
persoonsgegevens · e-mailadressen · reviews · teksten · foto's · logo's ·
domeinen · API-credentials · betaalcredentials · bedrijfsconfiguratie.

Gedeelde code en generieke modules uit de master zijn juist wél de bedoeling.
Het verschil: software mag gedeeld zijn, gegevens van een bedrijf nooit.`;

export const geenFeitenVerzinnen = `## 21. VERZIN GEEN BEDRIJFSFEITEN

Gebruik alleen wat bevestigd is: de intake hierboven, de officiële website van
deze klant als die is opgegeven, en wat er verder is aangeleverd.

Verzin nooit: prijzen, tarieven, openingstijden, routes, werkgebieden,
groepsgroottes, wachttijden, capaciteit, reviews, testimonials,
certificeringen, diploma's, medewerkers, jaren ervaring, adressen, KvK, btw,
IBAN, voorwaarden of beschikbaarheid.

Weet je iets niet, zet er dan een zichtbare TODO of een duidelijke placeholder
neer en meld het. Een lege plek is te herstellen; een verzonnen feit dat een
half jaar op een website staat niet.`;

export const branding = `## 14. DEZE KLANT KRIJGT EEN EIGEN GEZICHT

Dogware is de motor, niet de huisstijl. De site moet eruitzien alsof hij voor
dit ene bedrijf is ontworpen — niet als Dogware met een ander logo, en niet als
een bestaande Dogware-klant met andere kleuren.

Dus geen standaard Dogware-turquoise of -mint, geen standaard SaaS-hero, geen
overgenomen kaartjes, knoppen, iconen of homepage-template.

Bepaal de visuele richting in deze volgorde:

1. Is er een brandsheet of visuele referentie meegeleverd? Die is leidend.
2. Anders: is er een bevestigde bestaande website? Analyseer de huidige
   merkidentiteit en maak daar een betere versie van.
3. Anders: zijn er logo of beeldmateriaal aangeleverd? Bouw daarop verder.
4. Is er nauwelijks iets? Ontwikkel een passende stijl vanuit de bedrijfsnaam,
   de dienst, de doelgroep en de intake — en leg die eerst vast voordat je gaat
   bouwen.

Ook in stap 4 geldt: een stijl mag je bedenken, feiten niet.`;

export const designSysteem = `## 15. ÉÉN DESIGN SYSTEM PER KLANT

Leg de stijl centraal vast, niet verspreid over componenten. Definieer minimaal:

primary · secondary · accent · background · surface · text · muted · borders ·
radii · shadows · typografie (schaal en gewichten) · knoppen · spacing ·
containerbreedtes · iconenstijl · fotografierichting.

Elke pagina en elk component leest daaruit. Een losse hex-code in een component
betekent dat de stijl niet meer op één plek te veranderen is.`;

export const layout = `## 16. NIET TE BREED OP DESKTOP

Vaste Dogware-designregel: gewone content krijgt een gecontroleerde maximale
breedte. Richtwaarde 1180–1280px, tenzij het ontwerp aantoonbaar om iets anders
vraagt.

Full-width fotografie en achtergrondvlakken mogen wél de hele breedte pakken.

Op een 1920px-scherm moet de site compact en verzorgd blijven — geen tekst die
van rand tot rand loopt en geen velden die meegroeien tot ze belachelijk worden.`;

export const heroEnFotografie = `## 17. HERO EN FOTOGRAFIE

Voor een site die op consumenten is gericht werkt deze volgorde:

    beeld → emotie → vertrouwen → propositie → CTA → uitleg

Dus niet automatisch een gigantische tekst-hero. Kies de hero die dit bedrijf
het beste verkoopt: full-width fotografie, image-led, overlay, asymmetrisch,
editorial, of een visual van de dienst zelf.

Fotografie is geen opvulling. Beeld moet passen bij het bedrijf, de dienst, de
doelgroep en het gevoel dat je wilt oproepen. Gebruik waar mogelijk bevestigd
eigen beeldmateriaal van deze klant.

Zorg dat de beelden onderling één geheel vormen in kleur, licht, uitsnede en
sfeer. Vijf foto's uit vijf verschillende werelden maken een site rommelig,
hoe mooi ze los ook zijn.`;

export const homepage = `## 18. GEEN VASTE HOMEPAGEFORMULE

Deze klant krijgt niet automatisch hero → USP → over ons → werkwijze → reviews
→ CTA.

Bepaal de opbouw vanuit deze aanvraag: wat verkoopt dit bedrijf, aan wie, en
wat moet een bezoeker doen? De techniek is modulair, het ontwerp is maatwerk.

Houd het compact en scanbaar. Vermijd gigantische koppen, halflege kaarten,
overbodige tekst, buitensporige witruimte en pagina's die eindeloos doorlopen
zonder reden.`;

export const koppelingen = `## 19. WEBSITE EN PLATFORM ZIJN ÉÉN GEHEEL

De opdracht is niet "een mooie website". Elke dienst en elke belangrijke CTA
moet daadwerkelijk uitkomen bij werkende Dogware-functionaliteit.

Dus geen knop "Boeken" die nergens heen gaat, en geen formulier dat in het
niets verdwijnt.

    website → aanvraag/boeking → intake → klant en hond → planning →
    medewerker → betaling/factuur → klantportaal

Gebruik daarvan alleen de stappen die horen bij de diensten die deze klant
daadwerkelijk aanvraagt. Bestaat een stap nog niet in de master, meld dat dan
in plaats van er een dode knop voor te zetten.

Ook de formulieren, de intake, het inloggen, de portaalpagina's, de knoppen,
de invoervelden, de foutmeldingen en de bevestigingen krijgen de stijl van deze
klant. Een prachtige homepage gevolgd door een generiek Dogware-formulier is
niet af.

Controleer de e-mails die bij de geactiveerde modules horen op restanten van
een andere klant: bedrijfsnaam, logo, URL's, contactgegevens, afzender, footer
en links.`;

export const betalenEnMail = `## 22. BETALEN EN E-MAIL: EIGEN CONFIGURATIE

Gebruik de bestaande betaal- en e-mailarchitectuur van Dogware. Maar de
identiteit erachter is van deze klant.

Betalingen: nooit de betaalcredentials van een andere klant gebruiken. Heeft
deze klant nog geen eigen betaalaccount, laat de sleutel dan leeg, zorg dat de
site daar netjes mee omgaat en meld dit als vereiste vóór livegang.

E-mail: eigen afzender, eigen domein, eigen branding in de templates. Nooit de
afzender of het domein van een andere klant overnemen. Is het domein nog niet
geverifieerd, meld dat dan als openstaand punt.`;

export const technischeQa = `## 23. TECHNISCHE CONTROLE

Voer daadwerkelijk uit — niet "zou moeten werken":

- dependencies installeren zonder fouten;
- typecheck;
- lint, als het project dat heeft;
- de tests;
- een productiebuild;
- de migraties tegen de nieuwe database;
- inloggen als beheerder;
- de flows van elke geactiveerde module doorlopen;
- de console en de server-logs op fouten en waarschuwingen nakijken.`;

export const visueleQa = `## 24. VISUELE CONTROLE

"De build slaagt" is geen oplevering. Bekijk de gerenderde site.

Controleer op 1920px desktop, ±1440px laptop, tablet en telefoon:

header · menu · hero · fotografie en uitsnedes · kaarten · knoppen · CTA's ·
formulieren · portaalpagina's · footer · horizontale overflow.

Mobiel is geen verkleinde desktop. Alles moet met één duim te bedienen zijn.
Geen horizontale scroll, geen tekst onder 14px, tikdoelen minstens 44px.

Let daarnaast op: de maximale contentbreedte, de typografie, de spacing, en
achtergebleven kleuren of componenten uit een ander ontwerp.`;

export const lekcontrole = `## 25. CONTROLE OP KLANTLEKKEN

Zoek vóór de oplevering het hele project door op herkenbare gegevens van andere
Dogware-klanten en van eerdere demo's: namen, domeinen, e-mailadressen, logo's,
kleuren, metadata, teksten, seed-data en mailtemplates.

Vind je iets, haal het weg en meld wat het was en waar het stond.`;
