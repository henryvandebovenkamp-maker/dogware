import { X, Check, PawPrint } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const GENERIC = ["Kappers", "Restaurants", "Winkels", "Algemene bedrijven"];
const NOPES = ["Geen aanpassingen", "Geen workarounds", "Geen compromissen"];

export function Difference() {
  return (
    <section id="verschil" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Het verschil"
          title="Waarom DogWare anders is."
          intro="De meeste software is gemaakt voor algemene bedrijven en daarna 'geschikt gemaakt' voor honden. DogWare is het tegenovergestelde."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* Andere software */}
          <Reveal>
            <div className="flex h-full flex-col rounded-3xl border border-cream-200 bg-white/60 p-7 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-ink-300">
                De meeste software
              </p>
              <h3 className="mt-3 text-xl font-bold text-ink-500">
                Gemaakt voor iedereen. Dus voor niemand echt.
              </h3>
              <ul className="mt-6 space-y-3">
                {GENERIC.map((g) => (
                  <li key={g} className="flex items-center gap-3 text-ink-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-200 text-ink-300">
                      <X className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="font-medium">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* DogWare */}
          <Reveal delay={0.08}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-600 p-7 text-white shadow-glow sm:p-8">
              <PawPrint className="absolute -right-6 -top-6 h-32 w-32 text-white/10" />
              <p className="text-sm font-semibold uppercase tracking-wider text-white/80">
                DogWare
              </p>
              <h3 className="mt-3 text-xl font-bold">
                Gebouwd vanuit de praktijk van hondenprofessionals.
              </h3>
              <p className="mt-4 text-pretty text-[15px] leading-relaxed text-white/85">
                Iedere functie is ontworpen voor ondernemers die dagelijks werken
                met honden en hun eigenaren. Gewoon een systeem dat begrijpt hoe
                jouw bedrijf werkt.
              </p>
              <ul className="mt-6 space-y-3">
                {NOPES.map((n) => (
                  <li key={n} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
