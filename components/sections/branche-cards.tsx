import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";
import { BRANCHES } from "@/lib/branches";

/**
 * "Kies jouw branche" — de herkenningsingang.
 *
 * Iedere kaart leidt naar een volledige, branchespecifieke landingspagina
 * (/trimsalon-software, /hondenschool-software, …) met dezelfde huisstijl en
 * dezelfde componenten als deze homepage.
 */
export function BrancheCards() {
  return (
    <section id="branches" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Kies jouw branche"
          title="Wat voor bedrijf heb jij?"
          intro="DogWare is één platform, maar het werkt voor iedere branche net even anders. Kies wat bij je past en zie precies hoe het er voor jouw bedrijf uitziet."
        />

        <RevealStagger
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.05}
        >
          {BRANCHES.map((b) => (
            <RevealItem key={b.slug}>
              <Link
                href={b.path}
                className="group flex h-full flex-col rounded-3xl bg-cream p-6 ring-1 ring-ink/5 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lift hover:ring-brand/20"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <b.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-extrabold tracking-tight text-ink">
                  {b.naam}
                </h3>
                <p className="mt-2 flex-1 text-pretty text-[15px] leading-relaxed text-ink-500">
                  {b.kaartTekst}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                  DogWare voor {b.meervoud}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealStagger>

        <p className="mt-8 text-center text-[15px] text-ink-500">
          Staat jouw bedrijf er niet tussen?{" "}
          <Link href="/demo" className="font-bold text-brand hover:text-brand-600">
            Vertel wat je doet
          </Link>{" "}
          — DogWare werkt voor ieder bedrijf dat met dieren werkt.
        </p>
      </Container>
    </section>
  );
}
