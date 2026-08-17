import "server-only";
import { getDb, schema } from "@/lib/db";

export type ActivityEntry = {
  actorUserId?: string | null;
  action: string;
  objectType: string;
  objectId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
};

/**
 * Schrijf één auditregel en geef fouten door aan de aanroeper.
 *
 * De gewone logActivity() slikt fouten bewust in, zodat het logboek nooit een
 * hoofdactie tegenhoudt. Voor handelingen waar het logboek juist zwaarder
 * weegt dan het resultaat — HQ — is die keuze verkeerd. Vandaar deze strikte
 * variant: hij gooit door, zodat de aanroeper veilig kan stoppen.
 *
 * Een ontbrekende database is hier óók een fout: niet kunnen registreren is
 * niet hetzelfde als niets te registreren hebben.
 */
export async function logActivityStrict(entry: ActivityEntry): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Auditlog niet beschikbaar — database ontbreekt.");
  await db.insert(schema.activityLog).values({
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    objectType: entry.objectType,
    objectId: entry.objectId,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    reason: entry.reason,
  });
}

/**
 * Auditlog voor belangrijke handelingen.
 * Log nooit wachtwoorden, tokens of API-keys in old/new values.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await logActivityStrict(entry);
  } catch (err) {
    if (!getDb()) return; // geen database geconfigureerd — bewust stil

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
