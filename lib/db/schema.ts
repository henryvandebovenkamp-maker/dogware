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
export const USER_ROLES = [
  "SUPER_ADMIN",
  "AFFILIATE_PARTNER",
  "CUSTOMER",
] as const;
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
    // Profiel — door de partner zelf aangevuld
    voornaam: text("voornaam"),
    achternaam: text("achternaam"),
    avatarUrl: text("avatar_url"),
    /** Optioneel — we vragen bij aanmaken alleen naam + e-mail */
    bedrijfsnaam: text("bedrijfsnaam"),
    telefoon: text("telefoon"),
    website: text("website"),
    adres: text("adres"),

    // Uitbetalingen — IBAN/BIC versleuteld opgeslagen (enc:...)
    rekeninghouder: text("rekeninghouder"),
    ibanEnc: text("iban_enc"),
    bicEnc: text("bic_enc"),
    land: text("land"),

    // Facturatie
    factuurType: text("factuur_type").$type<"particulier" | "zakelijk">(),
    kvkNummer: text("kvk_nummer"),
    btwNummer: text("btw_nummer"),
    /** Publieke referralcode — hoofdletterongevoelig, uniek */
    referralCode: text("referral_code").notNull(),
    /** Beloning per verkochte website, in centen (server-side, aanpasbaar) */
    commissionCents: integer("commission_cents").notNull().default(50000),
    /** Voordelen voor de nieuwe klant die via deze partner binnenkomt */
    newCustomerPerks: jsonb("new_customer_perks").$type<string[]>().notNull().default([]),
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

    // Bron van de aanvraag
    source: text("source").$type<LeadSource>().notNull().default("website"),

    // Demo Journey — stage + handmatig geplaatste voorbeeldlinks
    stage: text("stage").$type<JourneyStage>().notNull().default("aangevraagd"),
    /** Voorbeeldwebsite-URL (handmatig geplakt door de beheerder) */
    demoDomain: text("demo_domain"),
    /** Demoportaal-URL */
    demoPortalUrl: text("demo_portal_url"),
    /** E-mailadres waarmee de klant inlogt (passwordless) */
    demoLoginEmail: text("demo_login_email"),
    // Behouden voor bestaande data (niet meer gebruikt):
    demoTemplate: text("demo_template"),
    demoPrimaryColor: text("demo_primary_color"),
    demoSecondaryColor: text("demo_secondary_color"),
    /** Gekoppeld demo-klantaccount (passwordless magic login) */
    demoCustomerUserId: uuid("demo_customer_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    demoSentAt: timestamp("demo_sent_at", { withTimezone: true }),

    // Adminportaal
    status: text("status").$type<LeadStatus>().notNull().default("nieuw"),
    notities: text("notities"),
  },
  (t) => [
    index("leads_created_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
    index("leads_stage_idx").on(t.stage),
    index("leads_partner_idx").on(t.affiliatePartnerId),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

/* =========================================================================
 * Demo Journey — stages, tijdlijn-events en interne taken
 * ========================================================================= */

export const LEAD_SOURCES = [
  "website",
  "affiliate",
  "referral",
  "handmatig",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** De vaste stappen van de klantreis, in volgorde. */
export const JOURNEY_STAGES = [
  "aangevraagd",
  "voorbereiden",
  "demo-verstuurd",
  "ingelogd",
  "bekeken",
  "feedback",
  "afspraak",
  "offerte",
  "akkoord",
  "gestart",
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/** Chronologisch logboek per aanvraag (de zichtbare tijdlijn). */
export const journeyEvents = pgTable(
  "journey_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Korte machinecode, bijv. "email_sent", "first_login", "stage_changed" */
    kind: text("kind").notNull(),
    /** Menselijke omschrijving voor de tijdlijn */
    label: text("label").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("journey_events_lead_idx").on(t.leadId, t.createdAt)],
);

/** Interne, afvinkbare taken per aanvraag. */
export const journeyTasks = pgTable(
  "journey_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("journey_tasks_lead_idx").on(t.leadId, t.createdAt)],
);

export type JourneyEvent = typeof journeyEvents.$inferSelect;
export type JourneyTask = typeof journeyTasks.$inferSelect;

/* =========================================================================
 * Commerciële journey — afspraak, betalingen, abonnement (Mollie)
 * ========================================================================= */

/** Uitgebreide commerciële status (naast de zichtbare journey-stage). */
export const COMMERCE_STATUSES = [
  "DRAFT",
  "PROPOSAL_SENT",
  "PROPOSAL_ACCEPTED",
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "BUILDING",
  "DELIVERY_READY",
  "FINAL_PAYMENT_PENDING",
  "FULLY_PAID",
  "SUBSCRIPTION_SCHEDULED",
  "ACTIVE_CUSTOMER",
  "PAYMENT_ISSUE",
  "CANCELLED",
] as const;
export type CommerceStatus = (typeof COMMERCE_STATUSES)[number];

/**
 * Eén commerciële afspraak per lead/klant — de bron van waarheid voor alle
 * bedragen. Alles in eurocenten. Gekoppeld aan de bestaande lead (klant).
 */
export const commerce = pgTable(
  "commerce",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    status: text("status").$type<CommerceStatus>().notNull().default("DRAFT"),

    // Centrale afspraak (centen)
    projectCents: integer("project_cents").notNull().default(0),
    setupCents: integer("setup_cents").notNull().default(0),
    discountType: text("discount_type").$type<"none" | "amount" | "percent">().notNull().default("none"),
    discountValue: integer("discount_value").notNull().default(0),
    vatPercent: integer("vat_percent").notNull().default(21),
    depositPercent: integer("deposit_percent").notNull().default(50),

    // Abonnement
    monthlyCents: integer("monthly_cents").notNull().default(0),
    freeMonths: integer("free_months").notNull().default(0),
    introDiscountPercent: integer("intro_discount_percent").notNull().default(0),
    introDiscountMonths: integer("intro_discount_months").notNull().default(0),
    subscriptionStartRule: text("subscription_start_rule")
      .$type<"na-oplevering" | "na-laatste-betaling" | "eerste-volgende-maand" | "handmatig">()
      .notNull()
      .default("na-oplevering"),
    subscriptionStartAt: timestamp("subscription_start_at", { withTimezone: true }),
    opmerkingen: text("opmerkingen"),

    // Voorstel — geaccepteerde versie wordt onveranderlijk vastgelegd
    proposalVersion: integer("proposal_version").notNull().default(0),
    proposalSentAt: timestamp("proposal_sent_at", { withTimezone: true }),
    /** Bevroren momentopname van de afspraak bij akkoord (JSON) */
    acceptedSnapshot: jsonb("accepted_snapshot").$type<Record<string, unknown>>(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedIpHash: text("accepted_ip_hash"),

    // Mollie recurring
    mollieCustomerId: text("mollie_customer_id"),
    mollieMandateId: text("mollie_mandate_id"),
    mandateStatus: text("mandate_status"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("commerce_lead_idx").on(t.leadId)],
);

export const PAYMENT_TYPES = [
  "DEPOSIT",
  "FINAL_PAYMENT",
  "SUBSCRIPTION",
  "MANUAL_CORRECTION",
  "REFUND",
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = [
  "CREATED",
  "OPEN",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Elke betaling (eenmalig of periodiek). Mollie blijft bron van waarheid. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commerceId: uuid("commerce_id")
      .notNull()
      .references(() => commerce.id, { onDelete: "cascade" }),
    type: text("type").$type<PaymentType>().notNull(),
    status: text("status").$type<PaymentStatus>().notNull().default("CREATED"),
    amountCents: integer("amount_cents").notNull(),
    /** Mollie payment-ID (tr_...) — uniek */
    molliePaymentId: text("mollie_payment_id"),
    /** Periode voor abonnementsbetalingen, bijv. "2026-08" — voorkomt dubbele incasso */
    periode: text("periode"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Idempotentie: markeert of de 'betaald'-verwerking al is uitgevoerd */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_mollie_idx").on(t.molliePaymentId),
    // Blokkeert dubbele incasso voor dezelfde abonnementsperiode
    uniqueIndex("payments_sub_period_idx").on(t.commerceId, t.type, t.periode),
    index("payments_commerce_idx").on(t.commerceId, t.createdAt),
  ],
);

/* =========================================================================
 * Site-instellingen (singleton) — door de Super Admin beheerd
 * ========================================================================= */

/**
 * Eén rij (id = "singleton") met runtime-instellingen die de Super Admin kan
 * aanpassen zonder deploy. Nu alleen een optionele override voor het
 * e-maillogo; leeg = de statische default uit lib/branding.ts. De website
 * blijft hier bewust buiten.
 */
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("singleton"),
  /** Override voor het logo in e-mails (absolute URL). Null = default. */
  emailLogoUrl: text("email_logo_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export type Commerce = typeof commerce.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type User = typeof users.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type ReferralClick = typeof referralClicks.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;

/* =========================================================================
 * Groei — de persoonlijke acquisitieomgeving
 *
 * Geen CRM en geen mailtool: een omgeving die helpt om op een menselijke
 * manier contact te leggen met collega-hondenbedrijven. Henry blijft altijd
 * de afzender en beslist alles; DogWare bereidt alleen voor.
 *
 * Alle tabellen dragen `ownerUserId`. Vandaag is dat altijd Henry, maar
 * daardoor kunnen partners later hun eigen Groei-omgeving krijgen zonder
 * datamigratie.
 * ========================================================================= */

/** Waar een bedrijf staat in de reis. Bewust menselijke woorden. */
export const GROEI_STAPPEN = [
  "gevonden",      // ontdekt, nog niets mee gedaan
  "bekeken",       // website geanalyseerd
  "voorbereid",    // voorstel + conceptmail klaar voor Henry
  "verstuurd",     // Henry heeft verstuurd
  "gelezen",       // voorstelpagina geopend
  "reactie",       // er is geantwoord
  "gesprek",       // loopt een gesprek
  "klant",         // is klant geworden
  "niet-nu",       // vriendelijk afgehaakt of niet passend
] as const;
export type GroeiStap = (typeof GROEI_STAPPEN)[number];

/**
 * De juridische grondslag om dit bedrijf te mogen benaderen.
 * Voor rechtspersonen geldt in Nederland een opt-outregime; een eenmanszaak
 * is juridisch een natuurlijk persoon en vereist toestemming. Dit veld dwingt
 * die afweging af vóór er iets verstuurd wordt.
 */
export const GROEI_GRONDSLAGEN = [
  "onbekend",        // nog niet vastgesteld — verzenden geblokkeerd
  "rechtspersoon",   // BV/VOF/stichting: gerechtvaardigd belang, met afmeldrecht
  "toestemming",     // heeft expliciet toestemming gegeven
  "klantrelatie",    // bestaande relatie
] as const;
export type GroeiGrondslag = (typeof GROEI_GRONDSLAGEN)[number];

/** Een hondenbedrijf dat we mogelijk willen verrassen. */
export const groeiProspects = pgTable(
  "groei_prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Wie zijn ze
    bedrijfsnaam: text("bedrijfsnaam").notNull(),
    branche: text("branche"),
    plaats: text("plaats"),
    website: text("website"),
    email: text("email"),
    telefoon: text("telefoon"),
    contactpersoon: text("contactpersoon"),
    /** Voornaam voor de aanhef — apart, want "Hi Jan" is geen "Hi Jan de Vries" */
    voornaam: text("voornaam"),
    logoUrl: text("logo_url"),
    socials: jsonb("socials").$type<Record<string, string>>().notNull().default({}),
    googleRating: text("google_rating"),
    googleReviews: integer("google_reviews"),

    /**
     * Waar elk gegeven vandaan komt, per veld. Verplicht onder de AVG om te
     * kunnen verantwoorden hoe je aan iemands gegevens komt.
     */
    herkomst: jsonb("herkomst").$type<Record<string, string>>().notNull().default({}),
    grondslag: text("grondslag").$type<GroeiGrondslag>().notNull().default("onbekend"),

    stap: text("stap").$type<GroeiStap>().notNull().default("gevonden"),
    /** Vrije notities van Henry */
    notities: text("notities"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("groei_prospects_owner_idx").on(t.ownerUserId, t.stap),
    index("groei_prospects_created_idx").on(t.createdAt),
    uniqueIndex("groei_prospects_website_idx").on(t.ownerUserId, t.website),
  ],
);

/** Wat DogWare van hun website begreep. Altijd opbouwend geformuleerd. */
export const groeiAnalyses = pgTable(
  "groei_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => groeiProspects.id, { onDelete: "cascade" }),

    /** Wat er al goed gaat — hier begint elk gesprek mee */
    sterk: jsonb("sterk").$type<string[]>().notNull().default([]),
    /** Kansen, positief geformuleerd: "zou een mooie aanvulling zijn" */
    kansen: jsonb("kansen")
      .$type<{ titel: string; waarom: string; module: string }[]>()
      .notNull()
      .default([]),
    /**
     * Concreet waargenomen details van hun site. Dit is het bewijs dat er
     * echt gekeken is; zonder minstens één detail mag er niets verstuurd.
     */
    details: jsonb("details")
      .$type<{ wat: string; waar: string }[]>()
      .notNull()
      .default([]),
    /** Past DogWare hier eigenlijk wel? Nee is een geldig en nuttig antwoord. */
    past: boolean("past").notNull().default(true),
    passendheidUitleg: text("passendheid_uitleg"),

    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groei_analyses_prospect_idx").on(t.prospectId, t.createdAt)],
);

/** Het inspiratievoorstel: een pagina in hun eigen stijl, geen offerte. */
export const groeiVoorstellen = pgTable(
  "groei_voorstellen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => groeiProspects.id, { onDelete: "cascade" }),
    /** Onraadbare sleutel in de URL — geen opsombare id's */
    token: text("token").notNull(),

    titel: text("titel").notNull(),
    intro: text("intro").notNull(),
    secties: jsonb("secties")
      .$type<{ kop: string; tekst: string; module?: string }[]>()
      .notNull()
      .default([]),
    /** Kleuren uit hun huisstijl, zodat het voelt als van hen */
    accentKleur: text("accent_kleur"),

    /** Bewuste klik in plaats van een verborgen trackingpixel */
    geopendAt: timestamp("geopend_at", { withTimezone: true }),
    aantalKeerGeopend: integer("aantal_keer_geopend").notNull().default(0),
    laatstGeopendAt: timestamp("laatst_geopend_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("groei_voorstellen_token_idx").on(t.token),
    index("groei_voorstellen_prospect_idx").on(t.prospectId),
  ],
);

/** Een bericht aan een bedrijf. Altijd van Henry, nooit van "het systeem". */
export const groeiBerichten = pgTable(
  "groei_berichten",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => groeiProspects.id, { onDelete: "cascade" }),
    voorstelId: uuid("voorstel_id").references(() => groeiVoorstellen.id, {
      onDelete: "set null",
    }),

    onderwerp: text("onderwerp").notNull(),
    tekst: text("tekst").notNull(),
    /** Concept tot Henry op verzenden drukt */
    verstuurdAt: timestamp("verstuurd_at", { withTimezone: true }),
    /** Door Henry aangepast vóór verzenden? Voedt de ideeënbibliotheek. */
    bewerktDoorHenry: boolean("bewerkt_door_henry").notNull().default(false),
    model: text("model"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groei_berichten_prospect_idx").on(t.prospectId, t.createdAt)],
);

/** Tijdlijn per bedrijf — dezelfde vorm als journey_events, eigen tabel. */
export const groeiEvents = pgTable(
  "groei_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => groeiProspects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groei_events_prospect_idx").on(t.prospectId, t.createdAt)],
);

/**
 * Bedrijven die niet benaderd willen worden. Los van prospects, want een
 * afmelding moet blijven staan ook als het bedrijf zelf verwijderd wordt.
 */
export const groeiBlokkeerlijst = pgTable(
  "groei_blokkeerlijst",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Genormaliseerd (lowercase, getrimd) */
    email: text("email"),
    domein: text("domein"),
    reden: text("reden"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("groei_blokkeerlijst_email_idx").on(t.email),
    index("groei_blokkeerlijst_domein_idx").on(t.domein),
  ],
);

/**
 * De ideeënbibliotheek: onderdelen die aantoonbaar werkten. Bewust gevoed
 * door menselijke reacties, niet door verzendaantallen — anders leert het
 * systeem "wat vaak verstuurd is" in plaats van "wat raakte".
 */
export const groeiIdeeen = pgTable(
  "groei_ideeen",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branche: text("branche"),
    soort: text("soort").notNull(), // "opening" | "kans" | "sectie" | "afsluiter"
    tekst: text("tekst").notNull(),
    /** Hoe vaak dit onderdeel meeging in een bericht dat een reactie kreeg */
    raakScore: integer("raak_score").notNull().default(0),
    gebruikt: integer("gebruikt").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groei_ideeen_owner_idx").on(t.ownerUserId, t.branche, t.soort)],
);

export type GroeiProspect = typeof groeiProspects.$inferSelect;
export type NewGroeiProspect = typeof groeiProspects.$inferInsert;
export type GroeiAnalyse = typeof groeiAnalyses.$inferSelect;
export type GroeiVoorstel = typeof groeiVoorstellen.$inferSelect;
export type GroeiBericht = typeof groeiBerichten.$inferSelect;
export type GroeiEvent = typeof groeiEvents.$inferSelect;
export type GroeiIdee = typeof groeiIdeeen.$inferSelect;
