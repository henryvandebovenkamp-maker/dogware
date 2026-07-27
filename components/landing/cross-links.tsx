import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";
import { BRANCHES } from "@/lib/branches";
import { NEEDS } from "@/lib/needs";

/**
 * Interne verwijzingen onderaan iedere landingspagina: naar de andere branches
 * en naar de veelgevraagde oplossingen. Houdt bezoekers binnen het platform en
 * geeft zoekmachines een duidelijke structuur.
 */
export function CrossLinks({
  /** Slug die je wilt overslaan (de pagina waar de bezoeker al is) */
  exclude,
  /** Welke oplossingen bovenaan komen te staan */
  needsFirst = [],
}: {
  exclude?: string;
  needsFirst?: string[];
}) {
  const branches = BRANCHES.filter((b) => b.slug !== exclude);
  const needs = [
    ...NEEDS.filter((n) => needsFirst.includes(n.slug)),
    ...NEEDS.filter((n) => !needsFirst.includes(n.slug)),
  ]
    .filter((n) => n.slug !== exclude)
    .slice(0, 6);

  return (
    <section className="border-t border-cream-200 bg-cream-100 py-16 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow="Eén platform, alle vakgebieden"
          title="DogWare werkt ook voor…"
          intro="Combineer gerust meerdere diensten. Alles draait in dezelfde omgeving, met dezelfde klanten, honden en facturen."
        />

        <RevealStagger
          className="mt-10 flex flex-wrap justify-center gap-2.5"
          stagger={0.03}
        >
          {branches.map((b) => (
            <RevealItem key={b.slug}>
              <Link
                href={b.path}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:text-ink hover:ring-brand/25"
              >
                <b.icon className="h-4 w-4 text-brand" />
                {b.naam}
              </Link>
            </RevealItem>
          ))}
        </RevealStagger>

        <div className="mx-auto mt-12 max-w-3xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
            Of zoek je een oplossing voor…
          </p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {needs.map((n) => (
              <Link
                key={n.slug}
                href={n.path}
                className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:ring-sage/25"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-sage">
                  <n.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-[14px] font-semibold text-ink-700">
                  {n.titel}
                </span>
                <ArrowRight className="h-4 w-4 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-sage" />
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
