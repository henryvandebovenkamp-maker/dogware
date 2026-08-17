/**
 * De auditregels van HQ — opnieuw bewust zonder imports, zodat ze te testen
 * zijn zonder database.
 *
 * Dit is geen tweede auditsysteem. Het bouwt alleen de vaste envelop op die
 * elke HQ-handeling in `activity_log` achterlaat, en bewaakt één harde regel:
 *
 *   Een HQ-handeling die niet geregistreerd kan worden, gaat niet door.
 *
 * Elders in DogWare mag een mislukte auditwrite de hoofdactie niet blokkeren
 * (zie lib/audit.ts). Voor HQ draaien we dat bewust om: hier is het logboek
 * belangrijker dan het resultaat.
 */

/** Vaste objectType-waarde van alle HQ-regels in activity_log. */
export const HQ_OBJECT_TYPE = "hq";

export type HqAuditPhase = "start" | "ok" | "error";

/** Waarden die veilig in metadata mogen: nooit objecten, nooit vrije tekst uit gebruikers. */
export type HqMetaValue = string | number | boolean | null;

export type HqAuditContext = {
  /** Wie voert de handeling uit. null zou hier niet mogen voorkomen, maar blijft loggbaar. */
  actorUserId: string | null;
  /** Wat gebeurt er, bijv. "HQ_STATUS_READ". */
  action: string;
  /** Eén id dat de "voor"- en "na"-regel van dezelfde handeling aan elkaar knoopt. */
  requestId: string;
  /**
   * Het AI-model dat de handeling uitvoerde. In stap 1 bestaat er geen enkele
   * modelaanroep, dus dit is altijd expliciet null — geen weggelaten veld,
   * maar een vastgelegde "geen model".
   */
  model: string | null;
  /** Veilige, niet-herleidbare context. Wordt gefilterd door sanitizeHqMeta. */
  meta?: Record<string, HqMetaValue>;
};

export type HqAuditEntry = {
  actorUserId: string | null;
  action: string;
  objectType: typeof HQ_OBJECT_TYPE;
  objectId: string;
  newValue: {
    phase: HqAuditPhase;
    status: "gestart" | "gelukt" | "mislukt";
    model: string | null;
    requestId: string;
    at: string;
    meta: Record<string, HqMetaValue>;
  };
  reason: string;
};

export type HqAuditWriter = (entry: HqAuditEntry) => Promise<void>;

/** Sleutels die nooit in een auditregel terechtmogen, hoe ze ook heten. */
const VERBODEN_SLEUTEL =
  /token|secret|key|cookie|wachtwoord|password|sessie|session|code|auth|bearer|iban|email|e-mail|naam|telefoon/i;

/**
 * Filter metadata tot alleen veilige, korte primitieven.
 *
 * Alles wat naar een geheim of persoonsgegeven ruikt gaat eruit — op naam van
 * de sleutel, niet op inhoud. Liever een veld te veel weggegooid dan één
 * sessietoken in het logboek.
 */
export function sanitizeHqMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, HqMetaValue> {
  const veilig: Record<string, HqMetaValue> = {};
  if (!meta) return veilig;
  for (const [sleutel, waarde] of Object.entries(meta)) {
    if (VERBODEN_SLEUTEL.test(sleutel)) continue;
    if (waarde === null) veilig[sleutel] = null;
    else if (typeof waarde === "boolean") veilig[sleutel] = waarde;
    else if (typeof waarde === "number" && Number.isFinite(waarde)) {
      veilig[sleutel] = waarde;
    } else if (typeof waarde === "string") {
      // Kort houden: een auditregel is geen opslagplaats voor vrije tekst.
      veilig[sleutel] = waarde.slice(0, 120);
    }
    // Objecten, arrays en functies worden bewust stilzwijgend overgeslagen.
  }
  return veilig;
}

const STATUS: Record<HqAuditPhase, HqAuditEntry["newValue"]["status"]> = {
  start: "gestart",
  ok: "gelukt",
  error: "mislukt",
};

/** Bouw één auditregel. `now` is een parameter zodat tests niet op de klok leunen. */
export function buildHqAuditEntry(
  ctx: HqAuditContext,
  phase: HqAuditPhase,
  now: Date,
  extraMeta?: Record<string, unknown>,
): HqAuditEntry {
  return {
    actorUserId: ctx.actorUserId,
    action: ctx.action,
    objectType: HQ_OBJECT_TYPE,
    objectId: ctx.requestId,
    newValue: {
      phase,
      status: STATUS[phase],
      model: ctx.model,
      requestId: ctx.requestId,
      at: now.toISOString(),
      meta: sanitizeHqMeta({ ...ctx.meta, ...extraMeta }),
    },
    reason: `HQ ${ctx.action} — ${STATUS[phase]}`,
  };
}

/** Een verplichte auditwrite is mislukt; de HQ-handeling is daarom afgebroken. */
export class HqAuditFailure extends Error {
  readonly phase: HqAuditPhase;

  constructor(phase: HqAuditPhase) {
    super(`HQ-auditregistratie (${phase}) mislukt — handeling afgebroken.`);
    this.name = "HqAuditFailure";
    this.phase = phase;
  }
}

/**
 * Voer een HQ-handeling uit met een verplichte auditregel ervóór en erna.
 *
 * - Lukt de "voor"-regel niet, dan draait `fn` nooit.
 * - Lukt de "na"-regel niet, dan wordt het resultaat weggegooid en faalt de
 *   handeling alsnog: een handeling die niet in het logboek staat, heeft voor
 *   HQ niet plaatsgevonden.
 * - Faalt `fn` zelf, dan wordt dat eerst geregistreerd en daarna doorgegeven.
 *   De foutmelding gaat bewust NIET het logboek in (die kan van alles
 *   bevatten); alleen het feit dat er een fout was.
 */
export async function withHqAudit<T>(
  ctx: HqAuditContext,
  writer: HqAuditWriter,
  fn: () => Promise<T>,
  now: () => Date = () => new Date(),
): Promise<T> {
  try {
    await writer(buildHqAuditEntry(ctx, "start", now()));
  } catch {
    throw new HqAuditFailure("start");
  }

  let resultaat: T;
  try {
    resultaat = await fn();
  } catch (err) {
    try {
      await writer(
        buildHqAuditEntry(ctx, "error", now(), {
          gefaald: true,
          fouttype: err instanceof Error ? err.name : "onbekend",
        }),
      );
    } catch {
      throw new HqAuditFailure("error");
    }
    throw err;
  }

  try {
    await writer(buildHqAuditEntry(ctx, "ok", now()));
  } catch {
    throw new HqAuditFailure("ok");
  }
  return resultaat;
}
