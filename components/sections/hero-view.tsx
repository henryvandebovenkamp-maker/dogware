"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, PlayCircle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { DashboardMock } from "@/components/dashboard-mock";
import { Reveal } from "@/components/reveal";
import { useBrancheContent } from "@/components/branche/branche-context";
import { demoHref, positioneringContent } from "@/lib/branches";
import { cn } from "@/lib/cn";

/**
 * Zachte opkomst van de kop en de subtekst. Bewust zonder AnimatePresence:
 * door alleen de `key` te wisselen vervangt React de tekst in dezelfde commit,
 * zodat de kop nooit even inklapt.
 */
const SWAP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: [0.21, 0.47, 0.32, 0.98] as const },
};

export function HeroView({
  branche,
  avatar,
}: {
  /** Slug van een vaste branche (landingspagina) — leeg op de homepage */
  branche?: string;
  /** Serverzijdig gerenderd avatarfotootje */
  avatar: ReactNode;
}) {
  /**
   * Twee bronnen, bewust gescheiden:
   *
   * `c` bepaalt WAT de hero zegt — kop, subtekst, chips, notificatie en het
   * dashboardvoorbeeld. Dat is de kernpositionering en volgt daarom nooit de
   * onthouden branchekeuze: op de homepage staat er altijd "hondenbedrijf",
   * op een branchelandingspagina altijd die ene branche.
   *
   * `keuze` bepaalt alleen WAAR de knoppen naartoe gaan. Heeft de bezoeker
   * hieronder een branche aangeklikt, dan mag de demoflow daar gewoon op
   * voorsorteren en verwijst "Bekijk voorbeeld" naar die landingspagina. Dat
   * verandert de boodschap niet, alleen de vervolgstap.
   */
  const c = positioneringContent(branche);
  const keuze = useBrancheContent(branche);
  const isLanding = Boolean(branche);

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
                Eén keer goed geregeld. Voor altijd onderhouden.
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-[3.4rem]">
                {c.hero.kopVoor}{" "}
                <span
                  className={cn(
                    "relative text-brand",
                    !c.hero.kopAccent.includes(" ") && "whitespace-nowrap",
                  )}
                >
                  <motion.span key={c.slug} className="inline-block" {...SWAP}>
                    {c.hero.kopAccent}
                  </motion.span>
                  <svg
                    className="absolute -bottom-1 left-0 h-2.5 w-full text-brand/30"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M0 5 Q 25 0 50 4 T 100 3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>{" "}
                {c.hero.kopNa}
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <motion.p
                key={c.slug}
                className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink-500"
                {...SWAP}
              >
                {c.hero.sub}
              </motion.p>
            </Reveal>

            <Reveal delay={0.15}>
              {/* items-start houdt de knoppen op mobiel zo breed als hun tekst;
                  in een kolom-flex zouden ze anders het hele scherm vullen. */}
              <div className="mt-9 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <Button href={demoHref(keuze)} variant="primary" size="lg">
                  Laat mijn voorbeeld maken
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                </Button>
                <Button
                  href={!isLanding && "path" in keuze ? keuze.path : "#oplossing"}
                  variant="ghost"
                  size="lg"
                >
                  <PlayCircle className="h-4 w-4 text-brand" />
                  Bekijk voorbeeld
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-9">
                <div className="flex flex-wrap gap-1.5">
                  {c.hero.chips.map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold text-ink-700 ring-1 ring-ink/5"
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sage-600">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  Alles werkt automatisch samen
                </p>
              </div>
            </Reveal>
          </div>

          {/* Visual */}
          <Reveal delay={0.15} className="relative">
            <div className="relative">
              <DashboardMock branche={branche} />

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

              {/* Zwevende kaart: notificatie — beweegt mee met de branche */}
              <div className="absolute -right-3 bottom-12 hidden animate-float-slower rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink/5 sm:block">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand">
                    <Bell className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold text-ink">{c.hero.notificatie.titel}</p>
                    <p className="text-[10px] text-ink-300">{c.hero.notificatie.tekst}</p>
                  </div>
                </div>
              </div>

              {/* Zwevende kaart: gebouwd door hondenmensen */}
              <div className="absolute -left-2 -bottom-5 hidden animate-float-slower rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink/5 sm:block">
                <a href="#verhaal" className="flex items-center gap-2.5">
                  {avatar}
                  <div>
                    <p className="text-[11px] font-bold text-ink">Gebouwd door hondenmensen</p>
                    <p className="text-[10px] text-ink-300">Henry · oprichter. Lees zijn verhaal</p>
                  </div>
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
