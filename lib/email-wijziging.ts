import "server-only";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { EmailChange } from "@/lib/db/schema";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { revokeAllSessions } from "@/lib/auth/session";
import { branding } from "@/lib/branding";
import { logActivity } from "@/lib/audit";
import { isUniekeSchending } from "@/lib/db-errors";
import { sendEmailWijziging } from "@/lib/email/send";
import { isValidEmail, normalizeEmail } from "@/lib/partner-activation";

/**
 * Het e-mailadres van een bestaand account wijzigen — zonder nieuw account.
 *
 * Bij DogWare is het e-mailadres de inlog (passwordless). Daarom gaat een
 * wijziging in twee stappen:
 *
 *   1. aanvraag  → bevestigingslink naar het NIEUWE adres, melding naar het
 *                  huidige adres. Er verandert nog niets.
 *   2. bevestigen → users.email wordt bijgewerkt, open inlogcodes en sessies
 *                  vervallen, en het nieuwe adres krijgt een bevestiging.
 *
 * Alles wat aan het account hangt — user-ID, rollen, partner-ID,
 * referralcode, aanbrengingen, commissies, uitbetalingen — verwijst naar het
 * user-ID en niet naar het adres, en blijft dus volledig intact. Alle latere
 * partnercommunicatie leest users.email en gaat vanzelf naar het nieuwe adres.
 */

export const EMAIL_WIJZIGING_GELDIG_DAGEN = 7;

export type WijzigingUitkomst = { ok: true; melding: string } | { ok: false; melding: string };

/** Een nog openstaande aanvraag voor dit account, of null. */
export async function openEmailWijziging(userId: string): Promise<EmailChange | null> {
  const db = getDb();
  if (!db) return null;
  const [rij] = await db
    .select()
    .from(schema.emailChanges)
    .where(
      and(
        eq(schema.emailChanges.userId, userId),
        isNull(schema.emailChanges.confirmedAt),
        isNull(schema.emailChanges.cancelledAt),
        gt(schema.emailChanges.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.emailChanges.createdAt))
    .limit(1);
  return rij ?? null;
}

/** Trek openstaande aanvragen in (bij een nieuwe aanvraag of op verzoek). */
async function trekOpenAanvragenIn(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const rijen = await db
    .update(schema.emailChanges)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(schema.emailChanges.userId, userId),
        isNull(schema.emailChanges.confirmedAt),
        isNull(schema.emailChanges.cancelledAt),
      ),
    )
    .returning({ id: schema.emailChanges.id });
  return rijen.length;
}

/**
 * Stap 1 — vraag een wijziging aan. De aanroeper (server action) heeft de
 * actor al gecontroleerd.
 */
export async function vraagEmailWijzigingAan(input: {
  userId: string;
  nieuwEmail: string;
  actorUserId: string;
  reden?: string;
}): Promise<WijzigingUitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };

  const nieuw = normalizeEmail(input.nieuwEmail);
  if (!isValidEmail(nieuw)) return { ok: false, melding: "Vul een geldig e-mailadres in." };

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, input.userId))
    .limit(1);
  if (!user) return { ok: false, melding: "Account niet gevonden." };
  if (normalizeEmail(user.email) === nieuw) {
    return { ok: false, melding: "Dit is al het huidige e-mailadres." };
  }

  // Eén e-mailadres is één identiteit: nooit een adres dat al bij een ander account hoort.
  const [bezet] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(sql`lower(${schema.users.email}) = ${nieuw}`, ne(schema.users.id, user.id)))
    .limit(1);
  if (bezet) {
    return {
      ok: false,
      melding: "Dit e-mailadres hoort al bij een ander DogWare-account. Er wordt geen tweede account gemaakt; neem dit eerst door.",
    };
  }

  await trekOpenAanvragenIn(user.id);

  const token = generateToken();
  const [aanvraag] = await db
    .insert(schema.emailChanges)
    .values({
      userId: user.id,
      oldEmail: user.email,
      newEmail: nieuw,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_WIJZIGING_GELDIG_DAGEN * 86_400_000),
      requestedByUserId: input.actorUserId,
      reason: input.reden?.trim() || null,
    })
    .returning();

  const voornaam = user.naam.trim().split(/\s+/)[0] || "daar";
  const bevestigUrl = `${branding.siteUrl}/email-bevestigen/${token}`;
  const mail = await sendEmailWijziging(nieuw, voornaam, "bevestigen", nieuw, bevestigUrl, EMAIL_WIJZIGING_GELDIG_DAGEN);
  if (!mail.ok) {
    // Zonder bevestigingsmail heeft de aanvraag geen zin; niet laten hangen.
    await db
      .update(schema.emailChanges)
      .set({ cancelledAt: new Date() })
      .where(eq(schema.emailChanges.id, aanvraag.id));
    await logActivity({
      actorUserId: input.actorUserId,
      action: "EMAIL_CHANGE_MAIL_FAILED",
      objectType: "user",
      objectId: user.id,
      newValue: { nieuwEmail: nieuw },
      reason: mail.error.message,
    });
    return { ok: false, melding: `De bevestigingsmail kon niet worden verstuurd: ${mail.error.message}` };
  }

  // Ter info naar het huidige adres. Mislukt dat, dan gaat de aanvraag gewoon door.
  const melding = await sendEmailWijziging(user.email, voornaam, "aangevraagd", nieuw);

  await logActivity({
    actorUserId: input.actorUserId,
    action: "EMAIL_CHANGE_REQUESTED",
    objectType: "user",
    objectId: user.id,
    oldValue: { email: user.email },
    newValue: { email: nieuw, meldingOudAdres: melding.ok ? "verstuurd" : "mislukt" },
    reason: input.reden?.trim() || undefined,
  });

  return {
    ok: true,
    melding: `Bevestigingslink verstuurd naar ${nieuw}. Het adres wijzigt pas na bevestiging; tot die tijd blijft ${user.email} actief.`,
  };
}

