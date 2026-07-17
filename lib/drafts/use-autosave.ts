"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDraftAction,
  saveDraftAction,
  startDraftAction,
  submitDraftAction,
} from "@/app/actions/drafts";

/**
 * Centrale, herbruikbare autosave-hook voor DogWare-formulieren.
 *
 * - Debounced server-save (gewijzigde payload), met versie-guard tegen
 *   out-of-order overschrijvingen.
 * - Lokaal vangnet (localStorage) dat blijft bestaan bij offline/refresh.
 * - Flush bij verlaten van de pagina (visibilitychange/pagehide).
 * - Herstel van een eerder concept bij terugkomst.
 *
 * Bewaar NOOIT gevoelige gegevens (tokens, codes, betaalgegevens) in de
 * payload — die horen hier niet thuis.
 */

export type SaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "offline"
  | "error";

type Options<T> = {
  formType: string;
  /** Huidige formulierwaarde */
  value: T;
  /** Huidige stap (optioneel, voor herstel op de juiste stap) */
  step?: string;
  /** Debounce in ms (spec: 500–1000) */
  debounceMs?: number;
  /** Start pas met opslaan als hier true (bijv. na eerste interactie) */
  enabled?: boolean;
};

type Persisted<T> = {
  draftId: string;
  draftToken?: string;
  version: number;
  payload: T;
  step?: string;
};

function lsKey(formType: string) {
  return `dw_draft_${formType}`;
}

export function useAutosave<T extends Record<string, unknown>>({
  formType,
  value,
  step,
  debounceMs = 800,
  enabled = true,
}: Options<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [restored, setRestored] = useState<Persisted<T> | null>(null);

  const ref = useRef<{
    draftId?: string;
    draftToken?: string;
    version: number;
    starting: boolean;
    /** Monotone teller: alleen de nieuwste save mag de status bepalen */
    seq: number;
    lastSerialized: string;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ version: 0, starting: false, seq: 0, lastSerialized: "", timer: null });

  /* ---------- Herstel bij eerste render ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(lsKey(formType))
          : null;
      if (!raw) return;
      try {
        const local = JSON.parse(raw) as Persisted<T>;
        // Probeer de serverversie te laden (bron van waarheid); val terug op lokaal
        const server = await loadDraftAction(local.draftId, local.draftToken);
        if (cancelled) return;
        if (server) {
          ref.current.draftId = server.draftId;
          ref.current.draftToken = local.draftToken;
          ref.current.version = server.version;
          setRestored({
            draftId: server.draftId,
            draftToken: local.draftToken,
            version: server.version,
            payload: server.payload as T,
            step: server.currentStep ?? undefined,
          });
        } else {
          // Server kent het concept niet (verlopen) — lokaal vangnet aanbieden
          ref.current.draftId = local.draftId;
          ref.current.draftToken = local.draftToken;
          ref.current.version = local.version;
          setRestored(local);
        }
      } catch {
        window.localStorage.removeItem(lsKey(formType));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Alleen bij mount voor dit formType
  }, [formType]);

  /* ---------- Kernsave ---------- */
  const persistLocal = useCallback(
    (payload: T) => {
      if (typeof window === "undefined") return;
      const snap: Persisted<T> = {
        draftId: ref.current.draftId ?? "",
        draftToken: ref.current.draftToken,
        version: ref.current.version,
        payload,
        step,
      };
      try {
        window.localStorage.setItem(lsKey(formType), JSON.stringify(snap));
      } catch {
        /* opslag vol of geweigerd — server blijft de primaire opslag */
      }
    },
    [formType, step],
  );

  const flush = useCallback(
    async (payload: T) => {
      if (!enabled) return;
      const serialized = JSON.stringify({ payload, step });
      if (serialized === ref.current.lastSerialized) return; // niets gewijzigd
      persistLocal(payload); // lokaal vangnet altijd eerst

      const mySeq = ++ref.current.seq;
      setStatus("saving");

      // Concept aanmaken indien nodig (eenmalig)
      if (!ref.current.draftId && !ref.current.starting) {
        ref.current.starting = true;
        const started = await startDraftAction(formType, {});
        ref.current.starting = false;
        if (started) {
          ref.current.draftId = started.draftId;
          ref.current.draftToken = started.draftToken;
          ref.current.version = 0;
          persistLocal(payload);
        }
      }
      if (!ref.current.draftId) {
        setStatus("offline"); // server onbereikbaar — lokaal staat het veilig
        return;
      }

      try {
        const res = await saveDraftAction({
          draftId: ref.current.draftId,
          draftToken: ref.current.draftToken,
          baseVersion: ref.current.version,
          payload,
          currentStep: step ?? null,
        });
        if (mySeq !== ref.current.seq) return; // nieuwere save al onderweg

        if (res.ok) {
          ref.current.version = res.version;
          ref.current.lastSerialized = serialized;
          setLastSavedAt(new Date(res.lastSavedAt));
          setStatus("saved");
        } else if (res.reason === "CONFLICT" && res.latest) {
          // Nieuwere versie elders: overneem versie, behoud eigen invoer lokaal
          ref.current.version = res.latest.version;
          setStatus("dirty");
        } else {
          setStatus("error");
        }
      } catch {
        if (mySeq === ref.current.seq) setStatus("offline");
      }
    },
    [enabled, formType, step, persistLocal],
  );

  /* ---------- Debounce op waarde-wijziging ---------- */
  useEffect(() => {
    if (!enabled) return;
    const state = ref.current;
    const serialized = JSON.stringify({ payload: value, step });
    if (serialized === state.lastSerialized) return;
    setStatus("dirty");
    persistLocal(value); // meteen lokaal, ook vóór de debounce

    if (state.timer) clearTimeout(state.timer);
    const timer = setTimeout(() => flush(value), debounceMs);
    state.timer = timer;
    return () => clearTimeout(timer);
  }, [value, step, enabled, debounceMs, flush, persistLocal]);

  /* ---------- Flush bij verlaten van de pagina ---------- */
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        persistLocal(value);
        // best-effort server-save; navigator.sendBeacon niet nodig voor draft
        void flush(value);
      }
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [enabled, value, flush, persistLocal]);

  /* ---------- Publieke helpers ---------- */

  const clearLocal = useCallback(() => {
    if (typeof window !== "undefined")
      window.localStorage.removeItem(lsKey(formType));
  }, [formType]);

  /** Forceer een laatste save (aanroepen vóór definitief verzenden). */
  const flushNow = useCallback(async () => {
    if (ref.current.timer) clearTimeout(ref.current.timer);
    await flush(value);
  }, [flush, value]);

  /** Markeer als ingediend en ruim het lokale vangnet op. */
  const markSubmitted = useCallback(async () => {
    if (ref.current.draftId) {
      await submitDraftAction(ref.current.draftId, ref.current.draftToken);
    }
    clearLocal();
  }, [clearLocal]);

  const dismissRestored = useCallback(() => setRestored(null), []);

  /** Begin opnieuw: lokaal vangnet weg, nieuw concept bij volgende wijziging. */
  const discardDraft = useCallback(() => {
    clearLocal();
    ref.current.draftId = undefined;
    ref.current.draftToken = undefined;
    ref.current.version = 0;
    ref.current.lastSerialized = "";
    setRestored(null);
  }, [clearLocal]);

  return {
    status,
    lastSavedAt,
    restored,
    dismissRestored,
    discardDraft,
    flushNow,
    markSubmitted,
  };
}
