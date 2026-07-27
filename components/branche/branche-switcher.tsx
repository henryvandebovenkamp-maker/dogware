"use client";

import { ArrowRight, PawPrint, X } from "lucide-react";
import Link from "next/link";
import { BRANCHES } from "@/lib/branches";
import { useBranche } from "@/components/branche/branche-context";
import { cn } from "@/lib/cn";

/**
 * "Ik heb een…" — de branchekiezer direct onder de hero.
 *
 * Vervangt de oude marquee met branchenamen: dezelfde boodschap ("we zijn er
 * voor al deze bedrijven"), maar nu klikbaar. Een keuze past de homepage
 * meteen aan, zonder de pagina te herladen.
 */
export function BrancheSwitcher() {
  const { active, select, content } = useBranche();
  const gekozen = content.slug !== "algemeen";

  return (
    <section
      id="branchekiezer"
      aria-label="Kies jouw branche"
      className="border-y border-cream-200 bg-white/50 py-7 sm:py-8"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
            Ik heb een…
          </p>

          <div
            role="group"
            aria-label="Branche"
            className="flex flex-wrap justify-center gap-2"
          >
            {BRANCHES.map((b) => {
              const isActive = active === b.slug;
              return (
                <button
                  key={b.slug}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => select(isActive ? null : b.slug)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                    isActive
                      ? "bg-brand text-white shadow-[0_10px_24px_-12px_rgba(224,86,42,0.8)]"
                      : "bg-cream text-ink-700 ring-1 ring-ink/5 hover:-translate-y-0.5 hover:bg-white",
                  )}
                >
                  <b.icon className="h-4 w-4 shrink-0" />
                  {b.naam}
                </button>
              );
            })}

            <Link
              href="#branches"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-ink-500 ring-1 ring-ink/10 transition-all hover:-translate-y-0.5 hover:bg-white hover:text-ink"
            >
              <PawPrint className="h-4 w-4 shrink-0" />
              Anders
            </Link>
          </div>

          {gekozen && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
              <p className="text-[15px] font-semibold text-ink">
                Mooi. Deze pagina laat nu {content.slug === "dierenverzorging" ? "" : "een "}
                <span className="text-brand">{content.naamKlein}</span> zien.
              </p>
              {"path" in content && (
                <Link
                  href={content.path}
                  className="group inline-flex items-center gap-1.5 text-[15px] font-bold text-brand transition-colors hover:text-brand-600"
                >
                  Alles voor {content.meervoud}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => select(null)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-500"
              >
                <X className="h-3.5 w-3.5" />
                keuze wissen
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
