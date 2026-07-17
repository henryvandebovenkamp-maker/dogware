import { ArrowRight, PlayCircle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { DashboardMock } from "@/components/dashboard-mock";
import { Avatar } from "@/components/photo";
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
                Eén keer goed geregeld. Voor altijd onderhouden.
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-[3.4rem]">
                De laatste website die jouw dierenbedrijf{" "}
                <span className="relative whitespace-nowrap text-brand">
                  ooit nodig heeft
                  <svg
                    className="absolute -bottom-1 left-0 h-2.5 w-full text-brand/30"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M0 5 Q 25 0 50 4 T 100 3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                .
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink-500">
                Je website, planning, klanten, betalingen en communicatie in{" "}
                <span className="font-semibold text-ink">één veilige omgeving</span>.
                Geen losse systemen, geen updates en geen technisch gedoe.{" "}
                <span className="font-semibold text-ink">Jij zorgt voor de dieren. DogWare zorgt voor de rest.</span>
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/demo" variant="primary" size="lg">
                  Laat mijn voorbeeld maken
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button href="#oplossing" variant="ghost" size="lg">
                  <PlayCircle className="h-5 w-5 text-brand" />
                  Bekijk DogWare voor mijn bedrijf
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-9">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Website",
                    "Planning",
                    "Klanten",
                    "Facturen",
                    "Agenda",
                    "Betalingen",
                    "E-mail",
                    "Klantportaal",
                  ].map((f) => (
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

              {/* Zwevende kaart: gebouwd door hondenmensen */}
              <div className="absolute -left-2 -bottom-5 hidden animate-float-slower rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink/5 sm:block">
                <a href="#verhaal" className="flex items-center gap-2.5">
                  <Avatar
                    file="henry-avatar.jpg"
                    alt="Henry van de Bovenkamp"
                    fallback="🐾"
                    position="object-[30%_center]"
                    className="h-9 w-9"
                  />
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
