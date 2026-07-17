import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { DraftStatus } from "@/lib/db/schema";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Centrale conceptopslag (autosave) voor alle DogWare-formulieren.
 *
 * Eén generiek model (form_drafts). Openbare bezoekers worden herkend via een
 * cryptografisch drafttoken waarvan alleen de hash wordt opgeslagen; ingelogde
 * gebruikers via hun userId. Optimistic concurrency voorkomt dat een oudere
 * save een nieuwere overschrijft.
 */

/** Bewaartermijn per formuliertype (dagen). */
const RETENTION_DAYS: Record<string, number> = {
  "demo-intake": 30,
  onboarding: 60,
  "partner-new": 14,
  profiel: 90,
  default: 30,
};

function retentionFor(formType: string): number {
  return RETENTION_DAYS[formType] ?? RETENTION_DAYS.default;
}

/** Maximale payloadgrootte (bytes) — bescherming tegen spam/misbruik. */
const MAX_PAYLOAD_BYTES = 64 * 1024;

export type DraftRef = {
  draftId: string;
  /** Alleen aanwezig bij een nieuw openbaar concept — client bewaart dit */
  draftToken?: string;
};

export type DraftSnapshot = {
  draftId: string;
  version: number;
  currentStep: string | null;
  payload: Record<string, unknown>;
  status: DraftStatus;
  lastSavedAt: string;
};

export type SaveOutcome =
  | { ok: true; version: number; lastSavedAt: string }
  | { ok: false; reason: "CONFLICT" | "NOT_FOUND" | "FORBIDDEN" | "TOO_LARGE" | "UNAVAILABLE"; latest?: DraftSnapshot };

function payloadTooLarge(payload: unknown): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(payload)) > MAX_PAYLOAD_BYTES;
  } catch {
    return true;
  }
}

/**
 * Autoriseer toegang tot een concept: ingelogde eigenaar óf geldig
 * anoniem token. Voorkomt IDOR — een draft-ID alleen is nooit genoeg.
 */
async function authorizeDraft(
  draftId: string,
  draftToken: string | undefined,
) {
  const db = getDb();
  if (!db) return null;
  const [draft] = await db
    .select()
    .from(schema.formDrafts)
    .where(eq(schema.formDrafts.id, draftId))
    .limit(1);
  if (!draft) return null;

  if (draft.userId) {
    const user = await getCurrentUser();
    if (!user || user.id !== draft.userId) return null;
    return draft;
  }
  // Openbaar concept: token-hash moet exact kloppen
  if (!draftToken || !draft.anonymousTokenHash) return null;
  if (hashToken(draftToken) !== draft.anonymousTokenHash) return null;
  return draft;
}

/** Start een nieuw concept (of hergebruik voor ingelogde gebruiker + formType). */
export async function startDraft(
  formType: string,
  initialPayload: Record<string, unknown> = {},
): Promise<DraftRef | null> {
  const db = getDb();
  if (!db) return null;
  if (payloadTooLarge(initialPayload)) return null;

  const expiresAt = new Date(Date.now() + retentionFor(formType) * 86400_000);
  const user = await getCurrentUser();

  if (user) {
    // Ingelogd: één actief concept per (gebruiker, formType) — hergebruiken
    const [existing] = await db
      .select({ id: schema.formDrafts.id })
      .from(schema.formDrafts)
      .where(
        and(
          eq(schema.formDrafts.userId, user.id),
          eq(schema.formDrafts.formType, formType),
          eq(schema.formDrafts.status, "IN_PROGRESS"),
        ),
      )
      .limit(1);
    if (existing) return { draftId: existing.id };

    const [created] = await db
      .insert(schema.formDrafts)
      .values({ formType, userId: user.id, payload: initialPayload, expiresAt })
      .returning({ id: schema.formDrafts.id });
    return { draftId: created.id };
  }

  // Openbaar: nieuw token, alleen hash opslaan
  const draftToken = generateToken();
  const [created] = await db
    .insert(schema.formDrafts)
    .values({
      formType,
      anonymousTokenHash: hashToken(draftToken),
      payload: initialPayload,
      expiresAt,
    })
    .returning({ id: schema.formDrafts.id });
  return { draftId: created.id, draftToken };
}

/** Laad een concept (voor herstel bij terugkomst). */
export async function loadDraft(
  draftId: string,
  draftToken?: string,
): Promise<DraftSnapshot | null> {
  const draft = await authorizeDraft(draftId, draftToken);
  if (!draft || draft.status !== "IN_PROGRESS") return null;
  if (draft.expiresAt < new Date()) return null;
  return {
    draftId: draft.id,
    version: draft.version,
    currentStep: draft.currentStep,
    payload: draft.payload,
    status: draft.status,
    lastSavedAt: draft.lastSavedAt.toISOString(),
  };
}

/**
 * Sla een concept op met optimistic concurrency.
 * `baseVersion` is de versie die de client dacht te bewerken; komt die niet
 * overeen, dan is er intussen een nieuwere save geweest (out-of-order of ander
 * apparaat) → CONFLICT met de nieuwste versie erbij, nooit stil overschrijven.
 */
export async function saveDraft(params: {
  draftId: string;
  draftToken?: string;
  baseVersion: number;
  payload: Record<string, unknown>;
  currentStep?: string | null;
}): Promise<SaveOutcome> {
  const db = getDb();
  if (!db) return { ok: false, reason: "UNAVAILABLE" };
  if (payloadTooLarge(params.payload)) return { ok: false, reason: "TOO_LARGE" };

  const draft = await authorizeDraft(params.draftId, params.draftToken);
  if (!draft) return { ok: false, reason: "FORBIDDEN" };
  if (draft.status !== "IN_PROGRESS") return { ok: false, reason: "NOT_FOUND" };

  const now = new Date();
  // Atomair: alleen bijwerken als de versie nog klopt (concurrency guard)
  const updated = await db
    .update(schema.formDrafts)
    .set({
      payload: params.payload,
      currentStep: params.currentStep ?? draft.currentStep,
      version: params.baseVersion + 1,
      lastSavedAt: now,
    })
    .where(
      and(
        eq(schema.formDrafts.id, params.draftId),
        eq(schema.formDrafts.version, params.baseVersion),
      ),
    )
    .returning({ version: schema.formDrafts.version });

  if (updated.length === 0) {
    // Versieconflict: geef de nieuwste terug zodat de client kan herstellen
    const latest = await loadDraft(params.draftId, params.draftToken);
    return { ok: false, reason: "CONFLICT", latest: latest ?? undefined };
  }

  return { ok: true, version: updated[0].version, lastSavedAt: now.toISOString() };
}

/** Markeer een concept als definitief ingediend (voorkomt hergebruik). */
export async function markDraftSubmitted(
  draftId: string,
  draftToken?: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const draft = await authorizeDraft(draftId, draftToken);
  if (!draft) return;
  await db
    .update(schema.formDrafts)
    .set({ status: "SUBMITTED" })
    .where(eq(schema.formDrafts.id, draftId));
}

/** Verwijder verlopen concepten. Ingediende records blijven bewaard. */
export async function cleanupExpiredDrafts(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const deleted = await db
    .delete(schema.formDrafts)
    .where(
      and(
        eq(schema.formDrafts.status, "IN_PROGRESS"),
        lt(schema.formDrafts.expiresAt, sql`now()`),
      ),
    )
    .returning({ id: schema.formDrafts.id });
  return deleted.length;
}
