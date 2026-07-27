import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";
import { NEEDS } from "@/lib/needs";

/**
 * "Of zoek je een oplossing voor…" — de tweede ingang.
 *
 * Niet iedereen denkt vanuit zijn branche. Veel ondernemers komen binnen met
 * een probleem ("ik wil minder administratie"). Deze kaarten vangen dat op en
 * leiden naar een eigen landingspagina per behoefte.
 */
export function NeedCards() {
  return (
    <section id="oplossingen" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Of zoek je een oplossing voor…"
          eyebrowTone="sage"
          title="Waar loop jij tegenaan?"
          intro="Denk je niet vanuit je branche maar vanuit je probleem? Kies waar het bij jou schuurt, dan laten we zien hoe DogWare het oplost."
        />

        <RevealStagger
          className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.04}
        >
          {NEEDS.map((n) => (
            <RevealItem key={n.slug}>
              <Link
                href={n.path}
                className="group flex h-full items-start gap-4 rounded-2xl bg-white px-5 py-5 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift hover:ring-sage/25"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage transition-colors group-hover:bg-sage group-hover:text-white">
                  <n.icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-extrabold text-ink">
                    {n.titel}
                  </span>
                  <span className="mt-1 block text-pretty text-[13px] leading-relaxed text-ink-500">
                    {n.kort}
                  </span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-sage" />
              </Link>
            </RevealItem>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
