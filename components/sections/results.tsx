import { Wind, LayoutGrid, Sparkles, BadgeCheck, Clock } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";

const RESULTS = [
  {
    icon: Wind,
    title: "Meer rust",
    desc: "Minder losse systemen. Minder ruis. Minder stress.",
  },
  {
    icon: LayoutGrid,
    title: "Meer overzicht",
    desc: "Alles centraal, altijd actueel en op één plek.",
  },
  {
    icon: Sparkles,
    title: "Minder administratie",
    desc: "Automatisering neemt het werk uit handen.",
  },
  {
    icon: BadgeCheck,
    title: "Professionelere uitstraling",
    desc: "Een moderne, verzorgde ervaring voor je klanten.",
  },
  {
    icon: Clock,
    title: "Meer tijd",
    desc: "Voor klanten. Voor honden. Voor jezelf.",
    wide: true,
  },
];

export function Results() {
  return (
    <section className="bg-gradient-to-b from-cream to-cream-100 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Resultaten"
          title="Wat levert DogWare op?"
          intro="Geen lijst met features, maar wat het écht oplevert voor jou en je bedrijf."
        />

        <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESULTS.map((r) => (
            <RevealItem key={r.title} className={r.wide ? "sm:col-span-2 lg:col-span-1" : ""}>
              <div className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-1 hover:shadow-lift">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <r.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-extrabold text-ink">{r.title}</h3>
                <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-500">
                  {r.desc}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
