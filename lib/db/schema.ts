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
import { sql } from "drizzle-orm";

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

/**
 * Rollen per gebruiker — één e-mailadres, één account, meerdere rollen.
 *
 * `users.role` blijft bestaan als primaire rol (bepaalt o.a. de sessieduur en
 * is de rol waarmee het account ooit is aangemaakt). De volledige set rollen
 * staat hier: iemand kan tegelijk klant én partner zijn. De unieke index op
 * (user_id, role) maakt toekennen idempotent en race-condition-veilig.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<UserRole>().notNull(),
    /** Wie kende de rol toe? null = systeem/registratie. */
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_roles_user_role_idx").on(t.userId, t.role),
    index("user_roles_role_idx").on(t.role),
  ],
);

export type UserRoleRow = typeof userRoles.$inferSelect;

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

/**
 * De vaste stappen van de klantreis, in volgorde — één doorlopende journey van
 * demo-aanvraag tot actieve klant. De bestaande demo-stappen (aangevraagd t/m
 * gestart) zijn ongewijzigd gebleven, zodat bestaande aanvragen hun stage
 * houden; de commerciële stappen zijn ertussen en erachter geplaatst.
 *
 * `offerte` = voorstel voorbereiden, `akkoord` = voorstel geaccepteerd,
 * `gestart` = bouwfase. Die drie sleutels zijn bewust hergebruikt in plaats van
 * vervangen: een migratie van bestaande rijen is dan niet nodig.
 */
export const JOURNEY_STAGES = [
  "aangevraagd",
  "voorbereiden",
  "demo-verstuurd",
  "ingelogd",
  "bekeken",
  "feedback",
  "afspraak",
  "demo-akkoord",
  "offerte",
  "voorstel-verstuurd",
  "akkoord",
  "overeenkomst",
  "aanbetaling",
  "gestart",
  "revisies",
  "oplevering",
  "restbetaling",
  "mandaat",
  "live",
  "actief",
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/** Wie een gebeurtenis veroorzaakte. Bepaalt de weergave in de tijdlijn. */
export const EVENT_ACTORS = ["klant", "admin", "systeem"] as const;
export type EventActor = (typeof EVENT_ACTORS)[number];

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
    /**
     * Wie deze stap zette. Een echte kolom (niet alleen `meta`) omdat de
     * tijdlijn erop filtert en sorteert, en omdat "wie deed dit" bij een
     * commerciële journey achteraf reconstrueerbaar moet blijven.
     */
    actor: text("actor").$type<EventActor>().notNull().default("systeem"),
    /**
     * Strikt intern: nooit zichtbaar in de klantomgeving. De klantquery
     * filtert hier hard op, zodat een interne notitie er niet per ongeluk
     * doorheen glipt.
     */
    internal: boolean("internal").notNull().default(false),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("journey_events_lead_idx").on(t.leadId, t.createdAt),
    index("journey_events_public_idx").on(t.leadId, t.internal, t.createdAt),
  ],
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
    /**
     * Wanneer de taak af moet zijn. Leeg = geen datum; niet elke taak heeft er
     * een en een verzonnen deadline is erger dan geen.
     */
    dueAt: timestamp("due_at", { withTimezone: true }),
    /**
     * Wie hem oppakt. Verwijst naar een echte gebruiker in plaats van een
     * losse naamtekst, zodat een taak niet blijft hangen bij iemand die niet
     * meer bestaat. Leeg = van het huis.
     */
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("journey_tasks_lead_idx").on(t.leadId, t.createdAt)],
);

export type JourneyEvent = typeof journeyEvents.$inferSelect;
export type JourneyTask = typeof journeyTasks.$inferSelect;

/**
 * Verzonden e-mail per aanvraag.
 *
 * Tot nu toe was een verstuurde mail alleen een regel in de tijdlijn: je zag
 * dát er iets uitging, niet wát. Bij een vraag als "wat heb ik die klant ook
 * alweer gestuurd?" hielp dat niet.
 *
 * Bewust geen tweede mailsysteem: het versturen blijft volledig bij Resend en
 * lib/email. Dit is uitsluitend een logboek dat ná de verzendpoging wordt
 * weggeschreven — ook als die mislukt, want juist dán wil je het weten.
 *
 * De inhoud wordt niet opgeslagen. Een mail opnieuw opbouwen uit het sjabloon
 * geeft altijd de actuele versie, en een kopie van elke verstuurde HTML in de
 * database levert vooral opslag en een privacyvraag op.
 */
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Machinecode van het mailtype, bijv. "demo-ready" of "proposal-sent". */
    soort: text("soort").notNull(),
    ontvanger: text("ontvanger").notNull(),
    onderwerp: text("onderwerp").notNull(),
    /** "SENT" of "FAILED" — de uitkomst van de verzendpoging. */
    status: text("status").notNull(),
    /** Id bij Resend, om een aflevering later te kunnen opzoeken. */
    providerId: text("provider_id"),
    /** Waarom het misging, als het misging. */
    fout: text("fout"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("emails_lead_idx").on(t.leadId, t.createdAt)],
);

