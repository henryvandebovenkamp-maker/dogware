import { Heart, MessageCircleHeart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRANCHES } from "@/lib/branches";
import { NEEDS } from "@/lib/needs";

/**
 * De hoofdnavigatie van de publieke site — één bron voor desktop én mobiel.
 *
 * De volgorde vertelt het verhaal dat de hero begint: eerst voor wie DogWare
 * is, dan wat het regelt, dan hoe het werkt, dan het bewijs, dan wie erachter
 * zit. Bewust géén losse productnamen meer in de bovenste rij: "Webshop" stond
 * daar eerder als eigen item, waardoor DogWare kon overkomen als een
 * webshopproduct. Het is nu wat het is — één van de dingen die DogWare regelt.
 *
 * De twee lijsten komen rechtstreeks uit de bestaande configuratie
 * (`BRANCHES`, `NEEDS`), zodat een nieuwe branche of oplossingspagina vanzelf
 * in het menu verschijnt en er nooit een tweede lijst uit de pas gaat lopen.
 */

export type NavLink = {
  label: string;
  href: string;
  icon?: LucideIcon;
};

export type NavGroep = {
  label: string;
  /** Waar de kop zelf heen gaat — ook als er een uitklap onder hangt. */
  href: string;
  /** Gevuld = rustige uitklap op desktop, uitgeschreven blok op mobiel. */
  items?: NavLink[];
  /** Afsluitende regel onderin de uitklap. */
  meer?: NavLink;
};

export const HOOFDNAV: NavGroep[] = [
  {
    label: "Voor jouw bedrijf",
    href: "/#branches",
    items: BRANCHES.map((b) => ({
      label: b.naam,
      href: b.path,
      icon: b.icon,
    })),
    meer: { label: "Alle hondenbedrijven", href: "/#branches" },
  },
  {
    label: "Wat DogWare regelt",
    href: "/#oplossingen",
    items: NEEDS.map((n) => ({
      label: n.titel,
      href: n.path,
      icon: n.icon,
    })),
    meer: { label: "Alles wat DogWare regelt", href: "/#oplossingen" },
  },
  {
    // De sectie die één klant door het hele bedrijf volgt: van eerste klik tot
    // vaste klant. Precies het "zo werkt het"-verhaal, in gewone taal.
    label: "Zo werkt het",
    href: "/#oplossing",
  },
  {
    // De drie echte klantwebsites: van buiten helemaal hun bedrijf, van binnen
    // DogWare.
    label: "Voorbeelden",
    href: "/#voorbeelden",
  },
  {
    label: "Over DogWare",
    href: "/#verhaal",
    items: [
      { label: "Het verhaal achter DogWare", href: "/#verhaal", icon: Heart },
      { label: "Waarom DogWare anders werkt", href: "/#verschil", icon: Sparkles },
      { label: "Contact", href: "/contact", icon: MessageCircleHeart },
    ],
  },
];
