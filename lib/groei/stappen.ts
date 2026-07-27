/**
 * De reis van een bedrijf door de Groei-omgeving.
 * Client-safe: geen server-only imports, zodat schermen hieruit kunnen lezen.
 */

import type { GroeiGrondslag, GroeiStap } from "@/lib/db/schema";

export const STAP_META: Record<
  GroeiStap,
  { label: string; uitleg: string; kleur: "grijs" | "brand" | "sage" | "gold" }
> = {
  gevonden: {
    label: "Gevonden",
    uitleg: "Een collega die misschien iets aan DogWare heeft.",
    kleur: "grijs",
  },
  bekeken: {
    label: "Bekeken",
    uitleg: "Ik heb hun website doorgenomen.",
    kleur: "grijs",
  },
  voorbereid: {
    label: "Klaar voor jou",
    uitleg: "Voorstel en bericht liggen klaar — jij beslist.",
    kleur: "brand",
  },
  verstuurd: {
    label: "Verstuurd",
    uitleg: "Je bericht is onderweg.",
    kleur: "brand",
  },
  gelezen: {
    label: "Voorstel bekeken",
    uitleg: "Ze hebben je voorstel geopend.",
    kleur: "gold",
  },
  reactie: {
    label: "Gereageerd",
    uitleg: "Er is een antwoord gekomen.",
    kleur: "sage",
  },
  gesprek: {
    label: "In gesprek",
    uitleg: "Jullie hebben contact.",
    kleur: "sage",
  },
  klant: {
    label: "Klant",
    uitleg: "Ze werken nu met DogWare.",
    kleur: "sage",
  },
  "niet-nu": {
    label: "Nu even niet",
    uitleg: "Past niet, of liever niet benaderd worden.",
    kleur: "grijs",
  },
};

export const GRONDSLAG_META: Record<
  GroeiGrondslag,
  { label: string; magBenaderen: boolean; uitleg: string }
> = {
  onbekend: {
    label: "Nog niet vastgesteld",
    magBenaderen: false,
    uitleg:
      "Bepaal eerst of dit een rechtspersoon is. Een eenmanszaak is juridisch een persoon en vraagt om toestemming.",
  },
  rechtspersoon: {
    label: "Rechtspersoon",
    magBenaderen: true,
    uitleg:
      "BV, VOF of stichting: benaderen mag, mits je jezelf kenbaar maakt en afmelden altijd kan.",
  },
  toestemming: {
    label: "Heeft toestemming gegeven",
    magBenaderen: true,
    uitleg: "Ze hebben zelf aangegeven benaderd te willen worden.",
  },
  klantrelatie: {
    label: "Bestaande relatie",
    magBenaderen: true,
    uitleg: "Je hebt al zaken met ze gedaan.",
  },
};

/** De volgorde waarin de reis normaal verloopt. */
export const STAP_VOLGORDE: GroeiStap[] = [
  "gevonden",
  "bekeken",
  "voorbereid",
  "verstuurd",
  "gelezen",
  "reactie",
  "gesprek",
  "klant",
];

export function stapIndex(stap: GroeiStap): number {
  const i = STAP_VOLGORDE.indexOf(stap);
  return i === -1 ? -1 : i;
}
