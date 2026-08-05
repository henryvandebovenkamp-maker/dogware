import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { User, UserRole } from "@/lib/db/schema";
import { generateToken, hashToken } from "./crypto";
import { ROLE_HOME, primaryRole } from "@/lib/roles";

const SESSION_COOKIE = "dw_session";

/**
 * De ingelogde persoon met álle rollen van het account. Eén e-mailadres is
 * één identiteit; `role` blijft de primaire rol, `roles` is de waarheid voor
 * autorisatie.
 */
export type SessionUser = User & { roles: UserRole[] };

/** Sessieduur per rol: beheer korter en strenger, partners gebruiksvriendelijk. */
const SESSION_DAYS: Record<UserRole, number> = {
  SUPER_ADMIN: 7,
  AFFILIATE_PARTNER: 30,
  CUSTOMER: 14,
};

/** Bestemming per rol na inloggen — altijd server-side bepaald, nooit via de client. */
export const ROLE_DESTINATIONS: Record<UserRole, string> = {
  SUPER_ADMIN: ROLE_HOME.SUPER_ADMIN.href,
  AFFILIATE_PARTNER: ROLE_HOME.AFFILIATE_PARTNER.href,
  CUSTOMER: ROLE_HOME.CUSTOMER.href,
};

/* ---------- Sessiebeheer ---------- */

/**
 * Maak een nieuwe sessie aan (sessierotatie: altijd een vers token).
 * Bij meerdere rollen geldt de kortste sessieduur — beheerrechten mogen nooit
 * langer meelopen omdat iemand toevallig ook partner is.
 */
export async function createSession(
  userId: string,
  roles: UserRole | readonly UserRole[],
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database niet geconfigureerd.");
  const list = (Array.isArray(roles) ? roles : [roles]) as UserRole[];
  const dagen = Math.min(...list.map((r) => SESSION_DAYS[r] ?? 7));
  const token = generateToken();
  const expiresAt = new Date(Date.now() + dagen * 86400_000);
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

/**
 * Huidige ingelogde gebruiker inclusief al zijn rollen, of null.
 * De rollen komen in dezelfde query mee (één round trip naar Neon).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const db = getDb();
  if (!db) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      user: schema.users,
      roles: sql<UserRole[]>`coalesce(
        (select json_agg(ur.role) from user_roles ur where ur.user_id = ${schema.users.id}),
        '[]'::json
      )`,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row?.user || row.user.status === "BLOCKED") return null;

  // De primaire rol telt altijd mee, ook als de backfill nog niet gedraaid is.
  const roles = Array.from(new Set([...(row.roles ?? []), row.user.role]));
  return { ...row.user, roles };
}

/* ---------- Server-side guards ---------- */

/**
 * Toegang op basis van rolbezit, niet op basis van de primaire rol: een klant
 * die ook partner is, komt de partneromgeving gewoon binnen.
 */
export async function requireRole(
  role: UserRole,
  loginPath: string,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes(role)) redirect(loginPath);
  return user;
}

/** Standaardbestemming van deze persoon na inloggen. */
export function homeFor(roles: readonly UserRole[]): string {
  return ROLE_HOME[primaryRole(roles)].href;
}

export const requireAdmin = () => requireRole("SUPER_ADMIN", "/admin/login");
export const requirePartner = () => requireRole("AFFILIATE_PARTNER", "/partner/login");
