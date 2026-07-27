/**
 * De accentkleur van hun eigen site, veilig gemaakt.
 *
 * Een site mag opgeven wat hij wil — knalgeel, wit, bijna zwart. Die kleur
 * klakkeloos achter tekst zetten levert onleesbare pagina's op. Daarom komt
 * een kleur er alleen door als er genoeg contrast met wit overblijft, en
 * gebruiken we hem alleen voor accenten: een streep, een stip, een kop.
 *
 * Client-safe: geen server-only imports.
 */

function parse(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  const kort = h.length === 3 || h.length === 4;
  const lang = h.length === 6 || h.length === 8;
  if (!kort && !lang) return null;
  if (!/^[0-9a-f]+$/i.test(h)) return null;

  const deel = (i: number) =>
    kort ? parseInt(h[i] + h[i], 16) : parseInt(h.slice(i * 2, i * 2 + 2), 16);

  return { r: deel(0), g: deel(1), b: deel(2) };
}

/** Relatieve helderheid volgens WCAG. */
function helderheid({ r, g, b }: { r: number; g: number; b: number }): number {
  const kanaal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanaal(r) + 0.7152 * kanaal(g) + 0.0722 * kanaal(b);
}

/**
 * Geeft de kleur terug als hij bruikbaar is, anders null.
 *
 * Te licht: onleesbaar op wit. Bijna zwart of bijna wit: dan is het geen
 * accent maar de basiskleur van elke site, en voegt hij niets persoonlijks
 * toe — dan is onze eigen kleur eerlijker.
 */
export function veiligAccent(kleur: string | undefined | null): string | null {
  if (!kleur) return null;
  const rgb = parse(kleur);
  if (!rgb) return null;

  const l = helderheid(rgb);
  // Contrast met wit moet minstens 3:1 zijn voor grote tekst en vlakken.
  const contrastMetWit = 1.05 / (l + 0.05);
  if (contrastMetWit < 3) return null;
  // Bijna zwart telt niet als merkkleur.
  if (l < 0.02) return null;

  const h = kleur.trim().replace(/^#/, "");
  const naar6 =
    h.length === 3 || h.length === 4
      ? h
          .slice(0, 3)
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  return `#${naar6.toLowerCase()}`;
}
