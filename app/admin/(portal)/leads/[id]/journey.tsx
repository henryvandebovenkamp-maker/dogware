import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { STAGE_META, stepStateFor } from "@/lib/journey-stages";
import { cn } from "@/lib/cn";

/**
 * Verticale tijdlijn met exact drie statussen:
 * groen = afgerond, blauw = huidige stap, grijs = nog niet gestart.
 */
export function StageTimeline({ current }: { current: JourneyStage }) {
  return (
    <ol className="relative">
      {JOURNEY_STAGES.map((stage, i) => {
        const state = stepStateFor(stage, current);
        const last = i === JOURNEY_STAGES.length - 1;
        return (
          <li key={stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  state === "done" && "bg-sage",
                  state === "current" && "bg-[#2f6bed] shadow-[0_0_0_4px_rgba(47,107,237,0.15)]",
                  state === "todo" && "bg-cream-200",
                )}
              >
                {state === "done" && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {!last && (
                <span
                  className={cn("w-px flex-1", state === "done" ? "bg-sage/40" : "bg-cream-200")}
                  style={{ minHeight: "1.5rem" }}
                />
              )}
            </div>
            <span
              className={cn(
                "pb-5 text-[14px]",
                state === "current" && "font-extrabold text-ink",
                state === "done" && "font-semibold text-ink-500",
                state === "todo" && "text-ink-300",
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
