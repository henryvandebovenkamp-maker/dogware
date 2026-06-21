import { Container } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const TIME_SINKS = [
  "Agenda's",
  "Facturen",
  "Planning",
  "WhatsApp",
  "E-mails",
  "Losse software",
];

export function Vision() {
  return (
    <section className="relative overflow-hidden bg-ink py-20 text-cream sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-0 opacity-60">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sage/20 blur-3xl" />
      </div>
      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream/80 ring-1 ring-white/15">
              De visie
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.7rem] md:leading-[1.1]">
              Jouw bedrijf moet draaien om honden.
              <br />
              <span className="text-brand-400">Niet om administratie.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-cream/70">
              Elke minuut die je kwijt bent aan losse systemen, is een minuut die
              je niet kunt besteden aan jouw klanten en hun honden.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-wrap justify-center gap-2.5">
              {TIME_SINKS.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-cream/60 line-through decoration-brand/60 decoration-2 ring-1 ring-white/10"
                >
                  {s}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-9 text-xl font-bold text-cream sm:text-2xl">
              DogWare geeft je die tijd terug.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
