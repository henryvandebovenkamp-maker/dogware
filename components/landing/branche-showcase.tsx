import { Check } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import type { Branche } from "@/lib/branches";

/**
 * De branchegerichte foto met de drie belangrijkste beloften ernaast.
 *
 * Zolang de foto nog niet in /public/photos staat, toont het Photo-component
 * een placeholder met de bestandsnaam erin — zo is meteen duidelijk welke foto
 * er nog geplaatst moet worden.
 */
export function BrancheShowcase({ branche }: { branche: Branche }) {
  const punten = branche.results.slice(0, 3);

  return (
    <section className="bg-white py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <Reveal className="relative">
            <Photo
              file={branche.photo}
              alt={`${branche.naam} — ${branche.photoLabel}`}
              label={branche.photoLabel}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-[4/3] w-full"
            />
            <span className="absolute -bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-ink shadow-lift ring-1 ring-ink/5 sm:-left-3">
              <branche.icon className="h-4 w-4 text-brand" />
              Gemaakt voor {branche.meervoud}
            </span>
          </Reveal>

          <div className="flex flex-col items-start">
            <Reveal>
              <Eyebrow tone="sage">Speciaal voor jouw vak</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:leading-[1.1]">
                {branche.moduleTitel}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 max-w-lg text-pretty text-lg leading-relaxed text-ink-500">
                {branche.moduleDesc}
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <ul className="mt-8 space-y-4">
                {punten.map((p) => (
                  <li key={p.titel} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <span>
                      <span className="block text-[16px] font-bold text-ink">{p.titel}</span>
                      <span className="block text-[15px] leading-relaxed text-ink-500">
                        {p.tekst}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
