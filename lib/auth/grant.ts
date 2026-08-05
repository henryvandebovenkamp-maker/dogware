import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";

/**
 * Rollen toekennen aan een bestaand account.
 *
 * Uitsluitend server-side te gebruiken, altijd vanuit een handeling die zelf
 * al heeft gecontroleerd wie de actor is. Er is bewust geen publiek pad dat
 * hier binnenkomt: een bezoeker kan zichzelf nooit een rol geven.
 */

/** Alle rollen van een gebruiker (primaire rol telt altijd mee). */
export async function rolesForUser(userId: string): Promise<UserRole[]> {
  const db = getDb();
  if (!db) return [];
  const [user] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const rows = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, userId));
  const alle = rows.map((r) => r.role);
  if (user) alle.push(user.role);
  return Array.from(new Set(alle));
}

/**
 * Voeg een rol toe zonder ooit een bestaande rol te overschrijven.
 *
 * Idempotent en race-condition-veilig: de unieke index op (user_id, role)
 * is de scheidsrechter, niet een eerdere SELECT. Twee gelijktijdige
 * activaties leveren dus nooit een dubbele rol op.
 *
 * @returns true als de rol nu nieuw is toegekend, false als die er al was.
 */
export async function grantRole(
  userId: string,
  role: UserRole,
  grantedByUserId?: string | null,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const inserted = await db
    .insert(schema.userRoles)
    .values({ userId, role, grantedByUserId: grantedByUserId ?? null })
    .onConflictDoNothing({
      target: [schema.userRoles.userId, schema.userRoles.role],
    })
    .returning({ id: schema.userRoles.id });

  return inserted.length > 0;
}

/**
 * Zorg dat de primaire rol van een bestaand account ook als rij in
 * `user_roles` staat. Nodig voor accounts van vóór de migratie.
 */
export async function ensurePrimaryRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  await grantRole(userId, role, null);
}
