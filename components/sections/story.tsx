import { Heart, PawPrint } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";

/** Het persoonlijke verhaal van Henry, oprichter van DogWare. */
export function Story() {
  return (
    <section id="verhaal" className="relative overflow-hidden py-20 sm:py-28">
      {/* Zachte achtergrondgloed, zelfde taal als de hero */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-24 h-72 w-72 rounded-full bg-sage-100/70 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-brand-100/60 blur-3xl" />
      </div>

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* Foto-collage */}
          <Reveal className="relative">
            <Photo
              file="henry-portret.jpg"
              alt="Henry van de Bovenkamp, neus aan neus met zijn hond"
              label="Henry, tussen de honden"
              position="object-left"
              className="aspect-[4/5] w-full max-w-md"
            />
            <Photo
              file="training-veld.jpg"
              alt="Training op het veld"
              label="Op het veld met de groep"
              tone="sage"
              sizes="240px"
              className="absolute -bottom-8 -right-2 hidden aspect-square w-44 rotate-2 shadow-lift sm:block lg:-right-8 lg:w-52"
            />
            {/* Accent-badge */}
            <span className="absolute -left-3 top-6 hidden animate-float-slow items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-ink shadow-lift ring-1 ring-ink/5 sm:inline-flex">
              <PawPrint className="h-4 w-4 text-brand" />
              Zelf uit de hondenbranche
            </span>
          </Reveal>

          {/* Verhaal */}
          <div className="flex flex-col items-start">
            <Reveal>
              <Eyebrow tone="sage">Het verhaal achter DogWare</Eyebrow>
            </Reveal>

            <Reveal delay={0.05}>
              <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:text-[2.7rem] md:leading-[1.08]">
                Ik sta zelf elke dag tussen de honden.
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-6 flex flex-col gap-4 text-pretty text-base leading-relaxed text-ink-500 sm:text-lg">
                <p>
                  Hoi, ik ben Henry. Ik heb een uitlaatservice in de regio
                  Utrecht en geef daarnaast hondentrainingen. Werken met honden
                  is nog steeds het leukste wat er is. Daar begon het voor mij,
                  en daar draait het nog altijd om.
                </p>
                <p>
                  Maar ergens onderweg merkte ik dat ik steeds meer tijd kwijt
                  was aan alles eromheen. Offertes maken, afspraken verzetten,
                  planningen omgooien, losse appjes beantwoorden, betalingen
                  nakijken. Voor ik het wist zat ik &apos;s avonds nog te
                  regelen in plaats van dat ik met de honden bezig was geweest.
                </p>
                <p>
                  En elke keer dacht ik hetzelfde: dit moet toch makkelijker
                  kunnen? Zo is DogWare ontstaan. Niet achter een bureau
                  bedacht, maar tussen de honden, uit precies de dingen waar ik
                  zelf dagelijks tegenaan liep.
                </p>
                <p>
                  Omdat ik zelf in de praktijk sta, weet ik waar jij mee
                  worstelt. Ik heb gebouwd wat ik zelf nodig had: één rustige
                  plek waar je bedrijf gewoon loopt, zodat jij weer tijd
                  overhoudt voor de honden.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <figure className="mt-8 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
                <blockquote className="text-pretty text-lg font-semibold leading-relaxed text-ink">
                  &ldquo;Ik gun geen enkele collega dat hun avonden opgaan aan
                  regelwerk. Die tijd hoort bij de honden. Of gewoon bij
                  jezelf.&rdquo;
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand">
                    <Heart className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink">
                      Henry van de Bovenkamp
                    </span>
                    <span className="block text-[13px] text-ink-500">
                      Oprichter van DogWare · uitlaatservice &amp; hondentrainer
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>

        {/* Fotostrip: het echte werk */}
        <div className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-3">
          {[
            {
              file: "rustig-moment.jpg",
              alt: "Rustig moment samen met een hond op het strand",
              label: "Even alle tijd voor één",
              tone: "warm" as const,
              delay: 0,
            },
            {
              file: "groep-buiten.jpg",
              alt: "In het bos met de hele groep honden",
              label: "Gewoon, buiten zijn",
              tone: "sage" as const,
              delay: 0.06,
            },
            {
              file: "blij-baasje.jpg",
              alt: "Een blij baasje samen onderweg met een hond",
              label: "Een blij baasje",
              tone: "warm" as const,
              delay: 0.12,
            },
          ].map((p) => (
            <Reveal key={p.file} delay={p.delay}>
              <Photo
                file={p.file}
                alt={p.alt}
                label={p.label}
                tone={p.tone}
                sizes="(min-width: 640px) 33vw, 100vw"
                className="aspect-[4/3] w-full transition-transform duration-300 hover:-translate-y-1"
              />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
