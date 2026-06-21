import { ArrowRight, PlayCircle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { DashboardMock } from "@/components/dashboard-mock";
import { Reveal } from "@/components/reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      {/* Achtergrond gloed */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-100 via-cream-100 to-sage-100 blur-3xl opacity-70" />
        <div className="absolute right-[8%] top-40 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          {/* Tekst */}
          <div className="flex flex-col items-start">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink/5 shadow-soft">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Het complete platform voor de hondenbranche
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-[3.4rem]">
                Jij bent geen hondenprofessional geworden om{" "}
                <span className="relative whitespace-nowrap text-brand">
                  administratie
                  <svg
                    className="absolute -bottom-1 left-0 h-2.5 w-full text-brand/30"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M0 5 Q 25 0 50 4 T 100 3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>{" "}
                te doen.
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink-500">
                Je bent begonnen omdat je graag met honden werkt. DogWare
                automatiseert planning, klantbeheer, betalingen, webshop,
                communicatie, medewerkers en administratie. Zodat jij weer kunt
                doen wat je het liefste doet.{" "}
                <span className="font-semibold text-ink">Werken met honden.</span>
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="#demo" variant="primary" size="lg">
                  Vraag een demo aan
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button href="#oplossing" variant="ghost" size="lg">
                  <PlayCircle className="h-5 w-5 text-brand" />
                  Bekijk hoe DogWare werkt
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  Geen losse systemen
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  Alles automatisch
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  Eén centrale omgeving
                </span>
              </div>
            </Reveal>
          </div>

          {/* Visual */}
          <Reveal delay={0.15} className="relative">
            <div className="relative">
              <DashboardMock />

              {/* Zwevende kaart: betaling */}
              <div className="absolute -left-4 top-16 hidden animate-float-slow rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink/5 sm:block">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-sage">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-ink">Betaling ontvangen</p>
                    <p className="text-[10px] text-ink-300">iDEAL · € 89,00</p>
                  </div>
                </div>
              </div>

              {/* Zwevende kaart: notificatie */}
              <div className="absolute -right-3 bottom-12 hidden animate-float-slower rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink/5 sm:block">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand">
                    <Bell className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-ink">Nieuwe inschrijving</p>
                    <p className="text-[10px] text-ink-300">Puppycursus · automatisch verwerkt</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