/** Trek een openstaande aanvraag in. */
export async function annuleerEmailWijziging(userId: string, actorUserId: string): Promise<WijzigingUitkomst> {
  const aantal = await trekOpenAanvragenIn(userId);
  if (aantal === 0) return { ok: false, melding: "Er staat geen wijziging open." };
  await logActivity({
    actorUserId,
    action: "EMAIL_CHANGE_CANCELLED",
    objectType: "user",
    objectId: userId,
  });
  return { ok: true, melding: "De openstaande wijziging is ingetrokken." };
}

/** Bekijk een bevestigingslink zonder hem te verbruiken. */
export async function bekijkEmailWijziging(token: string): Promise<EmailChange | null> {
  const db = getDb();
  if (!db || !token) return null;
  const [rij] = await db
    .select()
    .from(schema.emailChanges)
    .where(eq(schema.emailChanges.tokenHash, hashToken(token)))
    .limit(1);
  if (!rij || rij.confirmedAt || rij.cancelledAt || rij.expiresAt < new Date()) return null;
  return rij;
}

/**
 * Stap 2 — de wijziging doorvoeren. Werkt alleen met een geldige,
 * ongebruikte link, en alleen als het account nog steeds het oude adres heeft
 * (anders is er intussen iets anders gebeurd en stoppen we).
 */
export async function bevestigEmailWijziging(token: string): Promise<WijzigingUitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };
  const ongeldig = { ok: false as const, melding: "Deze link is verlopen, al gebruikt of ingetrokken." };
  if (!token) return ongeldig;

  // Claim de aanvraag atomair: één klik voert de wijziging door, een tweede niet.
  const [aanvraag] = await db
    .update(schema.emailChanges)
    .set({ confirmedAt: new Date() })
    .where(
      and(
        eq(schema.emailChanges.tokenHash, hashToken(token)),
        isNull(schema.emailChanges.confirmedAt),
        isNull(schema.emailChanges.cancelledAt),
        gt(schema.emailChanges.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!aanvraag) return ongeldig;

  const terugdraaien = () =>
    db
      .update(schema.emailChanges)
      .set({ confirmedAt: null })
      .where(eq(schema.emailChanges.id, aanvraag.id));

  let gewijzigd: { id: string; naam: string }[];
  try {
    gewijzigd = await db
      .update(schema.users)
      .set({ email: aanvraag.newEmail })
      .where(and(eq(schema.users.id, aanvraag.userId), eq(schema.users.email, aanvraag.oldEmail)))
      .returning({ id: schema.users.id, naam: schema.users.naam });
  } catch (err) {
    await terugdraaien();
    if (isUniekeSchending(err)) {
      return { ok: false, melding: "Dit e-mailadres is intussen aan een ander account gekoppeld. Neem contact op met DogWare." };
    }
    throw err;
  }
  if (gewijzigd.length === 0) {
    // Het account heeft intussen een ander adres; deze aanvraag is achterhaald.
    await db
      .update(schema.emailChanges)
      .set({ confirmedAt: null, cancelledAt: new Date() })
      .where(eq(schema.emailChanges.id, aanvraag.id));
    return { ok: false, melding: "Het account is intussen gewijzigd. Vraag een nieuwe link aan." };
  }

  // Wat aan het oude adres hing, vervalt: open inlogcodes en lopende sessies.
  await db
    .update(schema.loginChallenges)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.loginChallenges.userId, aanvraag.userId), isNull(schema.loginChallenges.usedAt)));
  await revokeAllSessions(aanvraag.userId);

  await logActivity({
    actorUserId: null,
    action: "EMAIL_CHANGED",
    objectType: "user",
    objectId: aanvraag.userId,
    oldValue: { email: aanvraag.oldEmail },
    newValue: { email: aanvraag.newEmail },
    reason: "Bevestigd via de link in de mail naar het nieuwe adres",
  });

  const voornaam = gewijzigd[0].naam.trim().split(/\s+/)[0] || "daar";
  await sendEmailWijziging(aanvraag.newEmail, voornaam, "gewijzigd", aanvraag.newEmail);

  return {
    ok: true,
    melding: `Gelukt! Je e-mailadres is gewijzigd naar ${aanvraag.newEmail}. Log voortaan met dit adres in.`,
  };
}
