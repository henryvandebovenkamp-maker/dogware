import Link from "next/link";
import { ArrowRight, Check, ChevronRight, PlayCircle, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button, Container, Eyebrow, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";
import { DashboardMock } from "@/components/dashboard-mock";
import { Difference } from "@/components/sections/difference";
import { Testimonials } from "@/components/sections/testimonials";
import { FinalCta } from "@/components/sections/final-cta";
import { CrossLinks } from "@/components/landing/cross-links";
import { Faq } from "@/components/landing/faq";
import { BRANCHE_BY_SLUG } from "@/lib/branches";
import type { Need } from "@/lib/needs";

/**
 * De landingspagina per behoefte — voor bezoekers die niet vanuit hun branche
 * denken maar vanuit hun probleem ("ik wil minder administratie").
 *
 * Gebruikt dezelfde bouwstenen als de rest van de site: Container, Eyebrow,
 * Button, SectionHeading, Reveal en de bestaande secties.
 */
export function NeedPage({ need }: { need: Need }) {
  const branches = need.branches
    .map((slug) => BRANCHE_BY_SLUG.get(slug))
    .filter((b) => b !== undefined);

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-20">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sage-100 via-cream-100 to-brand-100 blur-3xl opacity-70" />
          </div>

          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
              <div className="flex flex-col items-start">
                <Reveal>
                  <Eyebrow tone="sage">
                    <need.icon className="h-3.5 w-3.5" />
                    {need.titel}
                  </Eyebrow>
                </Reveal>

                <Reveal delay={0.05}>
                  <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl">
                    {need.h1}
                  </h1>
                </Reveal>

                <Reveal delay={0.1}>
                  <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink-500">
                    {need.intro}
                  </p>
                </Reveal>

                <Reveal delay={0.15}>
                  <div className="mt-9 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                    <Button href="/demo" variant="primary" size="lg">
                      Laat mijn voorbeeld maken
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                    </Button>
                    <Button href="#oplossing" variant="ghost" size="lg">
                      <PlayCircle className="h-4 w-4 text-brand" />
                      Zo werkt het
                    </Button>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={0.15}>
                <DashboardMock />
              </Reveal>
            </div>
          </Container>
        </section>

        {/* Kruimelpad */}
        <nav
          aria-label="Kruimelpad"
          className="border-y border-cream-200 bg-white/50 py-4"
        >
          <Container>
            <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-300">
              <li>
                <Link href="/" className="font-semibold transition-colors hover:text-ink">
                  DogWare
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <li>
                <Link
                  href="/#oplossingen"
                  className="font-semibold transition-colors hover:text-ink"
                >
                  Oplossingen
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <li aria-current="page" className="font-bold text-ink-700">
                {need.titel}
              </li>
            </ol>
          </Container>
        </nav>

        {/* De pijn */}
        <section className="py-20 sm:py-28">
          <Container>
            <SectionHeading eyebrow="Herken je dit?" title={need.pijn.titel} />
            <RevealStagger className="mx-auto mt-12 grid max-w-3xl gap-3">
              {need.pijn.items.map((item) => (
                <RevealItem key={item}>
                  <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-soft ring-1 ring-ink/5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
                      <X className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <p className="text-[15px] font-medium text-ink-700">{item}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </Container>
        </section>

        {/* De oplossing */}
        <section id="oplossing" className="bg-white py-20 sm:py-28">
          <Container>
            <SectionHeading
              eyebrow="Zo lost DogWare het op"
              eyebrowTone="sage"
              title={need.oplossing.titel}
            />
            <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2">
              {need.oplossing.stappen.map((s, i) => (
                <RevealItem key={s.titel}>
                  <div className="flex h-full flex-col rounded-3xl bg-cream p-6 ring-1 ring-ink/5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-glow">
                        <s.icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-300">
                        Stap {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-extrabold text-ink">{s.titel}</h3>
                    <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-500">
                      {s.tekst}
                    </p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </Container>
        </section>

        {/* Wat er precies in zit */}
        <section className="py-20 sm:py-28">
          <Container>
            <SectionHeading
              eyebrow="Wat je krijgt"
              title="Concreet zit dit erin."
              intro="Onderdelen van hetzelfde platform. Je zet aan wat je nodig hebt."
            />
            <RevealStagger
              className="mx-auto mt-12 grid max-w-4xl gap-2.5 sm:grid-cols-2"
              stagger={0.04}
            >
              {need.features.map((f) => (
                <RevealItem key={f}>
                  <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3.5 shadow-soft ring-1 ring-ink/5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-[14px] font-semibold text-ink-700">{f}</span>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </Container>
        </section>

        {/* Voor wie dit het meest speelt */}
        <section className="bg-white py-20 sm:py-28">
          <Container>
            <SectionHeading
              eyebrow="Vooral herkenbaar voor"
              title="Bekijk het voor jouw type bedrijf."
              intro="Op elke branchepagina zie je precies hoe dit er in jouw dagelijkse praktijk uitziet."
            />
            <RevealStagger
              className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              stagger={0.05}
            >
              {branches.map((b) => (
                <RevealItem key={b.slug}>
                  <Link
                    href={b.path}
                    className="group flex h-full flex-col rounded-3xl bg-cream p-6 ring-1 ring-ink/5 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lift hover:ring-brand/20"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <b.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-extrabold text-ink">{b.naam}</h3>
                    <p className="mt-1.5 flex-1 text-pretty text-[14px] leading-relaxed text-ink-500">
                      {b.kaartTekst}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand">
                      Bekijken
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          </Container>
        </section>

        <Difference />
        <Testimonials />
        <Faq items={need.faq} titel={`Vragen over ${need.titel.toLowerCase()}`} />
        <FinalCta />
        <CrossLinks needsFirst={[need.slug]} exclude={need.slug} />
      </main>
      <SiteFooter />
    </>
  );
}
