"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { branding } from "@/lib/branding";
import {
  requestLoginChallenge,
  verifyLoginCode,
} from "@/lib/auth/challenge";
import { createSession, destroySession } from "@/lib/auth/session";
import { consumeToken } from "@/lib/auth/tokens";
import { referralLinkFor } from "@/lib/referral";
import { logActivity } from "@/lib/audit";
import { sendPartnerActivated } from "@/lib/email/send";

/**
 * Wachtwoordloze authenticatie — DogWare kent geen wachtwoorden.
 * Inloggen gaat uitsluitend via Magic Link of Magic Code per e-mail.
 */

export type AuthFormState = {
  status: "idle" | "sent" | "error";
  message?: string;
  /** Gemaskeerd e-mailadres voor het codescherm */
  maskedEmail?: string;
  /** Het e-mailadres waarvoor de challenge loopt (voor codeverificatie) */
  email?: string;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

/* ---------- Stap 1: inloglink + code aanvragen ---------- */

export async function requestLogin(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { status: "error", message: "Vul je e-mailadres in." };
  }

  const ua = (await headers()).get("user-agent");
  const result = await requestLoginChallenge(email, ua);

  if (!result.ok && result.reason === "RATE_LIMITED") {
    return {
      status: "error",
      message:
        "Er zijn al meerdere inlogmails aangevraagd. Wacht een kwartier en probeer het opnieuw.",
    };
  }
  if (!result.ok) {
    return { status: "error", message: "Inloggen is tijdelijk niet beschikbaar." };
  }

  // Altijd hetzelfde antwoord — geen account enumeration
  return {
    status: "sent",
    email,
    maskedEmail: maskEmail(email),
    message:
      "Als dit e-mailadres bij DogWare bekend is, ontvang je binnen enkele minuten een inlogmail.",
  };
}

/* ---------- Stap 2: inloggen met de Magic Code ---------- */

export async function loginWithCode(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");

  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    return {
      status: "sent",
      email,
      maskedEmail: maskEmail(email),
      message: result.message,
    };
  }

  redirect(result.destination);
}

/* ---------- Uitloggen ---------- */

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* ---------- Uitnodiging bevestigen (partner) — zonder wachtwoord ---------- */

export async function acceptInvite(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");

  const db = getDb();
  if (!db) return { status: "error", message: "Tijdelijk niet beschikbaar." };

  const row = await consumeToken(token, "INVITE");
  if (!row) {
    return {
      status: "error",
      message:
        "Deze uitnodiging is verlopen of al gebruikt. Vraag DogWare om een nieuwe uitnodiging.",
    };
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, row.userId))
    .limit(1);
  if (!user || user.status === "BLOCKED") {
    return { status: "error", message: "Dit account is niet beschikbaar." };
  }

  await db
    .update(schema.users)
    .set({ status: "ACTIVE", lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id));

  const [partner] = await db
    .update(schema.partners)
    .set({ status: "ACTIVE", activatedAt: new Date() })
    .where(eq(schema.partners.userId, user.id))
    .returning();

  await logActivity({
    actorUserId: user.id,
    action: "INVITE_ACCEPTED",
    objectType: "partner",
    objectId: partner?.id ?? user.id,
  });

  if (partner) {
    await sendPartnerActivated(
      user.email,
      user.naam,
      referralLinkFor(partner.referralCode),
      `${branding.siteUrl}/partner`,
    );
  }

  // Direct veilig ingelogd — voortaan altijd via Magic Link/Code
  await createSession(user.id, user.role);
  redirect(user.role === "SUPER_ADMIN" ? "/admin" : "/partner");
}
