/**
 * Het korte formulier voor een directe klant — alleen wat nodig is om het
 * dossier aan te maken. Geen intake: wat we bouwen staat straks in de
 * opdrachtbevestiging, niet hier.
 *
 * Puur, zodat de validatie zonder database of request te testen is.
 */

export type DirecteKlantVelden = {
  bedrijfsnaam: string;
  naam: string;
  email: string;
  telefoon: string;
  plaats: string;
  website: string;
};

const MAX: Record<keyof DirecteKlantVelden, number> = {
  bedrijfsnaam: 255,
  naam: 160,
  email: 320,
  telefoon: 60,
  plaats: 120,
  website: 500,
};

const VERPLICHT: readonly (keyof DirecteKlantVelden)[] = [
  "bedrijfsnaam",
  "naam",
  "email",
  "telefoon",
  "plaats",
];

const LABEL: Record<keyof DirecteKlantVelden, string> = {
  bedrijfsnaam: "Vul de bedrijfsnaam in.",
  naam: "Vul de naam van de contactpersoon in.",
  email: "Vul een geldig e-mailadres in.",
  telefoon: "Vul een telefoonnummer in.",
  plaats: "Vul de plaats in.",
  website: "",
};

export function leesDirecteKlant(
  bron: { get(naam: string): unknown },
):
  | { ok: true; waarden: DirecteKlantVelden }
  | { ok: false; waarden: DirecteKlantVelden; fouten: Partial<Record<keyof DirecteKlantVelden, string>> } {
  const lees = (k: keyof DirecteKlantVelden) =>
    String(bron.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, MAX[k]);

  const waarden: DirecteKlantVelden = {
    bedrijfsnaam: lees("bedrijfsnaam"),
    naam: lees("naam"),
    email: lees("email").toLowerCase(),
    telefoon: lees("telefoon"),
    plaats: lees("plaats"),
    website: lees("website"),
  };

  const fouten: Partial<Record<keyof DirecteKlantVelden, string>> = {};
  for (const k of VERPLICHT) if (!waarden[k]) fouten[k] = LABEL[k];
  if (waarden.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waarden.email)) {
    fouten.email = LABEL.email;
  }

  return Object.keys(fouten).length ? { ok: false, waarden, fouten } : { ok: true, waarden };
}
