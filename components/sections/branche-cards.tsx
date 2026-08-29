import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { photoExists } from "@/components/photo";
import { RevealStagger, RevealItem } from "@/components/reveal";
import { BRANCHES, BRANCHES_MET_ECHTE_FOTO } from "@/lib/branches";

/**
 * "Kies jouw branche" — de herkenningsingang.
 *
 * Iedere kaart leidt naar een volledige, branchespecifieke landingspagina
 * (/trimsalon-software, /hondenschool-software, …) met dezelfde huisstijl en
 * dezelfde componenten als deze homepage.
 *
 * Een kaart krijgt een sfeerbeeld zodra er échte fotografie voor die branche
 * ligt — juist hier moet iemand denken "dit is mijn werk". Welke dat zijn
 * staat in `BRANCHES_MET_ECHTE_FOTO`; de overige kaarten houden hun bestaande
 * vorm met alleen het icoon, zodat er nooit een tijdelijk merkvlak op de
 * voorpagina staat. Beide varianten staan probleemloos naast elkaar in
 * hetzelfde raster.
 */
export function BrancheCards() {
  return (
    <section id="branches" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Kies jouw branche"
          title="Wat voor bedrijf heb jij?"
          intro="DogWare is één platform, maar het werkt voor iedere branche net even anders. Kies wat bij je past en zie precies hoe het er voor jouw bedrijf uitziet."
        />

        <RevealStagger
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.05}
        >
          {BRANCHES.map((b) => {
            const metFoto =
              BRANCHES_MET_ECHTE_FOTO.includes(b.slug) && photoExists(b.photo);
            return (
              <RevealItem key={b.slug}>
                <Link
                  href={b.path}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl bg-cream ring-1 ring-ink/5 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lift hover:ring-brand/20"
                >
                  {metFoto && (
                    // Vaste, brede verhouding: de kaart wordt er nauwelijks
                    // hoger van en de rij blijft even hoog. Buiten beeld bij het
                    // laden van de pagina, dus bewust lui geladen.
                    <span className="relative block aspect-[16/9] w-full overflow-hidden bg-cream-100">
                      <Image
                        src={`/photos/${b.photo}`}
                        alt={b.photoLabel}
                        fill
                        loading="lazy"
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </span>
                  )}

                  <span className="flex flex-1 flex-col p-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <b.icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 text-xl font-extrabold tracking-tight text-ink">
                      {b.naam}
                    </h3>
                    <p className="mt-2 flex-1 text-pretty text-[15px] leading-relaxed text-ink-500">
                      {b.kaartTekst}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                      DogWare voor {b.meervoud}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </RevealItem>
            );
          })}
        </RevealStagger>

        <p className="mt-8 text-center text-[15px] text-ink-500">
          Staat jouw bedrijf er niet tussen?{" "}
          <Link
            href="/demo"
            className="font-bold text-brand hover:text-brand-600"
          >
            Vertel wat je doet
          </Link>{" "}
          — DogWare werkt voor ieder bedrijf dat met dieren werkt.
        </p>
      </Container>
    </section>
  );
}