export type EmailLog = typeof emails.$inferSelect;

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

    /**
     * Onraadbare sleutel voor de klantomgeving (/traject/[token]). Bewust
     * roteerbaar door de beheerder, maar niet bij elke herinnering: anders
     * sterft de link uit de eerste mail zodra er een reminder uitgaat.
     */
    portalToken: text("portal_token"),

    // Mollie recurring
    mollieCustomerId: text("mollie_customer_id"),
    mollieMandateId: text("mollie_mandate_id"),
    mandateStatus: text("mandate_status"),
    mandateActivatedAt: timestamp("mandate_activated_at", { withTimezone: true }),
    mollieSubscriptionId: text("mollie_subscription_id"),
    subscriptionActivatedAt: timestamp("subscription_activated_at", { withTimezone: true }),

    // Mijlpalen van de commerciële journey (voor de tijdlijn en rapportage)
    buildStartedAt: timestamp("build_started_at", { withTimezone: true }),
    deliveryReadyAt: timestamp("delivery_ready_at", { withTimezone: true }),
    liveAt: timestamp("live_at", { withTimezone: true }),
    activeCustomerAt: timestamp("active_customer_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("commerce_lead_idx").on(t.leadId),
    uniqueIndex("commerce_portal_token_idx").on(t.portalToken),
  ],
);

/* =========================================================================
 * Voorstellen — versiebeheer
 *
 * Een verstuurd voorstel is onveranderlijk. Wijzigt de afspraak daarna, dan
 * ontstaat er een NIEUWE versie en gaat de vorige naar SUPERSEDED. Zo blijft
 * jaren later reconstrueerbaar waar de klant precies op akkoord ging.
 * ========================================================================= */

export const PROPOSAL_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "SUPERSEDED",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commerceId: uuid("commerce_id")
      .notNull()
      .references(() => commerce.id, { onDelete: "cascade" }),
    /** Ook op de lead vastgelegd: de journey blijft de centrale draad. */
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<ProposalStatus>().notNull().default("DRAFT"),

    // Inhoud
    titel: text("titel").notNull().default(""),
    intro: text("intro"),
    omschrijving: text("omschrijving"),
    /** Werkzaamheden — losse regels */
    werkzaamheden: jsonb("werkzaamheden").$type<string[]>().notNull().default([]),
    /** Modules/diensten — losse regels */
    modules: jsonb("modules").$type<string[]>().notNull().default([]),
    bijzonderheden: text("bijzonderheden"),
    geldigTot: timestamp("geldig_tot", { withTimezone: true }),

    /**
     * Bevroren prijsopbouw op het moment van versturen: configuratie én de
     * daaruit berekende bedragen. Nooit opnieuw berekenen uit de actuele
     * commerce-rij — die kan intussen gewijzigd zijn.
     */
    pricing: jsonb("pricing").$type<Record<string, unknown>>().notNull().default({}),

    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),

    // Acceptatie — audittechnisch traceerbaar
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedName: text("accepted_name"),
    acceptedIpHash: text("accepted_ip_hash"),
    acceptedUserAgent: text("accepted_user_agent"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
  },
  (t) => [
    uniqueIndex("proposals_version_idx").on(t.commerceId, t.version),
    index("proposals_lead_idx").on(t.leadId, t.version),
  ],
);

export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;

/* =========================================================================
 * Overeenkomsten — digitale ondertekening
 *
 * Altijd gekoppeld aan één proposal-versie. De voorwaardenversie én de
 * prijzen worden bevroren, zodat een latere wijziging een reeds getekende
 * overeenkomst nooit met terugwerkende kracht verandert.
 * ========================================================================= */

