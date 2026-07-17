import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { STAGE_META, stageIndex } from "@/lib/journey-stages";
import { cn } from "@/lib/cn";

/** Verticale tijdlijn met de 10 journey-stappen; huidige stap gemarkeerd. */
export function StageTimeline({ current }: { current: JourneyStage }) {
  const curIdx = stageIndex(current);
  return (
    <ol className="relative">
      {JOURNEY_STAGES.map((stage, i) => {
        const done = i < curIdx;
        const active = i === curIdx;
        const last = i === JOURNEY_STAGES.length - 1;
        return (
          <li key={stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-brand shadow-[0_0_0_4px_rgba(224,86,42,0.15)]"
                    : done
                      ? "bg-sage"
                      : "bg-cream-200",
                )}
              >
                {done && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {!last && (
                <span
                  className={cn(
                    "w-px flex-1",
                    i < curIdx ? "bg-sage/40" : "bg-cream-200",
                  )}
                  style={{ minHeight: "1.5rem" }}
                />
              )}
            </div>
            <span
              className={cn(
                "pb-5 text-[14px]",
                active
                  ? "font-extrabold text-ink"
                  : done
                    ? "font-semibold text-ink-500"
                    : "text-ink-300",
              )}
            >
              {STAGE_META[stage].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
