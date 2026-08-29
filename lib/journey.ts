import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { LEAD_STATUSES } from "@/lib/db/schema";
import type {
  EventActor,
  JourneyEvent,
  JourneyStage,
  LeadStatus,
} from "@/lib/db/schema";
import { STAGE_META, stageIndex } from "@/lib/journey-stages";

/**
 * Demo Journey-motor (server-side): de centrale klantreis van elke
 * demo-aanvraag. Één bron van waarheid (leads.stage) + een chronologische
 * event-tijdlijn. Client-veilige labels staan in lib/journey-stages.ts.
 */

export { STAGE_META, stageIndex };

/**
 * Log een gebeurtenis op de tijdlijn van een aanvraag.
 *
 * `actor` en `internal` zijn echte kolommen: wie iets deed en of het de klant
 * mag bereiken zijn te belangrijk om in een losse jsonb-blob te zitten. De
 * klantquery filtert hard op `internal = false`.
 */
export async function logJourneyEvent(
  leadId: string,
  kind: string,
  label: string,
  meta?: Record<string, unknown> & { actor?: EventActor; internal?: boolean },
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const actor: EventActor =
    meta?.actor === "klant" || meta?.actor === "admin" ? meta.actor : "systeem";
  const internal = meta?.internal === true;
  try {
    await db
      .insert(schema.journeyEvents)
      .values({ leadId, kind, label, actor, internal, meta });
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
 * Welke leadstatus hoort bij welke stage.
 *
 * `leads.stage` (twintig stappen, de echte klantreis) en `leads.status` (zes
 * grove labels voor lijsten en het partnerportaal) beschrijven hetzelfde
 * traject. Ze liepen uit elkaar omdat alleen `stage` automatisch meebewoog:
 * een aanvraag kon op "Voorstel verstuurd" staan en tegelijk "Demo verstuurd"
 * tonen. Deze tabel houdt ze gelijk.
 */
const STATUS_VOOR_STAGE: Record<JourneyStage, LeadStatus> = {
  aangevraagd: "nieuw",
  voorbereiden: "demo in de maak",
  "demo-verstuurd": "demo verstuurd",
  ingelogd: "demo verstuurd",
  bekeken: "demo verstuurd",
  feedback: "contact gehad",
  afspraak: "contact gehad",
  "demo-akkoord": "contact gehad",
  offerte: "contact gehad",
  "voorstel-verstuurd": "contact gehad",
  akkoord: "klant geworden",
  overeenkomst: "klant geworden",
  aanbetaling: "klant geworden",
  gestart: "klant geworden",
  revisies: "klant geworden",
  oplevering: "klant geworden",
  restbetaling: "klant geworden",
  mandaat: "klant geworden",
  live: "klant geworden",
  actief: "klant geworden",
};

/**
 * De status die bij deze stage hoort, of `null` als er niets te wijzigen valt.
 *
 * Twee grendels. "afgevallen" is een menselijk oordeel en wordt nooit
 * automatisch overschreven — een afgeketste aanvraag mag niet vanzelf weer
 * "klant geworden" worden doordat er ergens een stage wordt gezet. En de
 * status gaat alleen vooruit, net als de stage zelf.
 */
function statusVoorStage(stage: JourneyStage, huidig: LeadStatus): LeadStatus | null {
  if (huidig === "afgevallen") return null;
  const doel = STATUS_VOOR_STAGE[stage];
  if (LEAD_STATUSES.indexOf(doel) <= LEAD_STATUSES.indexOf(huidig)) return null;
  return doel;
}

/**
 * Legt een verstuurde mail vast bij de aanvraag.
 *
 * Naast de tijdlijnregel, niet in plaats daarvan: de tijdlijn vertelt het
 * verhaal, dit logboek beantwoordt de vraag "wat heb ik die klant precies
 * gestuurd, en kwam het aan?".
 *
 * Ook een mislukte verzending wordt vastgelegd. Juist die wil je terugvinden —
 * een mail die er nooit uitging verklaart waarom het stil bleef.
 *
 * Blokkeert nooit de hoofdhandeling: een logboek dat een betaling of een
 * verstuurd voorstel kan laten mislukken is erger dan een gat in het logboek.
 */
export async function logEmail(
  leadId: string,
  gegevens: {
    soort: string;
    ontvanger: string;
    onderwerp: string;
    ok: boolean;
    providerId?: string;
    fout?: string;
  },
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.emails).values({
      leadId,
      soort: gegevens.soort,
      ontvanger: gegevens.ontvanger,
      onderwerp: gegevens.onderwerp,
      status: gegevens.ok ? "SENT" : "FAILED",
      providerId: gegevens.providerId ?? null,
      fout: gegevens.fout ?? null,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "email_log.error",
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
  opts: { force?: boolean; reden?: string; actor?: EventActor } = {},
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [lead] = await db
    .select({ stage: schema.leads.stage, status: schema.leads.status })
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  if (!lead) return;
  if (lead.stage === stage) return;
  if (!opts.force && stageIndex(stage) <= stageIndex(lead.stage)) return;

  const status = statusVoorStage(stage, lead.status);
  await db
    .update(schema.leads)
    .set(status ? { stage, status } : { stage })
    .where(eq(schema.leads.id, leadId));
  await logJourneyEvent(
    leadId,
    "stage_changed",
    `Status: ${STAGE_META[stage].label}${opts.reden ? ` — ${opts.reden}` : ""}`,
    {
      from: lead.stage,
      to: stage,
      handmatig: Boolean(opts.force),
      actor: opts.actor ?? (opts.force ? "admin" : "systeem"),
    },
  );
}

/**
 * De tijdlijn van een aanvraag.
 *
 * `scope: "klant"` levert uitsluitend niet-interne gebeurtenissen. Dat is de
 * enige manier waarop het klantportaal de tijdlijn opvraagt — zo kan een
 * interne notitie er niet per ongeluk in belanden doordat iemand elders een
 * filter vergeet.
 */
export async function getTimeline(
  leadId: string,
  scope: "admin" | "klant" = "admin",
  limit = 200,
): Promise<JourneyEvent[]> {
  const db = getDb();
  if (!db) return [];
  const where =
    scope === "klant"
      ? and(
          eq(schema.journeyEvents.leadId, leadId),
          eq(schema.journeyEvents.internal, false),
        )
      : eq(schema.journeyEvents.leadId, leadId);
  return db
    .select()
    .from(schema.journeyEvents)
    .where(where)
    .orderBy(asc(schema.journeyEvents.createdAt))
    .limit(limit);
}

/** Standaard interne taken die bij een nieuwe aanvraag worden aangemaakt. */
export const DEFAULT_TASKS = [
  "Voorbeeldwebsite voorbereiden",
  "Logo en kleuren instellen",
  "Foto's kiezen",
  "Demo versturen",
  "Opvolgen na eerste login",
];
