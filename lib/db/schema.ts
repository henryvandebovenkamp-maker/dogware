import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* =========================================================================
 * Gebruikers & authenticatie
 * ========================================================================= */

/** Rollen — later uitbreidbaar met ADMIN, SALES, SUPPORT, ACCOUNTING. */
export const USER_ROLES = ["SUPER_ADMIN", "AFFILIATE_PARTNER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["INVITED", "ACTIVE", "BLOCKED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    naam: text("naam").notNull(),
    role: text("role").$type<UserRole>().notNull(),
    status: text("status").$type<UserStatus>().notNull().default("INVITED"),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/** Serversessies — token wordt alleen als SHA-256-hash bewaard. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

/** Eenmalige tokens voor uitnodigingen (alleen hash opgeslagen). */
export const AUTH_TOKEN_TYPES = ["INVITE"] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AuthTokenType>().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash),
    index("auth_tokens_user_idx").on(t.userId, t.type),
  ],
);

/**
 * Wachtwoordloze login-challenges: één rij per inlogpoging, met alleen
 * hashes van de Magic Link-token en de Magic Code. Geen wachtwoorden —
 * DogWare is volledig passwordless.
 */
export const loginChallenges = pgTable(
  "login_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    requestedUserAgent: text("requested_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("login_challenges_token_idx").on(t.tokenHash),
    index("login_challenges_user_idx").on(t.userId, t.createdAt),
    index("login_challenges_email_idx").on(t.email, t.createdAt),
  ],
);

/* =========================================================================
 * Partnerprogramma
 * ========================================================================= */

export const PARTNER_STATUSES = [
  "INVITED",
  "ACTIVE",
  "PAUSED",
  "BLOCKED",
  "ENDED",
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    bedrijfsnaam: text("bedrijfsnaam").notNull(),
    telefoon: text("telefoon"),
    website: text("website"),
    adres: text("adres"),
    kvkNummer: text("kvk_nummer"), // voorbereid voor later
    btwNummer: text("btw_nummer"), // voorbereid voor later
    /** Publieke referralcode — altijd hoofdletters, uniek */
    referralCode: text("referral_code").notNull(),
    status: text("status").$type<PartnerStatus>().notNull().default("INVITED"),
    notitie: text("notitie"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("partners_code_idx").on(t.referralCode),
    uniqueIndex("partners_user_idx").on(t.userId),
    index("partners_status_idx").on(t.status),
  ],
);

/** Geregistreerde bezoeken via een partnerlink. */
export const referralClicks = pgTable(
  "referral_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    referralCode: text("referral_code").notNull(), // snapshot
    /** Anonieme bezoekers-id uit first-party cookie */
    visitorId: text("visitor_id").notNull(),
    landingPage: text("landing_page").notNull(),
    utm: jsonb("utm").$type<Record<string, string>>(),
    /** Beperkte user agent (max 120 tekens) */
    userAgent: text("user_agent"),
    isBot: boolean("is_bot").notNull().default(false),
    isInternal: boolean("is_internal").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("clicks_partner_idx").on(t.partnerId, t.firstSeenAt),
    index("clicks_visitor_idx").on(t.visitorId, t.partnerId),
  ],
);

/* =========================================================================
 * Auditlog
 * ========================================================================= */

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = systeemactie */
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activity_object_idx").on(t.objectType, t.objectId),
    index("activity_created_idx").on(t.createdAt),
  ],
);

/* =========================================================================
 * Formulierconcepten (autosave) — één generiek model voor alle formulieren
 * ========================================================================= */

export const DRAFT_STATUSES = [
  "IN_PROGRESS",
  "SUBMITTED",
  "EXPIRED",
  "ABANDONED",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const formDrafts = pgTable(
  "form_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Bijv. "demo-intake", "partner-new", "profiel" */
    formType: text("form_type").notNull(),
    status: text("status").$type<DraftStatus>().notNull().default("IN_PROGRESS"),
    /** Optimistic concurrency: elke save verhoogt dit */
    version: integer("version").notNull().default(0),
    currentStep: text("current_step"),
    /** De (deels ingevulde) formulierinhoud — nooit gevoelige tokens/secrets */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),

    /** Ingelogde eigenaar (null bij openbare bezoeker) */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Openbare bezoeker: alleen de HASH van het drafttoken, nooit leesbaar */
    anonymousTokenHash: text("anonymous_token_hash"),

    lastSavedAt: timestamp("last_saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drafts_user_idx").on(t.userId, t.formType),
    uniqueIndex("drafts_anon_idx").on(t.anonymousTokenHash),
    index("drafts_status_idx").on(t.status, t.expiresAt),
    index("drafts_type_idx").on(t.formType, t.lastSavedAt),
  ],
);

export type FormDraft = typeof formDrafts.$inferSelect;

/* =========================================================================
 * Leads (demo-aanvragen) — één bron van waarheid
 * ========================================================================= */

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

export const ATTRIBUTION_MODELS = ["LAST_VALID_REFERRAL", "MANUAL"] as const;
export type AttributionModel = (typeof ATTRIBUTION_MODELS)[number];

/** Volledige intake van een persoonlijke-demo-aanvraag. */
export const leads = pgTable(
  "leads",
  {
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

    // Partnerattributie — leeg bij organische aanvraag
    affiliatePartnerId: uuid("affiliate_partner_id").references(
      () => partners.id,
      { onDelete: "set null" },
    ),
    referralCodeSnapshot: text("referral_code_snapshot"),
    referralClickId: uuid("referral_click_id").references(
      () => referralClicks.id,
      { onDelete: "set null" },
    ),
    attributionModel: text("attribution_model").$type<AttributionModel>(),
    attributedAt: timestamp("attributed_at", { withTimezone: true }),

    // Adminportaal
    status: text("status").$type<LeadStatus>().notNull().default("nieuw"),
    notities: text("notities"),
  },
  (t) => [
    index("leads_created_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
    index("leads_partner_idx").on(t.affiliatePartnerId),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type User = typeof users.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type ReferralClick = typeof referralClicks.$inferSelect;
