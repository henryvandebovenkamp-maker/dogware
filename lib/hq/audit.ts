import "server-only";
import { logActivityStrict } from "@/lib/audit";
import { hashToken } from "@/lib/auth/crypto";
import {
  withHqAudit,
  type HqAuditContext,
  type HqAuditEntry,
  type HqAuditWriter,
} from "./audit-core";

/**
 * De koppeling tussen de HQ-auditregels en het bestaande auditlogboek.
 *
 * HQ schrijft in dezelfde `activity_log` als de rest van DogWare, via dezelfde
 * lib/audit.ts. Alleen de foutafhandeling verschilt: hier gebruiken we de
 * strikte variant, zodat een mislukte registratie de handeling afbreekt.
 *
 * ---------------------------------------------------------------------------
 * Over een tamper-evident hash chain (voor de volgende beveiligingsstap)
 * ---------------------------------------------------------------------------
 * Elke HQ-regel krijgt hieronder een `integrity`-hash over zijn eigen inhoud.
 * Dat maakt wijziging van één regel aantoonbaar, maar niet het verwijderen of
 * herordenen van regels — daarvoor is een echte keten nodig, en die vraagt om
 * een schemawijziging die niet in stap 1 thuishoort. Concreet is daarvoor
 * nodig:
 *
 *   1. Twee kolommen op `activity_log`: `prev_hash text` en `entry_hash text`.
 *   2. Een monotone volgorde die niet op `created_at` leunt (gelijke
 *      timestamps zijn mogelijk): een `bigserial`-kolom `seq`.
 *   3. Schrijven binnen één transactie met een expliciete lock op de laatste
 *      rij (SELECT ... FOR UPDATE), anders levert gelijktijdig schrijven twee
 *      regels met dezelfde `prev_hash` op en breekt de keten.
 *      Let op: dit botst met de huidige neon-http-driver, die geen sessie
 *      vasthoudt en dus geen interactieve transacties kan. Er is dan een
 *      tweede verbinding via `@neondatabase/serverless` (WebSocket/Pool)
 *      nodig, alleen voor het auditpad.
 *   4. Een periodieke verificatiedraai die de keten van begin tot eind
 *      narekent, plus een ankerpunt buiten de database (bijv. de laatste hash
 *      dagelijks in een aparte, alleen-toevoegen opslag).
 *
 * Zolang punt 3 niet is opgelost, zou een keten een vals gevoel van veiligheid
 * geven. Daarom nu bewust alleen een per-regel-hash.
 */

/**
 * Schrijf één HQ-auditregel, voorzien van een integriteitshash.
 *
 * De hash gaat over de gesorteerde JSON van de regel, zodat sleutelvolgorde
 * geen invloed heeft. Hergebruikt de bestaande SHA-256-helper uit
 * lib/auth/crypto.ts — geen eigen crypto voor HQ.
 */
export const hqAuditWriter: HqAuditWriter = async (entry: HqAuditEntry) => {
  const canoniek = JSON.stringify(entry, Object.keys(entry).sort());
  await logActivityStrict({
    ...entry,
    newValue: { ...entry.newValue, integrity: hashToken(canoniek) },
  });
};

/**
 * Voer een HQ-handeling uit met verplichte registratie vóór en ná afloop.
 *
 * Mislukt een van beide registraties, dan faalt de handeling — het resultaat
 * wordt in dat geval nooit teruggegeven.
 */
export function runAuditedHqAction<T>(
  ctx: HqAuditContext,
  fn: () => Promise<T>,
): Promise<T> {
  return withHqAudit(ctx, hqAuditWriter, fn);
}