export const AGREEMENT_STATUSES = ["DRAFT", "SENT", "VIEWED", "SIGNED", "SUPERSEDED"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commerceId: uuid("commerce_id")
      .notNull()
      .references(() => commerce.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "restrict" }),
    /** Redundant vastgelegd zodat het versienummer leesbaar blijft in exports. */
    proposalVersion: integer("proposal_version").notNull(),

    status: text("status").$type<AgreementStatus>().notNull().default("DRAFT"),
    /** Versie van de DogWare-voorwaarden, bijv. "dw-1.0". */
    voorwaardenVersie: text("voorwaarden_versie").notNull(),
    /** Bevroren prijzen + maandbedrag, identiek aan de proposal-versie. */
    pricing: jsonb("pricing").$type<Record<string, unknown>>().notNull().default({}),

    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),

    // Ondertekenaar
    signerName: text("signer_name"),
    signerRole: text("signer_role"),
    signerEmail: text("signer_email"),
    signerPhone: text("signer_phone"),
    signerCompany: text("signer_company"),
    signerAddress: text("signer_address"),
    signerPostcode: text("signer_postcode"),
    signerCity: text("signer_city"),
    signerKvk: text("signer_kvk"),
    signerVat: text("signer_vat"),

    // Expliciete akkoorden — elk apart vastgelegd
    agreesOpdracht: boolean("agrees_opdracht").notNull().default(false),
    agreesInvestering: boolean("agrees_investering").notNull().default(false),
    agreesTermijnen: boolean("agrees_termijnen").notNull().default(false),
    agreesMaandbedrag: boolean("agrees_maandbedrag").notNull().default(false),
    agreesVoorwaarden: boolean("agrees_voorwaarden").notNull().default(false),
    agreesBevoegd: boolean("agrees_bevoegd").notNull().default(false),

    signedIpHash: text("signed_ip_hash"),
    signedUserAgent: text("signed_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("agreements_commerce_idx").on(t.commerceId, t.createdAt),
    index("agreements_lead_idx").on(t.leadId),
  ],
);

export type Agreement = typeof agreements.$inferSelect;

/* =========================================================================
 * Documenten — facturen en vastgelegde stukken
 *
 * Geen tweede boekhouding: een documentregel is de registratie van iets dat
 * elders al waar is (een betaling, een voorstelversie, een getekende
 * overeenkomst), met een eigen onveranderlijk nummer.
 * ========================================================================= */

