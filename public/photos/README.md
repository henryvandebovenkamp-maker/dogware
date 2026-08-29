# Foto's voor DogWare

Zet je foto's in deze map met **exact** deze bestandsnamen (.jpg, kleine letters).
Zodra een bestand bestaat, verschijnt het automatisch op de site — de placeholder verdwijnt vanzelf.

## Verhaal-sectie ("Het verhaal achter DogWare")

| Bestandsnaam        | Wat voor foto                                        | Vorm       |
| ------------------- | ---------------------------------------------------- | ---------- |
| `henry-portret.jpg`  | Portret van jou, liefst met hond (ook op /contact)  | Staand 4:5 |
| `training-veld.jpg`  | Op het veld met een groep                           | Vierkant   |
| `rustig-moment.jpg`  | Rustig moment samen met één hond                    | Liggend 4:3 |
| `groep-buiten.jpg`   | Buiten met de hele groep                             | Liggend 4:3 |
| `blij-baasje.jpg`    | Een blij baasje samen onderweg                       | Liggend 4:3 |

## Hero (klein rond fotootje)

Dit fotootje staat op twee plekken: in de zwevende kaart bij de hero (desktop)
en in het compacte "Gebouwd vanuit de praktijk"-blokje direct onder de
branchekiezer (ook op mobiel).

| Bestandsnaam       | Wat voor foto                  | Vorm     |
| ------------------ | ------------------------------ | -------- |
| `henry-avatar.jpg` | Close-up van je gezicht        | Vierkant |

## Waar de homepage fotografie toont

De volgorde vertelt eerst waaróm iemand DogWare zou willen en pas daarna wat het
doet. Fotografie draagt dat begin: het vak staat in beeld voordat er iets over
software is gezegd. Van boven naar beneden:

1. **Hero** — het ronde `henry-avatar.jpg` in de zwevende kaart.
2. **"Jij koos voor werken met honden"** — `branche-uitlaatservice.jpg`, groot.
   Dit is de enige foto vlak onder de vouw en laadt daarom met voorrang.
3. **"Waarschijnlijk lijkt jouw dag hier het meest op"** — `hondenschool`,
   `trimsalon` en `dagopvang`, ongelijk van formaat en op verschillende hoogte.
4. **Het blokje "Gebouwd vanuit de praktijk"** — nogmaals `henry-avatar.jpg`.
5. **Rustpunt** (`rustig-moment.jpg`) — tussen facturen en het teamportaal.
6. **DogWare in de praktijk** — de drie klantwebsites. Geen sfeerbeeld maar
   bewijs; ze horen niet in dit rijtje thuis.
7. **Het verhaal van Henry** (`#verhaal`) — portret, `training-veld` en een
   strip van twee, vlak voor de demo-aanvraag.

Punt 2 en 3 zorgen dat een bezoeker binnen anderhalf tot twee schermen zijn
eigen vak ziet. Voeg hier niet zomaar een achtste beeldmoment aan toe: de balans
zit nu rond tweederde platform, eenderde mens en hond.

## Nog aan te leveren (deze plekken staan al klaar)

Twee plekken in de code wachten op fotografie. Ze zijn zo gebouwd dat er nu
niets halfs op de site staat: zolang de foto ontbreekt tonen ze gewoon tekst.
Zodra het bestand er is, verschijnt het beeld vanzelf.

| Bestandsnaam    | Waar het verschijnt                                    | Vorm        |
| --------------- | ------------------------------------------------------ | ----------- |
| `meer-tijd.jpg` | De rustsectie "Minder tijd kwijt aan regelen" op de homepage, tussen de facturen- en teamsecties | Liggend 4:3 |

Deze plek is **niet leeg**: er staat nu `rustig-moment.jpg`, die eerder in de
fotostrip van het verhaalblok zat. Zet je hier ooit een foto neer die specifiek
voor deze sectie gemaakt is, noem hem dan `meer-tijd.jpg` — die krijgt vanzelf
voorrang, zonder dat er iets in de code hoeft te veranderen.

Wat er op zo'n foto hoort: een rustig moment waarin een hondenprofessional even
alle tijd heeft voor één hond. Geen scherm, geen administratie — dat is precies
het punt van de sectie.

**Vier branchefoto's staan er inmiddels wél.** `branche-trimsalon.jpg`,
`branche-hondenschool.jpg`, `branche-uitlaatservice.jpg` en
`branche-dagopvang.jpg` zijn geen merkvlak meer maar echte beelden. Ze doen op
twee plekken werk tegelijk:

1. de bijbehorende branchelandingspagina toont ze als sfeerbeeld;
2. drie ervan staan als praktijkmoment verspreid over de homepage — trimsalon
   na "Zo werkt het", hondenschool na de oplossingen, uitlaatservice vlak voor
   de klantvoorbeelden.

Ze zijn 768x512 (3:2). Het kader op de site is óók 3:2, dus er wordt niets
weggesneden en gezicht, hond en handeling blijven overal in beeld. Let op: op
een scherm met dubbele pixeldichtheid worden ze op groot formaat iets zacht.
Lever je ze ooit opnieuw aan, mik dan op minimaal 1600px breed per foto.

