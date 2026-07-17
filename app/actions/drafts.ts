"use server";

import {
  loadDraft,
  markDraftSubmitted,
  saveDraft,
  startDraft,
  type DraftSnapshot,
  type SaveOutcome,
} from "@/lib/drafts/service";

/**
 * Dunne server-action-laag boven de DraftService. Elke actie autoriseert
 * server-side (eigenaar of geldig drafttoken) — een draft-ID alleen is
 * nooit genoeg. Gevoelige velden horen niet in de payload thuis.
 */

export type StartDraftResult = { draftId: string; draftToken?: string } | null;

export async function startDraftAction(
  formType: string,
  initialPayload: Record<string, unknown> = {},
): Promise<StartDraftResult> {
  return startDraft(formType, initialPayload);
}

export async function loadDraftAction(
  draftId: string,
  draftToken?: string,
): Promise<DraftSnapshot | null> {
  return loadDraft(draftId, draftToken);
}

export async function saveDraftAction(params: {
  draftId: string;
  draftToken?: string;
  baseVersion: number;
  payload: Record<string, unknown>;
  currentStep?: string | null;
}): Promise<SaveOutcome> {
  return saveDraft(params);
}

export async function submitDraftAction(
  draftId: string,
  draftToken?: string,
): Promise<void> {
  await markDraftSubmitted(draftId, draftToken);
}
