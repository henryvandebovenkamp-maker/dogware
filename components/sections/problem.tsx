"use client";

import { Container, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";
import { useBrancheContent } from "@/components/branche/branche-context";

/**
 * De herkenning: "zo gaat het nu bij mij". Beweegt mee met de gekozen branche,
 * zodat een trimsalon over telefoontjes leest en een uitlaatservice over de
 * avondpuzzel met de rit van morgen.
 */
export function Problem({ branche }: { branche?: string }) {
  const c = useBrancheContent(branche);

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Herken je dit?"
          title={c.problem.titel}
          intro={c.problem.intro}
        />

        {/* De key laat de stagger opnieuw monteren bij een branchewissel.
            Zonder die remount blijven nieuwe items op de verborgen begintoestand
            staan: whileInView met once:true is dan al afgevuurd. */}
        <RevealStagger
          key={c.slug}
          className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2"
        >
          {c.problem.items.map((f) => (
            <RevealItem key={f.text}>
              <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-soft ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
                  <f.icon className="h-5 w-5" />
                </span>
                <p className="text-[15px] font-medium text-ink-700">{f.text}</p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-12 max-w-2xl text-balance text-center text-xl font-bold text-ink sm:text-2xl">
            {c.problem.conclusie}
            <span className="block text-brand">{c.problem.conclusieAccent}</span>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
