"use client";

import { AnimatePresence, motion } from "motion/react";
import type { SaveStatus } from "@/lib/drafts/use-autosave";
import { GlyphCheck } from "@/components/demo/illustrations";

/**
 * Rustige, subtiele opslagstatus. Geen grote meldingen, geen emoji.
 * Toont "Opslaan…", "Opgeslagen om HH:MM", of een offline/foutmelding.
 */
export function SaveIndicator({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onRetry?: () => void;
}) {
  const tijd = lastSavedAt
    ? lastSavedAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    : null;

  let content: React.ReactNode = null;
  if (status === "saving") {
    content = (
      <span className="flex items-center gap-1.5 text-ink-300">
        <Spinner /> Wijzigingen opslaan…
      </span>
    );
  } else if (status === "saved") {
    content = (
      <span className="flex items-center gap-1.5 text-ink-300">
        <GlyphCheck className="h-3.5 w-3.5 text-sage" />
        {tijd ? `Opgeslagen om ${tijd}` : "Opgeslagen"}
      </span>
    );
  } else if (status === "dirty") {
    content = <span className="text-ink-300">Nog niet opgeslagen…</span>;
  } else if (status === "offline") {
    content = (
      <span className="flex items-center gap-2 text-ink-500">
        Je wijzigingen staan veilig op dit apparaat en worden opgeslagen zodra
        de verbinding terug is.
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-brand hover:text-brand-600"
          >
            Nu opnieuw proberen
          </button>
        )}
      </span>
    );
  } else if (status === "error") {
    content = (
      <span className="flex items-center gap-2 text-brand-600">
        Opslaan mislukt.
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline underline-offset-2"
          >
            Opnieuw proberen
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="h-4 text-[12px] font-medium" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-ink-300/40 border-t-ink-300" />
  );
}
