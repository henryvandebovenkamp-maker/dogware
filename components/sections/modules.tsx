"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { ALGEMEEN, BRANCHES, type BrancheSlug } from "@/lib/branches";
import { useBranche, useBrancheContent } from "@/components/branche/branche-context";
import { cn } from "@/lib/cn";

/**
 * De modules per vakgebied. De tabs zijn gekoppeld aan de branchekiezer
 * bovenaan: kiest iemand hier een tab, dan volgt de rest van de homepage.
 *
 * Met een vaste `branche` (op een landingspagina) vervallen de tabs en toont
 * het blok alleen wat er voor die branche in zit.
 */
export function Modules({ branche }: { branche?: string }) {
  const { active, select } = useBranche();
  const [fallback, setFallback] = useState<BrancheSlug>("hondenschool");

  // Op de homepage volgt het paneel de globale keuze; is die er nog niet, dan
  // toont het de tab die de bezoeker hier zelf aanklikte.
  const zichtbaar = branche ?? active ?? fallback;
  const c = useBrancheContent(zichtbaar);
  const vast = Boolean(branche);

  return (
    <section id="modules" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Modules"
          title={
            vast ? `Wat zit er in DogWare voor jouw ${c.naamKlein}?` : ALGEMEEN.moduleTitel
          }
          intro={
            vast
              ? "Kies de onderdelen die bij jouw bedrijf passen. Combineer er zoveel als je wilt. Ze werken gewoon samen in dezelfde omgeving."
              : ALGEMEEN.moduleDesc
          }
        />

        {/* Tabs — alleen op de homepage */}
        {!vast && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {BRANCHES.map((m) => (
              <button
                key={m.slug}
                type="button"
                aria-pressed={m.slug === zichtbaar}
                onClick={() => {
                  setFallback(m.slug);
                  select(m.slug);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
                  m.slug === zichtbaar
                    ? "bg-brand text-white shadow-[0_10px_24px_-12px_rgba(224,86,42,0.8)]"
                    : "bg-cream text-ink-700 ring-1 ring-ink/5 hover:bg-cream-100",
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.naam}
              </button>
            ))}
          </div>
        )}

        {/* Panel */}
        <div className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-cream to-cream-100 p-6 ring-1 ring-ink/5 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-glow">
                <c.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {c.moduleTitel}
              </h3>
              <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-ink-500">
                {c.moduleDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {c.features.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[14px] font-semibold text-ink-700">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
