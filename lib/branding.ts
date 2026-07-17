/**
 * Centrale branding van DogWare — de enige bron van waarheid.
 *
 * Logo's, naam, slogan, kleuren en metadata worden UITSLUITEND hieruit
 * opgehaald. Een toekomstige rebrand = alleen dit bestand + de bestanden in
 * /public/brand en /app (icon.png, apple-icon.png, favicon.ico) vervangen.
 *
 * Client-safe: geen server-only imports.
 */

export const branding = {
  /** Bedrijfsnaam */
  name: "DogWare",
  /** Officiële slogan (uit het logo) */
  slogan: "Meer tijd voor wat telt",
  /** SEO-titel */
  title: "DogWare — Meer tijd voor wat telt",
  /** SEO-omschrijving */
  description:
    "Het complete platform voor hondenscholen, uitlaatservices, trimsalons en dierenprofessionals. Planning, klanten, betalingen en administratie: alles op één plek, alles automatisch.",
  keywords: [
    "DogWare",
    "hondenschool software",
    "uitlaatservice software",
    "trimsalon software",
    "dierenbedrijf software",
    "gedragstherapie",
    "hondenbedrijf platform",
    "planning honden",
    "facturatie hondenbedrijf",
  ],

  /** Productie-URL; lokaal/preview overschrijfbaar via NEXT_PUBLIC_SITE_URL */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://dogware.nl",

  /** Merk-kleuren (gelijk aan de tokens in globals.css) */
  colors: {
    primary: "#e0562a", // brand-oranje
    secondary: "#3f6b53", // sage-groen
    ink: "#1c150f",
    background: "#fbf8f3", // cream
  },

  /** Logopaden (public/). Zelfde logo werkt op licht én donker. */
  logo: {
    /** Volledig logo met tagline (1774×887, transparant) */
    full: "/brand/logo.png",
    /** Vierkant beeldmerk: de D met hondenkop (480×480, transparant) */
    mark: "/brand/mark.png",
    /** Verkleinde versie voor e-mailheaders (480 breed) */
    email: "/brand/logo-email.png",
  },
} as const;

/** Absolute URL naar een public-asset (voor e-mails, JSON-LD, Open Graph). */
export function absoluteUrl(path: string): string {
  return `${branding.siteUrl}${path}`;
}

/**
 * De vaste voordelen voor een nieuwe klant die via een persoonlijke
 * partnerlink binnenkomt. Eén bron van waarheid, zodat de welkomstmelding,
 * de bevestiging en (later) de daadwerkelijke korting hetzelfde tonen.
 * Een partner kan hier in de toekomst van afwijken via newCustomerPerks.
 */
export const REFERRAL_BENEFITS = [
  "10% korting op de opstartkosten",
  "Je eerste maand van het abonnement gratis",
] as const;
