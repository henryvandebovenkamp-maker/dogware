# Foto's voor DogWare

Zet je foto's in deze map met **exact** deze bestandsnamen (.jpg, kleine letters).
Zodra een bestand bestaat, verschijnt het automatisch op de site — de placeholder verdwijnt vanzelf.

## Verhaal-sectie ("Het verhaal achter DogWare")

| Bestandsnaam        | Wat voor foto                                        | Vorm       |
| ------------------- | ---------------------------------------------------- | ---------- |
| `henry-portret.jpg`  | Portret van jou, liefst met hond                    | Staand 4:5 |
| `training-veld.jpg`  | Op het veld met een groep                           | Vierkant   |
| `rustig-moment.jpg`  | Rustig moment samen met één hond                    | Liggend 4:3 |
| `groep-buiten.jpg`   | Buiten met de hele groep                             | Liggend 4:3 |
| `blij-baasje.jpg`    | Een blij baasje samen onderweg                       | Liggend 4:3 |

## Hero (klein rond fotootje in de zwevende kaart)

| Bestandsnaam       | Wat voor foto                  | Vorm     |
| ------------------ | ------------------------------ | -------- |
| `henry-avatar.jpg` | Close-up van je gezicht        | Vierkant |

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
