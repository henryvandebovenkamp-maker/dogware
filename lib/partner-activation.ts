import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Partner, User } from "@/lib/db/schema";
import { branding } from "@/lib/branding";
import { issueToken } from "@/lib/auth/tokens";
import { grantRole, ensurePrimaryRole } from "@/lib/auth/grant";
import { generateReferralCode, referralLinkFor } from "@/lib/referral";
import { logActivity } from "@/lib/audit";
import { sendPartnerInvite, sendPartnerAdded } from "@/lib/email/send";

/**
 * Partnerprogramma koppelen aan een persoon — nooit aan een tweede account.
 *
 * Eén e-mailadres is binnen DogWare één identiteit. Iemand kan tegelijk
 * websiteaanvrager, klant én partner zijn. Deze module is de enige plek waar
 * een partnerprofiel ontstaat, zodat beide ingangen (het partnerformulier en
 * "ook als partner activeren" vanuit een aanvraag) exact hetzelfde doen.
 *
 * Veiligheid: de aanroeper controleert de actor. Hier gebeurt de rest —
 * bestaande rollen, aanvragen en klantgegevens blijven altijd ongemoeid.
 */

/** Eén schrijfwijze voor e-mail: trimmen en naar kleine letters. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Bestaand account bij dit e-mailadres, hoofdletterongevoelig. */
export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  if (!db) return null;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalizeEmail(email)}`)
    .limit(1);
  return user ?? null;
}

export async function findPartnerByUserId(userId: string): Promise<Partner | null> {
  const db = getDb();
  if (!db) return null;
  const [partner] = await db
    .select()
    .from(schema.partners)
    .where(eq(schema.partners.userId, userId))
    .limit(1);
  return partner ?? null;
}

export type EmailInspection =
  | { kind: "vrij" }
  | { kind: "bestaand_account"; userId: string; naam: string; rollen: string[] }
  | { kind: "al_partner"; userId: string; naam: string; partnerId: string };

/**
 * Wat gebeurt er als we dit e-mailadres als partner activeren? Puur lezend —
 * gebruikt om de beheerder vooraf een eerlijke, menselijke melding te tonen.
 */
export async function inspectEmail(rawEmail: string): Promise<EmailInspection> {
  const email = normalizeEmail(rawEmail);
  const user = await findUserByEmail(email);
  if (!user) return { kind: "vrij" };

  const partner = await findPartnerByUserId(user.id);
  if (partner) {
    return { kind: "al_partner", userId: user.id, naam: user.naam, partnerId: partner.id };
  }

  const db = getDb();
  const rows = db
    ? await db
        .select({ role: schema.userRoles.role })
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, user.id))
    : [];
  const rollen = Array.from(new Set([...rows.map((r) => r.role), user.role]));
  return { kind: "bestaand_account", userId: user.id, naam: user.naam, rollen };
}

/* ---------- Partnerprofiel aanmaken ---------- */

/**
 * Reserveer een vrije referralcode en maak het partnerprofiel aan.
 *
 * De unieke indexen op user_id en referral_code zijn de scheidsrechter, niet
 * een eerdere SELECT. Bij een botsing op de code proberen we een nieuwe;
 * bij een botsing op user_id (twee gelijktijdige activaties) winnen we niets
 * en geven we het bestaande profiel terug. Zo ontstaat er nooit een tweede
 * partnerprofiel en nooit een dubbele link.
 */
async function insertPartnerProfile(
  userId: string,
  waarden: {
    commissionCents: number;
    perks: string[];
    status: "INVITED" | "ACTIVE";
    bedrijfsnaam?: string | null;
    telefoon?: string | null;
    website?: string | null;
  },
): Promise<{ partner: Partner; nieuw: boolean } | null> {
  const db = getDb();
  if (!db) return null;

  for (let poging = 0; poging < 6; poging++) {
    const bestaand = await findPartnerByUserId(userId);
    if (bestaand) return { partner: bestaand, nieuw: false };

    const nu = new Date();
    const inserted = await db
      .insert(schema.partners)
      .values({
        userId,
        referralCode: generateReferralCode(),
        commissionCents: waarden.commissionCents,
        newCustomerPerks: waarden.perks,
        status: waarden.status,
        bedrijfsnaam: waarden.bedrijfsnaam?.trim() || null,
        telefoon: waarden.telefoon?.trim() || null,
        website: waarden.website?.trim() || null,
        invitedAt: nu,
        activatedAt: waarden.status === "ACTIVE" ? nu : null,
      })
      // Zonder target: vangt zowel een codebotsing als een gelijktijdige
      // tweede activatie op. De volgende ronde leest opnieuw en bepaalt welke
      // van de twee het was.
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) return { partner: inserted[0], nieuw: true };
  }
  return null;
}

/* ---------- Hoofdhandeling ---------- */

export type ActivationResult =
  | { kind: "al_partner"; partnerId: string; userId: string; message: string }
  | {
      kind: "gekoppeld";
      partnerId: string;
      userId: string;
      /** nieuw account, of partnerrol toegevoegd aan een bestaand account */
      nieuwAccount: boolean;
      /** "uitnodiging" = activatielink, "toegevoegd" = mail bij bestaand actief account */
      mailSoort: "uitnodiging" | "toegevoegd";
      mailOk: boolean;
      mailFout?: string;
      message: string;
    }
  | { kind: "fout"; message: string };

export async function activatePartner(input: {
  email: string;
  naam: string;
  actorUserId: string;
  commissionCents?: number;
  perks?: string[];
  /** Optionele voorinvulling, bijv. uit een bestaande websiteaanvraag */
  bedrijfsnaam?: string | null;
  telefoon?: string | null;
  website?: string | null;
  /** Extra context voor de auditlog, bijv. { leadId } */
  herkomst?: Record<string, unknown>;
}): Promise<ActivationResult> {
  const db = getDb();
  if (!db) return { kind: "fout", message: "Database niet geconfigureerd." };

  const email = normalizeEmail(input.email);
  const naam = input.naam.trim();
  if (!naam || !isValidEmail(email)) {
    return { kind: "fout", message: "Vul een naam en een geldig e-mailadres in." };
  }

  const commissionCents = Number.isFinite(input.commissionCents)
    ? Math.max(0, Math.round(input.commissionCents as number))
    : 50000;
  const perks = (input.perks ?? []).slice(0, 5);

  /* 1. Bestaand account zoeken — nooit een tweede gebruiker aanmaken. */
  let user = await findUserByEmail(email);
  let nieuwAccount = false;

  if (!user) {
    const inserted = await db
      .insert(schema.users)
      .values({ email, naam, role: "AFFILIATE_PARTNER", status: "INVITED" })
      .onConflictDoNothing({ target: schema.users.email })
      .returning();
    if (inserted[0]) {
      user = inserted[0];
      nieuwAccount = true;
    } else {
      // Race: iemand anders maakte dit account net aan. Dan gebruiken we dat.
      user = await findUserByEmail(email);
    }
  }
  if (!user) {
    return { kind: "fout", message: "Het account kon niet worden aangemaakt. Probeer het opnieuw." };
  }

  /* 2. Al partner? Dan niets aanmaken en niets overschrijven. */
  const bestaandProfiel = await findPartnerByUserId(user.id);
  if (bestaandProfiel) {
    return {
      kind: "al_partner",
      partnerId: bestaandProfiel.id,
      userId: user.id,
      message: "Dit account is al als partner actief.",
    };
  }

  /* 3. Partnerrol toevoegen — bestaande rollen blijven staan. */
  const rolNieuw = await grantRole(user.id, "AFFILIATE_PARTNER", input.actorUserId);
  // Accounts van vóór de migratie hebben hun primaire rol nog niet als rij.
  await ensurePrimaryRole(user.id, user.role);

  /*
   * 4. Heeft deze persoon het account al in gebruik? Dan is het geen nieuwe
   *    registratie maar een uitbreiding: partneromgeving meteen actief, en
   *    geen mail die doet alsof er een nieuw account is gemaakt.
   */
  const accountInGebruik = !nieuwAccount && (user.status === "ACTIVE" || user.lastLoginAt !== null);

  const profiel = await insertPartnerProfile(user.id, {
    commissionCents,
    perks,
    status: accountInGebruik ? "ACTIVE" : "INVITED",
    bedrijfsnaam: input.bedrijfsnaam,
    telefoon: input.telefoon,
    website: input.website,
  });
  if (!profiel) {
    return { kind: "fout", message: "Het partnerprofiel kon niet worden aangemaakt. Probeer het opnieuw." };
  }
  if (!profiel.nieuw) {
    // Gelijktijdige activatie won de race — geen tweede profiel, geen tweede mail.
    return {
      kind: "al_partner",
      partnerId: profiel.partner.id,
      userId: user.id,
      message: "Dit account is al als partner actief.",
    };
  }
  const partner = profiel.partner;

  await logActivity({
    actorUserId: input.actorUserId,
    action: nieuwAccount ? "PARTNER_CREATED" : "PARTNER_LINKED_TO_EXISTING_USER",
    objectType: "partner",
    objectId: partner.id,
    oldValue: nieuwAccount
      ? null
      : { userId: user.id, rollen: "zonder AFFILIATE_PARTNER", partnerProfiel: null },
    newValue: {
      naam,
      email,
      userId: user.id,
      referralCode: partner.referralCode,
      commissionCents,
      rolToegevoegd: rolNieuw,
      partnerStatus: partner.status,
      ...(input.herkomst ?? {}),
    },
  });

  /* 5. De juiste mail — nooit "welkom, je account is aangemaakt" bij een
   *    account dat allang bestaat. */
  const mail = accountInGebruik
    ? await sendPartnerAdded(
        user.email,
        user.naam,
        referralLinkFor(partner.referralCode),
        `${branding.siteUrl}/partner`,
      )
    : await sendPartnerInvite(
        user.email,
        user.naam,
        `${branding.siteUrl}/partner/uitnodiging/${await issueToken(user.id, "INVITE")}`,
      );

  await logActivity({
    actorUserId: input.actorUserId,
    action: mail.ok ? "INVITE_SENT" : "INVITE_SEND_FAILED",
    objectType: "partner",
    objectId: partner.id,
    newValue: { soort: accountInGebruik ? "partner-toegevoegd" : "partner-uitnodiging" },
  });

  const mailSoort = accountInGebruik ? ("toegevoegd" as const) : ("uitnodiging" as const);
  const basis = nieuwAccount
    ? `Partner aangemaakt`
    : `Partneromgeving gekoppeld aan het bestaande account van ${user.naam}`;

  return {
    kind: "gekoppeld",
    partnerId: partner.id,
    userId: user.id,
    nieuwAccount,
    mailSoort,
    mailOk: mail.ok,
    mailFout: mail.ok ? undefined : mail.error.message,
    message: mail.ok
      ? `${basis} en ${mailSoort === "toegevoegd" ? "bericht" : "uitnodiging"} verstuurd naar ${email}.`
      : `${basis}, maar de e-mail kon niet worden verstuurd (${mail.error.message}). Verstuur hem opnieuw vanaf de detailpagina.`,
  };
}
