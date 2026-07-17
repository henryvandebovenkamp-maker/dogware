import "server-only";
import { getDb, schema } from "@/lib/db";

/**
 * Auditlog voor belangrijke handelingen.
 * Log nooit wachtwoorden, tokens of API-keys in old/new values.
 */
export async function logActivity(entry: {
  actorUserId?: string | null;
  action: string;
  objectType: string;
  objectId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.activityLog).values({
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      reason: entry.reason,
    });
  } catch (err) {
    // Auditlog mag een hoofdactie nooit blokkeren
    console.error(
      JSON.stringify({
        evt: "audit.error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
  }
}
