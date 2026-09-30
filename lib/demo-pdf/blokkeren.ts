/**
 * Wat de browser tijdens het vastleggen van een demo níet ophaalt.
 *
 * Alleen wat niets bijdraagt aan een stilstaand plaatje van de pagina:
 * analytics en tracking, advertenties, video en audio, open verbindingen
 * (websockets, server-sent events) en de achtergrond-prefetches van
 * Next.js. Stylesheets, lettertypen en afbeeldingen komen gewoon binnen —
 * die zijn nodig om de demo te laten zien zoals de klant hem ziet.
 *
 * Daarnaast blijft de browser op het eigen domein van de demo: een
 * hoofdnavigatie of redirect naar een ander domein wordt afgebroken.
 * Puur: de browser vraagt, deze functie beslist.
 */

const TRACKING_HOSTS = [
  "google-analytics.com",
  "googletagmanager.com",
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "connect.facebook.net",
  "hotjar.com",
  "hotjar.io",
  "clarity.ms",
  "plausible.io",
  "segment.io",
  "segment.com",
  "mixpanel.com",
  "hs-scripts.com",
  "hs-analytics.net",
  "snap.licdn.com",
  "analytics.tiktok.com",
  "vercel.live",
];

const TRACKING_PADEN = [/^\/_vercel\/(insights|speed-insights)\//, /^\/facebook\.com\/tr/];

/** Soorten verzoeken die voor een schermafbeelding nooit nodig zijn. */
const OVERBODIG = new Set(["media", "websocket", "eventsource", "texttrack", "ping", "cspviolationreport", "prefetch"]);

export type Verzoek = {
  url: string;
  /** puppeteer's resourceType(): document, stylesheet, image, font, script, fetch, media, … */
  soort: string;
  /** Een hoofdnavigatie van het tabblad (geen iframe, geen fetch). */
  hoofdnavigatie: boolean;
};

export type Besluit = { blokkeer: false } | { blokkeer: true; reden: "extern" | "tracking" | "overbodig" | "prefetch" };

export function beoordeelVerzoek(v: Verzoek, demoOrigin: string): Besluit {
  let url: URL;
  try {
    url = new URL(v.url);
  } catch {
    return { blokkeer: false };
  }
  if (url.protocol === "data:" || url.protocol === "blob:") return { blokkeer: false };

  // Blijf op de demo: een redirect of navigatie naar een ander domein komt er niet in.
  if (v.hoofdnavigatie) return url.origin === demoOrigin ? { blokkeer: false } : { blokkeer: true, reden: "extern" };

  const host = url.hostname.toLowerCase();
  if (TRACKING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return { blokkeer: true, reden: "tracking" };
  if (TRACKING_PADEN.some((r) => r.test(url.pathname))) return { blokkeer: true, reden: "tracking" };
  if (OVERBODIG.has(v.soort)) return { blokkeer: true, reden: "overbodig" };
  // Next.js haalt voor elke zichtbare link alvast de volgende pagina op (?_rsc=…).
  // Wij openen elke pagina vers, dus die prefetches kosten alleen rekentijd.
  if (v.soort === "fetch" && url.searchParams.has("_rsc")) return { blokkeer: true, reden: "prefetch" };
  return { blokkeer: false };
}
