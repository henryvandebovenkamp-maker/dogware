import { Star, Quote } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/photo";
import { RevealStagger, RevealItem } from "@/components/reveal";

// Plaats echte foto's in /public/photos met de bestandsnaam uit `photo`;
// zolang die ontbreekt wordt de emoji getoond.
const TESTIMONIALS = [
  {
    quote:
      "Voor het eerst heb ik het gevoel dat alles samenwerkt. Geen losse lijstjes meer.",
    name: "Sanne Bakker",
    role: "Hondenschool De Vrije Loop",
    emoji: "🐕",
    photo: "testimonial-sanne.jpg",
  },
  {
    quote:
      "Ik besteed veel minder tijd aan administratie en veel meer aan de honden zelf.",
    name: "Marco de Wit",
    role: "Uitlaatservice Vier Poten",
    emoji: "🦮",
    photo: "testimonial-marco.jpg",
  },
  {
    quote:
      "Mijn klanten ervaren meer rust en professionaliteit. Dat zie ik echt terug.",
    name: "Linda Vermeer",
    role: "Trimsalon Pluis & Poot",
    emoji: "✂️",
    photo: "testimonial-linda.jpg",
  },
  {
    quote:
      "Ik kan me eindelijk weer focussen op het begeleiden van honden. Daar deed ik het voor.",
    name: "Joost Hendriks",
    role: "Gedragstherapie Kalm & Co",
    emoji: "🐶",
    photo: "testimonial-joost.jpg",
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
                  <Avatar file={t.photo} alt={t.name} fallback={t.emoji} />
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
