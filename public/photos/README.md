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

Bewust op maar twee plekken, zodat DogWare een platformmerk blijft en geen
hondenfotografie-site wordt:

1. **Bovenaan** — het ronde `henry-avatar.jpg` in de hero én in het compacte
   "Gebouwd vanuit de praktijk"-blokje eronder. Eén gezicht, binnen enkele
   seconden zichtbaar.
2. **In het verhaal** (`#verhaal`) — het portret plus de fotostrip van drie
   (`rustig-moment`, `groep-buiten`, `blij-baasje`).

Wil je de fotostrip in het verhaal aanvullen met vakwerk uit een ándere branche
(bijvoorbeeld een trimmer aan de trimtafel), vervang dan één van die drie
bestanden — voeg er geen vierde sectie aan de homepage toe. Meer beeld erbij
verschuift de balans te ver richting sfeer en te ver weg van het platform.

## Nog aan te leveren (deze plekken staan al klaar)

Twee plekken in de code wachten op fotografie. Ze zijn zo gebouwd dat er nu
niets halfs op de site staat: zolang de foto ontbreekt tonen ze gewoon tekst.
Zodra het bestand er is, verschijnt het beeld vanzelf.

| Bestandsnaam    | Waar het verschijnt                                    | Vorm        |
| --------------- | ------------------------------------------------------ | ----------- |
| `meer-tijd.jpg` | De rustsectie "Minder tijd kwijt aan regelen" op de homepage, tussen de facturen- en teamsecties | Liggend 4:3 |

Voor `meer-tijd.jpg` werkt een rustig moment het beste: een hondenprofessional
die even alle tijd heeft voor één hond. Geen scherm, geen administratie — dat
is precies het punt van de sectie.

**Branchekaarten op de homepage.** De negen `branche-*.jpg` hieronder zijn nu
tijdelijke merkvlakken, dus de kaarten tonen bewust alleen hun icoon. Vervang
je zo'n bestand door echte fotografie, zet dan de slug in
`BRANCHES_MET_ECHTE_FOTO` in `lib/branches.ts` — anders blijft de kaart zonder
beeld. Doe dat het liefst voor alle negen tegelijk: een kaart met foto is ruim
190px hoger, en in een rij rekken de andere kaarten mee. Met maar een paar
foto's krijg je op tabletbreedte een scheve rij.

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

**Deze negen staan er nu als tijdelijke afbeelding.** Het zijn gegenereerde
merkvlakken, geen foto's: een zacht verloop met een pootafdruk, de branchenaam
en onderin de tekst `TIJDELIJKE AFBEELDING`. Zo ziet een branchepagina er af
uit, maar zie je in één oogopslag welke nog vervangen moeten worden.

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
