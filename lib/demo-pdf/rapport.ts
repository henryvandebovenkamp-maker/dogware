import { branding } from "@/lib/branding";

/**
 * De opmaak van de demo-PDF, als HTML die de browser naar A4 liggend print.
 *
 * Geen kale print van een lange webpagina: een voorblad, per pagina van de
 * demo een of meer schermafbeeldingen op een eigen, rustig opgemaakte
 * PDF-pagina, een mobiele impressie en een afsluitende DogWare-pagina.
 * Afbeeldingen worden nooit uitgerekt: ze passen in hun vak met behoud van
 * verhouding.
 *
 * Puur: alle gegevens en afbeeldingen (als data-URI) komen van de aanroeper.
 * Contactgegevens komen uit de centrale branding.
 */

export type RapportScherm = {
  /** Kop, bijv. "Home" of "Zo werkt het". */
  titel: string;
  /** Pad in de demo, ter herkenning. */
  pad: string;
  /** Deel van een lange pagina: 1 van 3, … */
  deel?: { nummer: number; van: number };
  /** data:image/jpeg;base64,… */
  src: string;
};

export type RapportData = {
  bedrijfsnaam: string;
  demoUrl: string;
  /** Wanneer de demo gemaakt/verstuurd is. */
  demoDatum: Date | null;
  /** Wanneer deze PDF gemaakt is. */
  gemaaktOp: Date;
  logoSrc: string;
  schermen: RapportScherm[];
  /** Mobiele schermafbeeldingen van de homepage (hoogstens drie). */
  mobiel: string[];
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function datumNl(d: Date): string {
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

/** Het aantal PDF-pagina's dat dit rapport oplevert. */
export function aantalPaginas(d: Pick<RapportData, "schermen" | "mobiel">): number {
  return 1 + d.schermen.length + (d.mobiel.length > 0 ? 1 : 0) + 1;
}

export function bouwRapportHtml(d: RapportData): string {
  const c = branding.colors;
  const bedrijf = esc(d.bedrijfsnaam);
  const host = esc(new URL(d.demoUrl).host);
  const totaal = aantalPaginas(d);
  const site = esc(branding.siteUrl.replace(/^https?:\/\//, ""));

  const voet = (nr: number) => `
    <footer class="voet">
      <span><img src="${d.logoSrc}" alt="" class="voet-logo" /> Voorbeeldwebsite voor ${bedrijf}</span>
      <span>${nr} / ${totaal}</span>
    </footer>`;

  const voorblad = `
    <section class="pagina voorblad">
      <div class="voorblad-links">
        <img src="${d.logoSrc}" alt="${esc(branding.name)}" class="logo" />
        <div>
          <p class="bovenkop">Jouw DogWare voorbeeldwebsite</p>
          <h1>${bedrijf}</h1>
          <p class="intro">Een visuele impressie van de voorbeeldwebsite die we voor ${bedrijf} hebben gemaakt.</p>
        </div>
        <dl class="gegevens">
          ${d.demoDatum ? `<div><dt>Demo gemaakt</dt><dd>${datumNl(d.demoDatum)}</dd></div>` : ""}
          <div><dt>Vastgelegd op</dt><dd>${datumNl(d.gemaaktOp)}</dd></div>
          <div><dt>Voorbeeldwebsite</dt><dd>${host}</dd></div>
        </dl>
      </div>
      <div class="voorblad-rechts">
        ${d.schermen[0] ? `<div class="browser"><div class="browser-balk"><i></i><i></i><i></i><span>${host}</span></div><img src="${d.schermen[0].src}" alt="" /></div>` : ""}
      </div>
    </section>`;

  const schermPaginas = d.schermen
    .map(
      (s, i) => `
    <section class="pagina scherm">
      <header class="kop">
        <p class="bovenkop">Website-impressie</p>
        <h2>${esc(s.titel)}${s.deel && s.deel.van > 1 ? ` <span class="deel">${s.deel.nummer} van ${s.deel.van}</span>` : ""}</h2>
        <p class="pad">${host}${esc(s.pad === "/" ? "" : s.pad)}</p>
      </header>
      <div class="vak"><div class="browser"><div class="browser-balk"><i></i><i></i><i></i><span>${host}${esc(s.pad === "/" ? "" : s.pad)}</span></div><img src="${s.src}" alt="" /></div></div>
      ${voet(i + 2)}
    </section>`,
    )
    .join("");

  const mobielPagina =
    d.mobiel.length > 0
      ? `
    <section class="pagina scherm">
      <header class="kop">
        <p class="bovenkop">Website-impressie</p>
        <h2>Ook op je telefoon</h2>
        <p class="pad">De meeste klanten bekijken je website op hun telefoon — zo ziet hij er daar uit.</p>
      </header>
      <div class="mobiel">
        ${d.mobiel.map((m) => `<div class="telefoon"><img src="${m}" alt="" /></div>`).join("")}
      </div>
      ${voet(d.schermen.length + 2)}
    </section>`
      : "";

  const slot = `
    <section class="pagina slot">
      <div class="slot-inhoud">
        <img src="${d.logoSrc}" alt="${esc(branding.name)}" class="logo" />
        <h2>Toch verder met jouw website?</h2>
        <p>Deze demo is inmiddels afgesloten, maar je bent natuurlijk altijd welkom om opnieuw contact met ons op te nemen. We kijken graag samen hoe we jouw website en bedrijfsvoering verder kunnen brengen.</p>
        <dl class="contact">
          <div><dt>E-mail</dt><dd>${esc(branding.contactEmail)}</dd></div>
          <div><dt>Telefoon</dt><dd>${esc(branding.phone)}</dd></div>
          <div><dt>Website</dt><dd>${site}</dd></div>
        </dl>
        <p class="slogan">${esc(branding.name)} · ${esc(branding.slogan)}</p>
      </div>
    </section>`;

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<title>${bedrijf} — DogWare voorbeeldwebsite</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${c.background}; }
  body { font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: ${c.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 297mm; height: 210mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; background: ${c.background}; }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
  .bovenkop { font-size: 9pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${c.primary}; }
  .logo { height: 13mm; width: auto; align-self: flex-start; object-fit: contain; }
  .voorblad .logo { height: 19mm; }
  .slot .logo { align-self: center; }

  .voorblad { display: grid; grid-template-columns: 1fr 1.15fr; gap: 12mm; padding: 18mm 16mm 18mm 20mm; background: linear-gradient(135deg, #fdf0e9 0%, ${c.background} 55%, #eef3ef 100%); }
  .voorblad-links { display: flex; flex-direction: column; justify-content: space-between; }
  .voorblad h1 { margin-top: 4mm; font-size: 34pt; line-height: 1.05; font-weight: 800; letter-spacing: -.02em; }
  .voorblad .intro { margin-top: 5mm; font-size: 12pt; line-height: 1.55; color: #6b6158; max-width: 105mm; }
  .gegevens { display: grid; gap: 3mm; font-size: 9.5pt; }
  .gegevens dt { color: #9a8f84; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; }
  .gegevens dd { font-weight: 700; margin-top: .5mm; }
  .voorblad-rechts { display: flex; align-items: center; }

  .browser { background: #fff; border-radius: 3mm; overflow: hidden; box-shadow: 0 6mm 16mm -6mm rgba(28,21,15,.25), 0 0 0 .3mm rgba(28,21,15,.08); max-width: 100%; max-height: 100%; display: flex; flex-direction: column; }
  .browser-balk { display: flex; align-items: center; gap: 1.5mm; padding: 2.2mm 3mm; background: #f3eee7; border-bottom: .3mm solid rgba(28,21,15,.06); }
  .browser-balk i { width: 2.2mm; height: 2.2mm; border-radius: 50%; background: #dcd2c6; display: block; }
  .browser-balk span { margin-left: 3mm; font-size: 7.5pt; color: #8a8178; background: #fff; border-radius: 99px; padding: .6mm 4mm; }
  .browser img { display: block; width: 100%; height: auto; min-height: 0; object-fit: contain; }

  .scherm { padding: 12mm 16mm 16mm; display: flex; flex-direction: column; }
  .kop { display: flex; align-items: baseline; gap: 5mm; flex-wrap: wrap; }
  .kop .bovenkop { width: 100%; }
  .kop h2 { font-size: 18pt; font-weight: 800; letter-spacing: -.01em; }
  .kop .deel { margin-left: 2.5mm; font-size: 10pt; font-weight: 600; color: #9a8f84; }
  .kop .pad { font-size: 9pt; color: #9a8f84; }
  .vak { flex: 1; min-height: 0; margin-top: 6mm; display: flex; align-items: flex-start; justify-content: center; }
  .vak .browser { height: 100%; width: auto; aspect-ratio: auto; }
  .vak .browser img { height: calc(100% - 8mm); width: auto; max-width: 100%; }

  .mobiel { flex: 1; min-height: 0; margin-top: 6mm; display: flex; gap: 10mm; justify-content: center; align-items: flex-start; }
  .telefoon { height: 100%; border-radius: 7mm; padding: 2.2mm; background: ${c.ink}; box-shadow: 0 6mm 14mm -6mm rgba(28,21,15,.35); }
  .telefoon img { height: 100%; width: auto; border-radius: 5mm; display: block; }

  .voet { position: absolute; left: 16mm; right: 16mm; bottom: 6mm; display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: #9a8f84; }
  .voet span { display: inline-flex; align-items: center; gap: 2mm; }
  .voet-logo { height: 4.5mm; width: auto; }

  .slot { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #fdf0e9 0%, ${c.background} 50%, #eef3ef 100%); }
  .slot-inhoud { width: 170mm; text-align: center; display: flex; flex-direction: column; align-items: center; }
  .slot h2 { margin-top: 10mm; font-size: 26pt; font-weight: 800; letter-spacing: -.02em; }
  .slot p { margin-top: 5mm; font-size: 12pt; line-height: 1.6; color: #6b6158; }
  .contact { margin-top: 10mm; display: flex; gap: 12mm; justify-content: center; font-size: 10pt; }
  .contact dt { color: #9a8f84; font-size: 8pt; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; }
  .contact dd { margin-top: 1mm; font-weight: 700; color: ${c.ink}; }
  .slot .slogan { margin-top: 12mm; font-size: 9pt; color: ${c.secondary}; font-weight: 700; }
</style>
</head>
<body>
${voorblad}
${schermPaginas}
${mobielPagina}
${slot}
</body>
</html>`;
}
