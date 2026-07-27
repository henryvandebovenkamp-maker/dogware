"use client";

import { useActionState } from "react";
import {
  draaiAgentNu,
  zetAgentAanUit,
  type AgentState,
} from "@/app/actions/groei-agents";

const IDLE: AgentState = { status: "idle" };

export function AgentKaart({
  id,
  naam,
  branche,
  gebied,
  actief,
  maxPerRun,
  laatste,
}: {
  id: string;
  naam: string;
  branche: string;
  gebied: string;
  actief: boolean;
  maxPerRun: number;
  laatste: string | null;
}) {
  const [runState, run, bezig] = useActionState(draaiAgentNu, IDLE);
  const [, wissel, wisselt] = useActionState(zetAgentAanUit, IDLE);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink">{naam}</p>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Zoekt {branche} in {gebied}, maximaal {maxPerRun} per keer.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
            actief ? "bg-sage-100 text-sage-600" : "bg-cream-100 text-ink-300"
          }`}
        >
          {actief ? "Actief" : "Gepauzeerd"}
        </span>
      </div>

      <p className="mt-3 text-[12px] text-ink-300">
        {laatste ? `Laatst gezocht: ${laatste}` : "Heeft nog niet gezocht."}
      </p>

      {bezig && (
        <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-500">
          Aan het zoeken bij OpenStreetMap… dit duurt een halve minuut.
        </p>
      )}
      {runState.status === "ok" && !bezig && (
        <p className="mt-3 rounded-xl bg-sage-100 px-4 py-3 text-[13px] font-semibold text-sage-600">
          {runState.message}
        </p>
      )}
      {runState.status === "error" && !bezig && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-600">
          {runState.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form action={run}>
          <input type="hidden" name="agentId" value={id} />
          <button
            type="submit"
            disabled={bezig || !actief}
            className="rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold leading-[1.2] text-cream transition-all duration-150 ease-out hover:-translate-y-px hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {bezig ? "Bezig…" : "Nu laten zoeken"}
          </button>
        </form>
        <form action={wissel}>
          <input type="hidden" name="agentId" value={id} />
          <button
            type="submit"
            disabled={wisselt}
            className="rounded-xl px-4 py-2.5 text-[14px] font-semibold leading-[1.2] text-ink-500 ring-1 ring-ink/10 transition-all duration-150 ease-out hover:-translate-y-px hover:bg-cream hover:text-ink disabled:opacity-50"
          >
            {actief ? "Pauzeren" : "Weer aanzetten"}
          </button>
        </form>
      </div>
    </div>
  );
}
