import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { User } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit";
import { branding } from "@/lib/branding";
import { sendMagicLogin } from "@/lib/email/send";
import {
  generateLoginCode,
  generateToken,
  hashToken,
  tokenMatches,
} from "./crypto";
import { createSession } from "./session";

/**
 * Wachtwoordloze login-challenges.
 *
 * Eén challenge = één inlogpoging: een Magic Link-token én een 6-cijferige
 * Magic Code, beide alleen als SHA-256-hash opgeslagen, 10 minuten geldig,
 * eenmalig bruikbaar. Een nieuwe challenge maakt eerdere ongeldig.
 */

const CHALLENGE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
/** Max. aantal inlogmails per e-mailadres per kwartier (anti-abuse). */
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MINUTES = 15;

export type ChallengeResult =
  | { ok: true }
  | { ok: false; reason: "RATE_LIMITED" | "UNAVAILABLE" };

/**
 * Start een loginpoging. Geeft bewust GEEN informatie over het bestaan van
 * een account terug (anti-enumeration): alleen rate-limiting is zichtbaar.
 */
export async function requestLoginChallenge(
  rawEmail: string,
  userAgent: string | null,
): Promise<ChallengeResult> {
  const db = getDb();
  if (!db) return { ok: false, reason: "UNAVAILABLE" };

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: true }; // neutraal

  // Rate limiting per e-mailadres (ook voor onbekende adressen: telt op email)
  const windowStart = new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginChallenges)
    .where(
      and(
        eq(schema.loginChallenges.email, email),
        gt(schema.loginChallenges.createdAt, windowStart),
      ),
    );
  if (n >= MAX_REQUESTS_PER_WINDOW) {
    await logActivity({
      action: "LOGIN_RATE_LIMITED",
      objectType: "auth",
      objectId: email,
    });
    return { ok: false, reason: "RATE_LIMITED" };
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  // Onbekend of geblokkeerd adres: stilletjes niets doen — zelfde respons
  if (!user || user.status === "BLOCKED") {
    await logActivity({
      action: "LOGIN_REQUEST_UNKNOWN",
      objectType: "auth",
      objectId: email,
    });
    return { ok: true };
  }

  // Eerdere open challenges ongeldig maken
  await db
    .delete(schema.loginChallenges)
    .where(
      and(
        eq(schema.loginChallenges.userId, user.id),
        isNull(schema.loginChallenges.usedAt),
      ),
    );

  const token = generateToken();
  const code = generateLoginCode();
  await db.insert(schema.loginChallenges).values({
    userId: user.id,
    email,
    tokenHash: hashToken(token),
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000),
    requestedUserAgent: (userAgent ?? "").slice(0, 120) || null,
  });

  await sendMagicLogin(
    email,
    user.naam,
    `${branding.siteUrl}/inloggen/${token}`,
    code,
    CHALLENGE_MINUTES,
  );
  await logActivity({
    actorUserId: user.id,
    action: "LOGIN_MAIL_SENT",
    objectType: "auth",
    objectId: user.id,
  });

  return { ok: true };
}

type VerifyResult =
  | { ok: true; user: User; destination: string }
  | { ok: false; message: string };

const GENERIC_FAIL = {
  ok: false as const,
  message: "Deze code klopt niet of is verlopen. Vraag zo nodig een nieuwe aan.",
};

/** Log in met de 6-cijferige Magic Code. */
export async function verifyLoginCode(
  rawEmail: string,
  rawCode: string,
): Promise<VerifyResult> {
  const db = getDb();
  if (!db) return { ok: false, message: "Inloggen is tijdelijk niet beschikbaar." };

  const email = rawEmail.trim().toLowerCase();
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) return GENERIC_FAIL;

  const [challenge] = await db
    .select()
    .from(schema.loginChallenges)
    .where(
      and(
        eq(schema.loginChallenges.email, email),
        isNull(schema.loginChallenges.usedAt),
      ),
    )
    .orderBy(desc(schema.loginChallenges.createdAt))
    .limit(1);

  if (!challenge || challenge.expiresAt < new Date()) return GENERIC_FAIL;
  if (challenge.attemptCount >= MAX_CODE_ATTEMPTS) {
    await logActivity({
      action: "LOGIN_CHALLENGE_LOCKED",
      objectType: "auth",
      objectId: challenge.userId,
    });
    return GENERIC_FAIL;
  }

  if (!tokenMatches(code, challenge.codeHash)) {
    await db
      .update(schema.loginChallenges)
      .set({ attemptCount: challenge.attemptCount + 1 })
      .where(eq(schema.loginChallenges.id, challenge.id));
    await logActivity({
      action: "LOGIN_CODE_FAILED",
      objectType: "auth",
      objectId: challenge.userId,
    });
    return GENERIC_FAIL;
  }

  return completeLogin(challenge.id, challenge.userId);
}

/** Log in via de Magic Link-token. */
export async function verifyLoginToken(token: string): Promise<VerifyResult> {
  const db = getDb();
  if (!db) return { ok: false, message: "Inloggen is tijdelijk niet beschikbaar." };

  const [challenge] = await db
    .select()
    .from(schema.loginChallenges)
    .where(eq(schema.loginChallenges.tokenHash, hashToken(token)))
    .limit(1);

  if (!challenge || challenge.usedAt || challenge.expiresAt < new Date()) {
    return {
      ok: false,
      message: "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.",
    };
  }

  return completeLogin(challenge.id, challenge.userId);
}

/** Rond de login af: challenge verbruiken, sessie roteren, bestemming bepalen. */
async function completeLogin(
  challengeId: string,
  userId: string,
): Promise<VerifyResult> {
  const db = getDb();
  if (!db) return { ok: false, message: "Inloggen is tijdelijk niet beschikbaar." };

  // Eenmalig gebruik: markeer als gebruikt vóór het aanmaken van de sessie;
  // alleen de eerste die dit lukt, wint (atomic guard op usedAt).
  const consumed = await db
    .update(schema.loginChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.loginChallenges.id, challengeId),
        isNull(schema.loginChallenges.usedAt),
      ),
    )
    .returning({ id: schema.loginChallenges.id });
  if (consumed.length === 0) {
    return {
      ok: false,
      message: "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.",
    };
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user || user.status === "BLOCKED") {
    return { ok: false, message: "Dit account is niet beschikbaar." };
  }

  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date(), status: user.status === "INVITED" ? "ACTIVE" : user.status })
    .where(eq(schema.users.id, user.id));

  await createSession(user.id, user.role);
  await logActivity({
    actorUserId: user.id,
    action: "LOGIN_SUCCESS",
    objectType: "auth",
    objectId: user.id,
  });

  // Bestemming altijd server-side uit de rol — nooit uit een frontendparameter
  const { ROLE_DESTINATIONS } = await import("./session");
  return { ok: true, user, destination: ROLE_DESTINATIONS[user.role] };
}
