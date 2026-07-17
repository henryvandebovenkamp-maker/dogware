import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Statussen voor leadopvolging in het adminportaal. */
export const LEAD_STATUSES = [
  "nieuw",
  "demo in de maak",
  "demo verstuurd",
  "contact gehad",
  "klant geworden",
  "afgevallen",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Volledige intake van een persoonlijke-demo-aanvraag. */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  // Stap 1 — Over jou
  bedrijfsnaam: text("bedrijfsnaam").notNull(),
  naam: text("naam").notNull(),
  email: text("email").notNull(),
  telefoon: text("telefoon"),
  website: text("website"),
  plaats: text("plaats").notNull(),

  // Stap 2 — Diensten
  diensten: jsonb("diensten").$type<string[]>().notNull().default([]),
  dienstenAnders: text("diensten_anders"),

  // Stap 3 — Huidige situatie
  heeftWebsite: text("heeft_website"), // "nee" | "ja" | "ja-nieuw"
  websiteGoed: text("website_goed"),
  websiteMist: text("website_mist"),
  software: jsonb("software").$type<string[]>().notNull().default([]),

  // Stap 4 — Frustraties & droom
  tijdvreters: jsonb("tijdvreters").$type<string[]>().notNull().default([]),
  droomscenario: text("droomscenario"),

  // Stap 5 — Inspiratie & huisstijl
  inspiratie: text("inspiratie"),
  heeftLogo: text("heeft_logo"), // "ja" | "nee"
  huisstijl: text("huisstijl"),
  uploads: jsonb("uploads").$type<string[]>().notNull().default([]),

  // Stap 6 — Wensen & afsluiting
  functies: jsonb("functies").$type<string[]>().notNull().default([]),
  opmerkingen: text("opmerkingen"),

  // Adminportaal
  status: text("status").$type<LeadStatus>().notNull().default("nieuw"),
  notities: text("notities"),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
