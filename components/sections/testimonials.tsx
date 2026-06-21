import { Star, Quote } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";

const TESTIMONIALS = [
  {
    quote:
      "Voor het eerst heb ik het gevoel dat alles samenwerkt. Geen losse lijstjes meer.",
    name: "Sanne Bakker",
    role: "Hondenschool De Vrije Loop",
    emoji: "🐕",
  },
  {
    quote:
      "Ik besteed veel minder tijd aan administratie en veel meer aan de honden zelf.",
    name: "Marco de Wit",
    role: "Uitlaatservice Vier Poten",
    emoji: "🦮",
  },
  {
    quote:
      "Mijn klanten ervaren meer rust en professionaliteit. Dat zie ik echt terug.",
    name: "Linda Vermeer",
    role: "Trimsalon Pluis & Poot",
    emoji: "✂️",
  },
  {
    quote:
      "Ik kan me eindelijk weer focussen op het begeleiden van honden. Daar deed ik het voor.",
    name: "Joost Hendriks",
    role: "Gedragstherapie Kalm & Co",
    emoji: "🐶",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Verhalen uit de praktijk"
          eyebrowTone="sage"
          title="Hondenprofessionals die hun tijd terugkregen."
        />

        <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <RevealItem key={t.name}>
              <figure className="flex h-full flex-col rounded-3xl bg-white p-7 shadow-soft ring-1 ring-ink/5">
                <Quote className="h-7 w-7 text-brand/30" />
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-gold text-gold" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-pretty text-lg font-semibold leading-relaxed text-ink">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-100 text-xl ring-1 ring-ink/5">
                    {t.emoji}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{t.name}</span>
                    <span className="block text-[13px] text-ink-500">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </RevealItem>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
