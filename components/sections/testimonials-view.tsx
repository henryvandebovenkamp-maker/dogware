"use client";

import type { ReactNode } from "react";
import { Star, Quote } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";
import { BRANCHES } from "@/lib/branches";
import { useBranche } from "@/components/branche/branche-context";
import { cn } from "@/lib/cn";

/** Vier verhalen, met dat van de gekozen branche vooraan en uitgelicht. */
export function TestimonialsView({
  branche,
  avatars,
}: {
  branche?: string;
  avatars: Record<string, ReactNode>;
}) {
  const { active } = useBranche();
  const gekozen = branche ?? active ?? null;

  const eigen = gekozen ? BRANCHES.find((b) => b.slug === gekozen) : undefined;
  const rest = BRANCHES.filter((b) => b.slug !== eigen?.slug);
  const tonen = (eigen ? [eigen, ...rest] : rest).slice(0, 4);

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Verhalen uit de praktijk"
          eyebrowTone="sage"
          title={
            eigen
              ? `${eigen.meervoud.charAt(0).toUpperCase()}${eigen.meervoud.slice(1)} die hun tijd terugkregen.`
              : "Hondenprofessionals die hun tijd terugkregen."
          }
        />

        {/* Key: remount bij een branchewissel, anders blijven de nieuw getoonde
            verhalen op hun verborgen begintoestand staan (whileInView once:true). */}
        <RevealStagger
          key={eigen?.slug ?? "algemeen"}
          className="mt-12 grid gap-4 sm:grid-cols-2"
        >
          {tonen.map((b) => {
            const t = b.testimonial;
            const uitgelicht = b.slug === eigen?.slug;
            return (
              <RevealItem key={b.slug}>
                <figure
                  className={cn(
                    "flex h-full flex-col rounded-3xl bg-white p-7 shadow-soft ring-1 transition-shadow",
                    uitgelicht ? "ring-brand/25 shadow-lift" : "ring-ink/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <Quote className="h-7 w-7 text-brand/30" />
                    {uitgelicht && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600">
                        <b.icon className="h-3.5 w-3.5" />
                        {b.naam}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-gold text-gold" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-pretty text-lg font-semibold leading-relaxed text-ink">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    {avatars[b.slug]}
                    <span>
                      <span className="block text-sm font-bold text-ink">{t.name}</span>
                      <span className="block text-[13px] text-ink-500">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </RevealItem>
            );
          })}
        </RevealStagger>
      </Container>
    </section>
  );
}
