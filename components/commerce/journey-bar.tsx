import type { JourneyStage } from "@/lib/db/schema";
import { JOURNEY_PHASES, phaseStateFor } from "@/lib/journey-stages";
import { cn } from "@/lib/cn";

/**
 * De voortgangsbalk van de journey: zeven fases in plaats van twintig stappen.
 *
 * Dezelfde component in de admin én in de klantomgeving, zodat "waar staan we"
 * daar nooit iets anders kan zeggen dan hier. Mobiel-first: op smalle schermen
 * schuift hij horizontaal in plaats van dat de labels breken.
 */
export function JourneyBar({
  current,
  toon = "admin",
  className,
}: {
  current: JourneyStage;
  toon?: "admin" | "klant";
  className?: string;
}) {
  return (
    <div className={cn("-mx-1 overflow-x-auto pb-1", className)}>
      <ol className="flex min-w-max items-start gap-1 px-1">
        {JOURNEY_PHASES.map((phase, i) => {
          const state = phaseStateFor(i, current);
          const laatste = i === JOURNEY_PHASES.length - 1;
          return (
            <li key={phase.key} className="flex items-start">
              <div className="flex w-[74px] flex-col items-center gap-1.5 sm:w-[88px]">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold transition-colors",
                    state === "done" && "bg-sage text-white",
                    state === "current" &&
                      (toon === "klant"
                        ? "bg-brand text-white shadow-[0_0_0_4px_rgba(224,86,42,0.16)]"
                        : "bg-[#2f6bed] text-white shadow-[0_0_0_4px_rgba(47,107,237,0.15)]"),
                    state === "todo" && "bg-cream-200 text-ink-300",
                  )}
                >
                  {state === "done" ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-center text-[10.5px] font-bold leading-tight sm:text-[11px]",
                    state === "todo" ? "text-ink-300" : "text-ink",
                  )}
                >
                  {phase.label}
                </span>
              </div>
              {!laatste && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-3.5 h-0.5 w-3 rounded-full sm:w-5",
                    state === "done" ? "bg-sage" : "bg-cream-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