export const DOCUMENT_TYPES = [
  "PROPOSAL",
  "AGREEMENT",
  "INVOICE_DEPOSIT",
  "INVOICE_FINAL",
  "INVOICE_SUBSCRIPTION",
  /**
   * Creditnota. Een definitieve factuur wordt nooit verwijderd of aangepast;
   * corrigeren gebeurt met een tegenboeking die zelf ook een nummer krijgt.
   */
  "CREDIT_NOTE",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Elk type dat administratief een factuur is (inclusief de creditnota). */
export const INVOICE_DOCUMENT_TYPES = [
  "INVOICE_DEPOSIT",
  "INVOICE_FINAL",
  "INVOICE_SUBSCRIPTION",
  "CREDIT_NOTE",
] as const;

/**
 * Is dit documenttype een factuur?
 *
 * Staat hier en niet in de servicelaag omdat ook de client-componenten
 * (adminpaneel, klantomgeving) moeten weten of een document een factuurlink
 * verdient. Eén definitie, zodat een creditnota nergens per ongeluk buiten de
 * boot valt doordat er ergens nog `startsWith("INVOICE")` staat.
 */
export function isInvoiceType(type: string): boolean {
  return (INVOICE_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Betaalstatus van een factuur.
 *
 * `CONCEPT` bestaat voor volledigheid van de administratie: zolang een factuur
 * concept is heeft hij nog geen definitief nummer verdiend. DogWare geeft op
 * dit moment uitsluitend definitieve facturen uit (ze ontstaan uit een echte
 * betaling of een echte termijn), dus in de praktijk begint een factuur op
 * OPEN of BETAALD.
 *
 * VERLOPEN wordt niet als kolomwaarde weggeschreven maar afgeleid uit
 * `dueAt`: een openstaande factuur die over de vervaldatum is, ís verlopen.
 * Zo kan er geen achterstallige cronjob bestaan die de administratie laat
 * liegen. Zie `effectieveStatus()` in lib/invoices.ts.
 */
export const INVOICE_STATUSES = [
  "CONCEPT",
  "OPEN",
  "BETAALD",
  "VERLOPEN",
  "GECREDITEERD",
  "GEANNULEERD",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    commerceId: uuid("commerce_id")
      .notNull()
      .references(() => commerce.id, { onDelete: "cascade" }),
    type: text("type").$type<DocumentType>().notNull(),
    /** Documentnummer, bijv. "DW-2026-0001". Uniek en onveranderlijk. */
    nummer: text("nummer").notNull(),
    titel: text("titel").notNull(),

    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    agreementId: uuid("agreement_id").references(() => agreements.id, { onDelete: "set null" }),
    paymentId: uuid("payment_id"),

    /** Bedragen in centen; bij niet-financiële documenten 0. */
    netExVatCents: integer("net_ex_vat_cents").notNull().default(0),
    vatCents: integer("vat_cents").notNull().default(0),
    totalInclVatCents: integer("total_incl_vat_cents").notNull().default(0),
    vatPercent: integer("vat_percent").notNull().default(21),

    /** Volledige, bevroren inhoud voor latere weergave/PDF. */
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
    /** Zichtbaar in de klantomgeving? Interne stukken staan hier op false. */
    visibleToCustomer: boolean("visible_to_customer").notNull().default(true),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),

    /* ------------------------------------------------- factuuradministratie -- */

    /**
     * Betaalstatus. Een echte kolom en niet iets dat elke keer uit de betaling
     * wordt afgeleid: de factuuradministratie moet te filteren en te sommeren
     * zijn zonder de hele betaalgeschiedenis mee te lezen. Niet-financiële
     * documenten (voorstel, overeenkomst) staan op CONCEPT en tellen nergens
     * in mee.
     */
    status: text("status").$type<InvoiceStatus>().notNull().default("CONCEPT"),
    /** Vervaldatum. Leeg bij een factuur die bij uitgifte al voldaan was. */
    dueAt: timestamp("due_at", { withTimezone: true }),
    /**
     * Wanneer er werkelijk betaald is. Stond eerder alleen in de snapshot;
     * daarmee was "betaald deze maand" niet te berekenen zonder elke JSON-blob
     * open te breken.
     */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Mollie-methode zoals bevestigd door de webhook ("ideal", "creditcard"). */
    paymentMethod: text("payment_method"),
    /** Mollie-referentie, ook los opgeslagen zodat de admin erop kan zoeken. */
    molliePaymentId: text("mollie_payment_id"),

    /** Wanneer en waarheen de factuur per mail is verstuurd. */
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentTo: text("sent_to"),

    /**
     * Creditnota-koppeling, beide kanten op. Op de oorspronkelijke factuur
     * staat welke creditnota hem tegenboekt; op de creditnota staat welke
     * factuur hij crediteert. Bewust zonder foreign key, net als `paymentId`
     * hierboven: een administratieve verwijzing mag nooit een cascade-delete
     * kunnen veroorzaken.
     */
    creditsDocumentId: uuid("credits_document_id"),
    creditedByDocumentId: uuid("credited_by_document_id"),
    /** Waarom er gecrediteerd is — verplicht bij het aanmaken van de nota. */
    creditReason: text("credit_reason"),
  },
  (t) => [
    uniqueIndex("documents_nummer_idx").on(t.nummer),
    index("documents_lead_idx").on(t.leadId, t.issuedAt),
    index("documents_commerce_idx").on(t.commerceId, t.type),
    /*
     * Eén betaling, één factuur — afgedwongen door de database.
     * `registerDocument` kijkt eerst zelf, maar twee gelijktijdige webhooks
     * kunnen die controle allebei passeren. Deze index is de laatste grendel.
     */
    uniqueIndex("documents_payment_idx")
      .on(t.paymentId)
      .where(sql`${t.paymentId} is not null`),
    index("documents_status_idx").on(t.status, t.issuedAt),
  ],
);

export type DogDocument = typeof documents.$inferSelect;

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
    /**
     * De betaalmethode zoals Mollie hem bevestigde ("ideal", "creditcard",
     * "directdebit"). Wordt pas bekend ná betaling — bij het aanmaken kiest de
     * klant nog niets. Stond nergens vast, waardoor de factuur "via iDEAL"
     * beweerde ook wanneer er met een creditcard was betaald.
     */
    method: text("method"),
    /** Periode voor abonnementsbetalingen, bijv. "2026-08" — voorkomt dubbele incasso */
    periode: text("periode"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Idempotentie: markeert of de 'betaald'-verwerking al is uitgevoerd */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /**
     * Waar deze betaling op gebaseerd is. Verplicht voor DEPOSIT en
     * FINAL_PAYMENT: een termijn hoort altijd bij één voorstelversie en één
     * getekende overeenkomst, ook als die later worden opgevolgd.
     */
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    agreementId: uuid("agreement_id").references(() => agreements.id, { onDelete: "set null" }),
    /** Onze eigen referentie richting Mollie/boekhouding, bijv. "DW-…-DEPOSIT". */
    referentie: text("referentie"),
    /** "oneoff" | "first" (mandaat vestigen) | "recurring" (incasso). */
    sequenceType: text("sequence_type").$type<"oneoff" | "first" | "recurring">(),
    mollieCustomerId: text("mollie_customer_id"),
    mollieMandateId: text("mollie_mandate_id"),
    failureReason: text("failure_reason"),
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
    /**
     * Wat hun site over zijn eigen uiterlijk prijsgeeft: de deelfoto en de
     * accentkleur die ze zelf opgeven. Genoeg om een pagina te maken die naar
     * hén voelt in plaats van naar ons.
     */
    stijl: jsonb("stijl")
      .$type<{ ogImage?: string; themeColor?: string; siteTitel?: string }>()
      .notNull()
      .default({}),
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

    /** Welke bron dit bedrijf aandroeg, bijv. "openstreetmap" of "handmatig" */
    bron: text("bron").notNull().default("handmatig"),
    /** Sleutel bij die bron (OSM-type + id), voor deduplicatie tussen runs */
    bronId: text("bron_id"),
    gevondenDoorAgentId: uuid("gevonden_door_agent_id"),

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

/* =========================================================================
 * Groei — agents die het voorwerk doen
 *
 * Henry voegt geen bedrijven toe; agents ontdekken ze, controleren ze en
 * zetten alleen de interessante kansen klaar. Elke run is idempotent: hem
 * opnieuw draaien levert nooit dubbele bedrijven op.
 * ========================================================================= */

/** Wat een agent doet. Meer rollen komen hier later bij. */
export const GROEI_AGENT_SOORTEN = ["ontdekken", "onderzoeken", "kwaliteit"] as const;
export type GroeiAgentSoort = (typeof GROEI_AGENT_SOORTEN)[number];

export const GROEI_RUN_STATUS = ["bezig", "klaar", "mislukt"] as const;
export type GroeiRunStatus = (typeof GROEI_RUN_STATUS)[number];

export const groeiAgents = pgTable(
  "groei_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    naam: text("naam").notNull(),
    soort: text("soort").$type<GroeiAgentSoort>().notNull().default("ontdekken"),
    /** Slug uit lib/branches.ts; leeg = alle branches die de bron ondersteunt */
    branche: text("branche"),
    /** Provincienamen zoals in OpenStreetMap; leeg = heel Nederland */
    provincies: jsonb("provincies").$type<string[]>().notNull().default([]),

    /**
     * Hoeveel bedrijven deze agent per run maximaal mag toevoegen. Bewust een
     * grens per agent: liever een handvol goede vondsten per dag dan een lijst
     * die niemand meer naloopt.
     */
    maxPerRun: integer("max_per_run").notNull().default(25),
    actief: boolean("actief").notNull().default(true),

    laatsteRunAt: timestamp("laatste_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groei_agents_owner_idx").on(t.ownerUserId, t.actief)],
);

export const groeiAgentRuns = pgTable(
  "groei_agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => groeiAgents.id, { onDelete: "cascade" }),

    status: text("status").$type<GroeiRunStatus>().notNull().default("bezig"),
    gestartAt: timestamp("gestart_at", { withTimezone: true }).notNull().defaultNow(),
    klaarAt: timestamp("klaar_at", { withTimezone: true }),

    /** Wat de bron opleverde */
    gevonden: integer("gevonden").notNull().default(0),
    /** Daarvan daadwerkelijk toegevoegd */
    nieuw: integer("nieuw").notNull().default(0),
    /** Al bekend, of afgekeurd door de kwaliteitscontrole */
    overgeslagen: integer("overgeslagen").notNull().default(0),

    /** In gewone taal, zodat het scherm geen logbestand hoeft te tonen */
    samenvatting: text("samenvatting"),
    fout: text("fout"),
  },
  (t) => [index("groei_agent_runs_agent_idx").on(t.agentId, t.gestartAt)],
);

export type GroeiAgent = typeof groeiAgents.$inferSelect;
export type GroeiAgentRun = typeof groeiAgentRuns.$inferSelect;
