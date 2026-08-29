import Image from "next/image";
import { Container, Eyebrow } from "@/components/ui";
import { photoExists } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { PawPrint } from "lucide-react";

/**
 * De adempauze in het productblok.
 *
 * Tussen "Klant & hond", "Modules", "Webshop", "Betalingen", "Facturen" en het
 * teamportaal staan zes schermen achter elkaar over wat het systeem allemaal
 * kan. Deze sectie staat daar bewust middenin en zegt één keer waaróm dat
 * systeem bestaat: niet om meer functies te hebben, maar om iemand zijn dag
 * terug te geven.
 *
 * Bewust klein gehouden — py-16 in plaats van de gebruikelijke py-20/28, geen
 * kaart eromheen en geen call-to-action. Het is een rustpunt, geen extra hero.
 *
 * Het beeld ernaast is `rustig-moment.jpg`: gehurkt naast een ontspannen hond
 * in de avondzon. Die foto stond eerder in de fotostrip van het verhaalblok,
 * waar vijf van de zes foto's van de site bij elkaar zaten. Hier doet hij meer
 * werk — precies op het punt waar de pagina uitlegt waaróm dit systeem bestaat,
 * en verdeeld over de pagina in plaats van opgestapeld in één sectie.
 *
 * Ligt er later een foto die specifiek voor deze plek gemaakt is, zet die dan
 * neer als `meer-tijd.jpg`; die krijgt dan vanzelf voorrang. En ontbreken ze
 * allebei, dan staat de boodschap gewoon gecentreerd en oogt de sectie af — er
 * komt nooit een lege plaatshouder op een live pagina te staan.
 */
const FOTOS = ["meer-tijd.jpg", "rustig-moment.jpg"] as const;

export function MeerTijd() {
  const foto = FOTOS.find(photoExists);

  const tekst = (
    <div className={foto ? "" : "mx-auto max-w-3xl text-center"}>
      <Reveal>
        <Eyebrow tone="sage">
          <PawPrint className="h-3.5 w-3.5" />
          Waar je het uiteindelijk voor doet
        </Eyebrow>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-5 text-balance text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          Minder tijd kwijt aan regelen. Meer tijd voor het werk waarvoor je
          ooit bent begonnen.
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-ink-500">
          Planning, klanten, betalingen en facturen lopen vanzelf door. Jij
          hoeft er &apos;s avonds niet meer voor achter een scherm te kruipen —
          die uren gaan terug naar de honden en de mensen die bij je komen.
        </p>
      </Reveal>
    </div>
  );

  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      {/* Zachte gloed, dezelfde taal als de hero en het verhaalblok */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-sage-100/60 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-brand-100/50 blur-3xl" />
      </div>

      <Container>
        {foto ? (
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <Reveal>
              {/* Liggend op mobiel zodat het geen half scherm inneemt, iets
                  staander vanaf lg waar de ruimte er wel is. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-soft ring-1 ring-ink/5 sm:aspect-[16/10] lg:aspect-[5/4]">
                <Image
                  src={`/photos/${foto}`}
                  alt="Een hondenprofessional zit gehurkt naast een rustige hond in de avondzon"
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
            </Reveal>
            {tekst}
          </div>
        ) : (
          tekst
        )}
      </Container>
    </section>
  );
}
