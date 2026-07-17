import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  MessageCircleHeart,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button, Container } from "@/components/ui";
import { BrandMark } from "@/components/brand";

const IMAGINE = [
  "Nog een hond helpen?",
  "Een extra training geven?",
  "Eerder naar huis?",
  "Meer tijd voor je eigen hond?",
];

const KRIJGT = [
  {
    icon: MessageCircleHeart,
    text: "Vertel in 2–3 minuten iets over jouw bedrijf",
  },
  {
    icon: Wand2,
    text: "Ik bouw een demo die aansluit op jouw diensten en werkwijze",
  },
  {
    icon: Clock,
    text: "Binnen 24 uur een kosteloos voorbeeld van jouw eigen DogWare-omgeving",
  },
];

export function FinalCta() {
  return (
    <section id="demo" className="relative overflow-hidden bg-ink py-20 text-cream sm:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-sage/20 blur-3xl" />
      </div>

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          {/* Emotionele afsluiter */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream/80 ring-1 ring-white/15">
              <Heart className="h-3.5 w-3.5 text-brand-400" />
              Waarom DogWare bestaat
            </span>
            <h2 className="mt-6 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-[2.7rem]">
              Stel je voor dat je morgen een uur minder administratie hebt.
            </h2>
            <p className="mt-5 text-lg text-cream/70">Wat zou je doen?</p>
            <ul className="mt-5 space-y-2.5">
              {IMAGINE.map((q) => (
                <li key={q} className="flex items-center gap-3 text-cream/90">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" />
                  <span className="text-[15px] font-medium">{q}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xl font-extrabold text-cream">
                Doe weer wat je leuk vindt. Werk met honden.
              </p>
              <p className="mt-1 text-lg font-semibold text-brand-400">
                Wij regelen de rest.
              </p>
            </div>
          </div>

          {/* Uitnodiging persoonlijke demo */}
          <div className="rounded-3xl bg-cream p-7 text-ink shadow-lift sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <BrandMark size={40} className="h-10 w-10" />
              <div>
                <h3 className="text-xl font-extrabold text-ink">
                  Jouw persoonlijke demo
                </h3>
                <p className="text-[13px] text-ink-500">
                  Niet alleen horen wat kan — het direct zien voor jouw bedrijf
                </p>
              </div>
            </div>

            <ul className="space-y-3.5">
              {KRIJGT.map((k) => (
                <li key={k.text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand">
                    <k.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[15px] font-medium leading-relaxed text-ink-700">
                    {k.text}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              href="/demo"
              variant="primary"
              size="lg"
              className="mt-7 w-full"
            >
              Maak mijn persoonlijke DogWare demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-300">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Geen offerte, maar een kosteloos voorbeeld — je zit nergens aan
              vast.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
