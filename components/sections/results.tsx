"use client";

import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";
import { useBrancheContent } from "@/components/branche/branche-context";

/**
 * Wat het oplevert — niet in functies, maar in wat je er echt aan hebt.
 * Per branche andere winst: een pension wil geen dubbele boekingen, een
 * trimsalon wil minder telefoontjes.
 */
export function Results({ branche }: { branche?: string }) {
  const c = useBrancheContent(branche);

  return (
    <section className="bg-gradient-to-b from-cream to-cream-100 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Resultaten"
          title={
            c.slug === "algemeen"
              ? "Wat levert DogWare op?"
              : `Wat levert DogWare op voor jouw ${c.naamKlein}?`
          }
          intro="Geen opsomming van functies, maar wat je er echt aan hebt."
        />

        {/* Key: remount bij een branchewissel, anders blijven de nieuwe kaarten
            op hun verborgen begintoestand staan (whileInView once:true). */}
        <RevealStagger
          key={c.slug}
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {c.results.map((r, i) => (
            <RevealItem
              key={r.titel}
              className={
                // De laatste kaart vult de rij netjes uit bij een oneven aantal
                i === c.results.length - 1 && c.results.length % 2 === 1
                  ? "sm:col-span-2 lg:col-span-1"
                  : ""
              }
            >
              <div className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-1 hover:shadow-lift">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <r.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-extrabold text-ink">{r.titel}</h3>
                <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-500">
                  {r.tekst}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
