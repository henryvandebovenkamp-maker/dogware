import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { User, UserRole } from "@/lib/db/schema";
import { generateToken, hashToken } from "./crypto";

const SESSION_COOKIE = "dw_session";

/** Sessieduur per rol: beheer korter en strenger, partners gebruiksvriendelijk. */
const SESSION_DAYS: Record<UserRole, number> = {
  SUPER_ADMIN: 7,
  AFFILIATE_PARTNER: 30,
};

/** Bestemming per rol na inloggen — altijd server-side bepaald, nooit via de client. */
export const ROLE_DESTINATIONS: Record<UserRole, string> = {
  SUPER_ADMIN: "/admin",
  AFFILIATE_PARTNER: "/partner",
};

/* ---------- Sessiebeheer ---------- */

/** Maak een nieuwe sessie aan (sessierotatie: altijd een vers token). */
export async function createSession(userId: string, role: UserRole): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database niet geconfigureerd.");
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS[role] * 86400_000);
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    if (db) {
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.tokenHash, hashToken(token)));
    }
  }
  jar.delete(SESSION_COOKIE);
}

/** Trek alle actieve sessies van een gebruiker in (bijv. bij blokkeren). */
export async function revokeAllSessions(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

/** Huidige ingelogde gebruiker, of null. */
export async function getCurrentUser(): Promise<User | null> {
  const db = getDb();
  if (!db) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const user = rows[0]?.user ?? null;
  if (!user || user.status === "BLOCKED") return null;
  return user;
}

/* ---------- Server-side guards ---------- */

export async function requireRole(role: UserRole, loginPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== role) redirect(loginPath);
  return user;
}

export const requireAdmin = () => requireRole("SUPER_ADMIN", "/admin/login");
export const requirePartner = () => requireRole("AFFILIATE_PARTNER", "/partner/login");