**De vijf overige branches** (pension, gedragstherapie, dierenverzorging,
chipservice, webshop) hebben nog een merkvlak. De branchekaarten op de homepage
tonen daarom bewust géén foto's: met vier van de negen voorzien wordt één rij
scheef. `BRANCHES_MET_ECHTE_FOTO` in `lib/branches.ts` blijft leeg tot alle
negen er zijn.

## Wat er wél en niet op een foto mag staan

De fotografie moet uitstralen: *dit platform is gemaakt voor mensen die
professioneel en met liefde met honden werken.* Kijk daarom heel goed naar de
inhoud van een foto voordat je hem plaatst — dit geldt voor élke foto in deze
map, ook de branchepagina's.

**Niet gebruiken:**

- prikbanden;
- stroom-/correctiebanden (e-collars);
- duidelijke wurgmiddelen (slipkettingen die strak staan);
- hardhandige trainingsmethodes of een strak getrokken lijn;
- beelden die dierenwelzijn negatief kunnen uitstralen;
- extreem doorgefokte honden waarbij gezondheidsproblematiek het beeld bepaalt
  (bijvoorbeeld zeer korte snuiten met zichtbare ademnood);
- onnatuurlijke, AI-achtige honden of mensen.

**Wel:** warm, natuurlijk daglicht, ontspannen lichaamstaal bij hond én mens,
gewone platte halsbanden of Y-tuigjes, losse lijn, echte werksituaties.

## Branchepagina's (grote foto per branche)

Elke branchelandingspagina toont één sfeerfoto uit het vak zelf. Dit is dé plek
waar een bezoeker denkt "hé, dit gaat over mij", dus kies foto's die het werk
herkenbaar maken.

| Bestandsnaam                    | Pagina                        | Wat voor foto                          | Vorm        |
| ------------------------------- | ----------------------------- | -------------------------------------- | ----------- |
| `branche-hondenschool.jpg`      | /hondenschool-software        | Puppycursus op het trainingsveld       | Liggend 4:3 |
| `branche-trimsalon.jpg`         | /trimsalon-software           | Hond op de trimtafel                   | Liggend 4:3 |
| `branche-uitlaatservice.jpg`    | /uitlaatservice-software      | Groep honden in het bos                | Liggend 4:3 |
| `branche-dagopvang.jpg`         | /dagopvang-software           | Honden die samen spelen op de opvang   | Liggend 4:3 |
| `branche-pension.jpg`           | /pension-software             | Logeergast in een ruime kennel         | Liggend 4:3 |
| `branche-gedragstherapie.jpg`   | /gedragstherapie-software     | Rustig consult met hond en baasje      | Liggend 4:3 |
| `branche-dierenverzorging.jpg`  | /dierenverzorging-software    | Verzorger op bezoek bij hond thuis     | Liggend 4:3 |
| `branche-chipservice.jpg`       | /chipservice-software         | Pup wordt gechipt                      | Liggend 4:3 |
| `branche-webshop.jpg`           | /webshop-software             | Assortiment riemen, snacks, speelgoed  | Liggend 4:3 |

**Vier hiervan zijn inmiddels echte foto's** — hondenschool, trimsalon,
uitlaatservice en dagopvang. **De overige vijf staan er nog als tijdelijke
afbeelding**: gegenereerde merkvlakken, geen foto's, met een zacht verloop, een
pootafdruk, de branchenaam en onderin de tekst `TIJDELIJKE AFBEELDING`. Zo ziet
zo'n branchepagina er af uit, maar zie je in één oogopslag welke nog moeten.

Vervangen doe je door simpelweg je eigen `.jpg` op dezelfde naam te zetten —
verder is er niets aan te passen. Liggend 4:3 werkt het beste; het vlak op de
pagina heeft die verhouding.

Opnieuw genereren (bijvoorbeeld na een naamswijziging):

```
node scripts/generate-branche-placeholders.mjs
```

Dat script overschrijft nooit een bestaand bestand. Wil je een placeholder
opnieuw laten maken, verwijder hem dan eerst.

## Testimonials (ronde avatars, optioneel)

| Bestandsnaam             | Persoon           | Branche              |
| ------------------------ | ----------------- | -------------------- |
| `testimonial-sanne.jpg`  | Sanne Bakker      | Hondenschool         |
| `testimonial-marco.jpg`  | Marco de Wit      | Uitlaatservice       |
| `testimonial-linda.jpg`  | Linda Vermeer     | Trimsalon            |
| `testimonial-joost.jpg`  | Joost Hendriks    | Gedragstherapie      |
| `testimonial-esther.jpg` | Esther Kooij      | Dagopvang            |
| `testimonial-peter.jpg`  | Peter Aalbers     | Hondenpension        |
| `testimonial-nadia.jpg`  | Nadia el Amrani   | Dierenzorg aan huis  |
| `testimonial-rob.jpg`    | Rob Timmermans    | Chipservice          |
| `testimonial-iris.jpg`   | Iris de Groot     | Webshop              |

Zolang deze ontbreken blijft de emoji staan — dat is prima.

## Tips

- Aanleveren mag groot; Next.js maakt ze automatisch klein en snel.
- Warme, natuurlijke foto's (buitenlicht) passen het beste bij de huisstijl.
