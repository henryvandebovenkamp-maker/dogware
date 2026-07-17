import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { JourneyStage } from "@/lib/db/schema";
import { STAGE_META, stageIndex } from "@/lib/journey-stages";

/**
 * Demo Journey-motor (server-side): de centrale klantreis van elke
 * demo-aanvraag. Één bron van waarheid (leads.stage) + een chronologische
 * event-tijdlijn. Client-veilige labels staan in lib/journey-stages.ts.
 */

export { STAGE_META, stageIndex };

/** Log een gebeurtenis op de tijdlijn van een aanvraag. */
export async function logJourneyEvent(
  leadId: string,
  kind: string,
  label: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.journeyEvents).values({ leadId, kind, label, meta });
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "journey.event_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
  }
}

/**
 * Zet de stage van een aanvraag. Gaat standaard alleen vooruit (automatische
 * overgangen mogen niet terugvallen), tenzij `force` is gezet (handmatige
 * correctie door de beheerder).
 */
export async function setStage(
  leadId: string,
  stage: JourneyStage,
  opts: { force?: boolean; reden?: string } = {},
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [lead] = await db
    .select({ stage: schema.leads.stage })
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  if (!lead) return;
  if (lead.stage === stage) return;
  if (!opts.force && stageIndex(stage) <= stageIndex(lead.stage)) return;

  await db
    .update(schema.leads)
    .set({ stage })
    .where(eq(schema.leads.id, leadId));
  await logJourneyEvent(
    leadId,
    "stage_changed",
    `Status: ${STAGE_META[stage].label}${opts.reden ? ` — ${opts.reden}` : ""}`,
    { from: lead.stage, to: stage, handmatig: Boolean(opts.force) },
  );
}

/** Standaard interne taken die bij een nieuwe aanvraag worden aangemaakt. */
export const DEFAULT_TASKS = [
  "Voorbeeldwebsite voorbereiden",
  "Logo en kleuren instellen",
  "Foto's kiezen",
  "Demo versturen",
  "Opvolgen na eerste login",
];
