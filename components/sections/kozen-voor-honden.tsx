import Image from "next/image";
import { Check } from "lucide-react";
import { Container } from "@/components/ui";
import { photoExists } from "@/components/photo";
import { Reveal } from "@/components/reveal";

/**
 * Het eerste dat na de hero komt — en bewust géén uitleg.
 *
 * De bovenkant van de pagina liep eerder van software naar functionaliteit naar
 * meer functionaliteit, en pas ver daarna kwam er een mens in beeld. Voor
 * advertentieverkeer is dat te laat: iemand die DogWare niet kent moet binnen
 * een paar seconden voelen dat dit voor zijn soort bedrijf is gemaakt. Daarom
 * staat hier meteen het vak zelf, groot, met de reden waarom het systeem
 * bestaat ernaast.
 *
 * De foto zit niet in een witte kaart en heeft geen verloop of badge eroverheen:
 * gewoon een foto, met een zachte hoek in dezelfde taal als de rest. De drie
 * regels ernaast zijn de enige interface die je ziet — klein, en naast het beeld
 * in plaats van erop, zodat er niets over een gezicht of een hond valt.
 *
 * Dit is de enige foto boven de vouw, dus hij laadt met voorrang: een beeld dat
 * pas na een halve seconde inploft doet precies het tegenovergestelde van wat
 * deze sectie moet doen.
 */
const FOTO = "branche-uitlaatservice.jpg";

const DOET_DOGWARE = [
  "Betaling ontvangen",
  "Bevestiging verstuurd",
  "Planning bijgewerkt",
];

export function KozenVoorHonden() {
  if (!photoExists(FOTO)) return null;

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <Container>
        {/* De foto krijgt bewust de grootste helft: dit is het eerste beeld dat
            iemand van het vak ziet en het mag geen bijlage bij de tekst zijn. */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
          <Reveal>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[2rem] ring-1 ring-ink/5">
              <Image
                src={`/photos/${FOTO}`}
                alt="Een hondenuitlaatservice loopt met een rustige groep honden over de heide"
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-center"
              />
            </div>
          </Reveal>

          <div>
            <Reveal>
              <h2 className="text-balance text-3xl font-extrabold leading-[1.15] tracking-tight text-ink sm:text-4xl md:text-[2.6rem]">
                Jij koos voor werken met honden.
                <span className="mt-1 block text-ink-500">
                  Niet voor avonden vol administratie.
                </span>
              </h2>
            </Reveal>

            <Reveal delay={0.05}>
              <p className="mt-6 text-pretty text-lg leading-relaxed text-ink-500">
                DogWare regelt je website, planning, klanten, betalingen en
                communicatie. Zodat jij meer tijd overhoudt voor je bedrijf, je
                klanten en vooral de honden.
              </p>
            </Reveal>

            {/* Wat er ondertussen gebeurde. Bewust drie kale regels en geen
                kaartjes: het is een terzijde, niet een tweede feature-blok. */}
            <Reveal delay={0.1}>
              <ul className="mt-7 flex flex-col gap-2.5">
                {DOET_DOGWARE.map((regel) => (
                  <li
                    key={regel}
                    className="flex items-center gap-2.5 text-[15px] font-semibold text-ink-700"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage">
                      <Check className="h-3 w-3" />
                    </span>
                    {regel}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mt-6 text-[15px] font-semibold text-ink-300">
                Terwijl jij buiten was.
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
