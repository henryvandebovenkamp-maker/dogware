"use client";

import { motion } from "motion/react";

/**
 * Rustige herstelmelding wanneer een eerder concept wordt teruggevonden.
 * Verwijdert nooit gegevens zonder bevestiging.
 */
export function RestoreBanner({
  onResume,
  onDiscard,
}: {
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3.5 shadow-soft ring-1 ring-ink/5"
    >
      <p className="text-[13px] font-medium text-ink-700">
        Je eerdere gegevens zijn hersteld. Wil je verdergaan waar je gebleven
        was?
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResume}
          className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-cream transition hover:bg-ink-700"
        >
          Verdergaan
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-ink-300 transition hover:text-ink-500"
        >
          Opnieuw beginnen
        </button>
      </div>
    </motion.div>
  );
}
