/**
 * Gedeelde definities voor de persoonlijke-demo-intake.
 * Client-safe: geen server-only imports.
 */

export const DIENSTEN = [
  "Hondenschool",
  "Uitlaatservice",
  "Dagopvang",
  "Pension",
  "Trimsalon",
  "Gedragstherapie",
  "Hondenoppas aan huis",
  "Webshop",
  "E-learning",
] as const;

export const SOFTWARE = [
  "Excel",
  "Google Agenda",
  "WordPress",
  "WhatsApp",
  "Facebook",
  "Mail",
  "Agenda op papier",
  "Eigen systeem",
  "Anders",
] as const;

export const TIJDVRETERS = [
  "Planning",
  "Klanten beantwoorden",
  "Website aanpassen",
  "Facturen",
  "Betalingen",
  "Agenda",
  "Administratie",
  "Contracten",
  "Personeelsplanning",
  "Boekingen",
  "Anders",
] as const;

export const FUNCTIES = [
  "Online boeken",
  "Klantportaal",
  "Betalen",
  "Planning",
  "Personeelsportaal",
  "E-learning",
  "Strippenkaarten",
  "Nieuwsbrieven",
  "Pushberichten",
] as const;

export const WEBSITE_OPTIES = [
  { value: "nee", label: "Nee" },
  { value: "ja", label: "Ja" },
  { value: "ja-nieuw", label: "Ja, maar ik wil iets nieuws" },
] as const;

export type IntakeData = {
  // Stap 1 — Over jou
  bedrijfsnaam: string;
  naam: string;
  email: string;
  telefoon: string;
  website: string;
  plaats: string;
  // Stap 2 — Diensten
  diensten: string[];
  dienstenAnders: string;
  // Stap 3 — Huidige situatie
  heeftWebsite: "" | "nee" | "ja" | "ja-nieuw";
  websiteGoed: string;
  websiteMist: string;
  software: string[];
  // Stap 4 — Frustraties & droom
  tijdvreters: string[];
  droomscenario: string;
  // Stap 5 — Inspiratie & huisstijl
  inspiratie: string;
  heeftLogo: "" | "ja" | "nee";
  huisstijl: string;
  uploads: string[];
  // Stap 6 — Wensen & afsluiting
  functies: string[];
  opmerkingen: string;
};

export const EMPTY_INTAKE: IntakeData = {
  bedrijfsnaam: "",
  naam: "",
  email: "",
  telefoon: "",
  website: "",
  plaats: "",
  diensten: [],
  dienstenAnders: "",
  heeftWebsite: "",
  websiteGoed: "",
  websiteMist: "",
  software: [],
  tijdvreters: [],
  droomscenario: "",
  inspiratie: "",
  heeftLogo: "",
  huisstijl: "",
  uploads: [],
  functies: [],
  opmerkingen: "",
};
