import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-auth";
import type { SessionUser } from "@/lib/auth/session";
import { FINANCE_ROLE } from "@/lib/finance-role";

/**
 * Server-side autorisatie voor financiële handelingen (uitbetalingen
 * goedkeuren en als uitbetaald markeren).
 *
 * Twee voorwaarden, beide verplicht: de persoon is beheerder (SUPER_ADMIN)
 * én heeft de expliciete toekenning FINANCE_APPROVER. Een beheerder zonder
 * die toekenning kan een uitbetaling wel voorbereiden, maar nooit vrijgeven.
 */
export async function hasFinanceGrant(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: schema.userRoles.id })
    .from(schema.userRoles)
    .where(
      and(
        eq(schema.userRoles.userId, userId),
        // Zelfde reden als in lib/hq-auth.ts: de rol hoort niet in de
        // UserRole-union, dus een SQL-fragment in plaats van een cast.
        sql`${schema.userRoles.role} = ${FINANCE_ROLE}`,
      ),
    )
    .limit(1);
  return rows.length === 1;
}

/** De ingelogde, financieel bevoegde beheerder — of null. */
export async function getFinanceActor(): Promise<SessionUser | null> {
  const admin = await getAdminActor();
  if (!admin || admin.status !== "ACTIVE") return null;
  return (await hasFinanceGrant(admin.id)) ? admin : null;
}
