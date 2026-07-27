#!/usr/bin/env node
/**
 * Genereert tijdelijke placeholder-afbeeldingen voor de branchepagina's.
 *
 * Zolang er nog geen echte sfeerfoto's zijn, staat er op iedere branchepagina
 * een verzorgd merkvlak in plaats van een lege plek. Bewust geen namaakfoto:
 * het is duidelijk een grafisch vlak, zodat niemand denkt dat dit de
 * definitieve beeldkeuze is.
 *
 * Gebruik:
 *   node scripts/generate-branche-placeholders.mjs
 *
 * Bestaande bestanden worden NIET overschreven — zodra je een echte foto op
 * dezelfde naam plaatst, blijft die staan. Wil je een placeholder opnieuw
 * genereren, verwijder het bestand dan eerst.
 *
 * Herkennen welke nog nep zijn kan met het blote oog: er staat "TIJDELIJKE
 * AFBEELDING" in. Bewust zichtbaar, zodat er nooit ongemerkt een nepbeeld
 * live blijft staan.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const KLEUR = {
  cream: "#fbf8f3",
  cream100: "#f5efe6",
  brand: "#e0562a",
  brand100: "#fbe6dc",
  brand50: "#fdf2ec",
  sage100: "#e3ede6",
  ink: "#1c150f",
  ink500: "#6b5d4f",
  ink300: "#9a8d7d",
};

/** Overgenomen uit lib/branches.ts — naam en omschrijving per foto. */
const BRANCHES = [
  ["branche-hondenschool.jpg", "Hondenschool", "Puppycursus op het trainingsveld"],
  ["branche-trimsalon.jpg", "Trimsalon", "Hond op de trimtafel"],
  ["branche-uitlaatservice.jpg", "Uitlaatservice", "Groep honden in het bos"],
  ["branche-dagopvang.jpg", "Dagopvang", "Honden die samen spelen op de opvang"],
  ["branche-pension.jpg", "Hondenpension", "Logeergast in een ruime kennel"],
  ["branche-gedragstherapie.jpg", "Gedragstherapie", "Rustig consult met hond en baasje"],
  ["branche-dierenverzorging.jpg", "Dierenverzorging aan huis", "Verzorger op bezoek bij hond thuis"],
  ["branche-chipservice.jpg", "Chipservice", "Pup wordt gechipt"],
  ["branche-webshop.jpg", "Webshop", "Assortiment riemen, snacks en speelgoed"],
];

const BREEDTE = 1600;
const HOOGTE = 1200;

/** XML-tekens ontsnappen; branchenamen bevatten geen &, maar wees veilig. */
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg(naam, omschrijving) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BREEDTE}" height="${HOOGTE}" viewBox="0 0 ${BREEDTE} ${HOOGTE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${KLEUR.brand50}"/>
      <stop offset="55%" stop-color="${KLEUR.cream}"/>
      <stop offset="100%" stop-color="${KLEUR.cream100}"/>
    </linearGradient>
    <radialGradient id="warm" cx="0.22" cy="0.2" r="0.6">
      <stop offset="0%" stop-color="${KLEUR.brand100}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${KLEUR.brand100}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="koel" cx="0.85" cy="0.85" r="0.55">
      <stop offset="0%" stop-color="${KLEUR.sage100}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${KLEUR.sage100}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${BREEDTE}" height="${HOOGTE}" fill="url(#bg)"/>
  <rect width="${BREEDTE}" height="${HOOGTE}" fill="url(#warm)"/>
  <rect width="${BREEDTE}" height="${HOOGTE}" fill="url(#koel)"/>

  <!-- Hondenpoot als rustig merkteken, bewust groot en licht -->
  <g fill="${KLEUR.brand}" opacity="0.10" transform="translate(800 470) scale(2.6)">
    <ellipse cx="0" cy="34" rx="52" ry="42"/>
    <ellipse cx="-56" cy="-18" rx="22" ry="30" transform="rotate(-18 -56 -18)"/>
    <ellipse cx="-20" cy="-44" rx="21" ry="31"/>
    <ellipse cx="20" cy="-44" rx="21" ry="31"/>
    <ellipse cx="56" cy="-18" rx="22" ry="30" transform="rotate(18 56 -18)"/>
  </g>

  <text x="800" y="800" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="86" font-weight="700" letter-spacing="-2" fill="${KLEUR.ink}">${esc(naam)}</text>

  <text x="800" y="866" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="40" font-weight="400" fill="${KLEUR.ink500}">${esc(omschrijving)}</text>

  <text x="800" y="1108" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="26" font-weight="600" letter-spacing="4" fill="${KLEUR.ink300}">TIJDELIJKE AFBEELDING</text>
</svg>`;
}

const dir = path.join(process.cwd(), "public", "photos");
mkdirSync(dir, { recursive: true });

const gemaakt = [];
const overgeslagen = [];

for (const [bestand, naam, omschrijving] of BRANCHES) {
  const doel = path.join(dir, bestand);
  if (existsSync(doel)) {
    overgeslagen.push(bestand);
    continue;
  }
  await sharp(Buffer.from(svg(naam, omschrijving)))
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
    .toFile(doel);
  gemaakt.push(bestand);
}

console.log(`aangemaakt   : ${gemaakt.length}`);
for (const b of gemaakt) console.log(`  + ${b}`);
if (overgeslagen.length) {
  console.log(`overgeslagen : ${overgeslagen.length} (bestand bestaat al)`);
  for (const b of overgeslagen) console.log(`  = ${b}`);
}
