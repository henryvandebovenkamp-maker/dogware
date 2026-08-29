import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { photoExists } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/cn";

/**
 * "Daar ben ik." — herkenning binnen de eerste schermen.
 *
 * Drie vakken in beeld, hoog op de pagina, zodat een bezoeker uit de branche
 * zichzelf tegenkomt vóórdat er ook maar iets over software is gezegd. Elk beeld
 * linkt door naar de landingspagina van dat vak, dus het is herkenning én een
 * ingang tegelijk.
 *
 * Bewust ongelijk opgezet: drie even grote blokken naast elkaar is precies de
 * indeling die als stockfotografie leest. De kolommen verschillen daarom in
 * breedte (4/5/3 van twaalf) en staan op verschillende hoogte. Dat het middelste
 * beeld het grootst is, is geen toeval — dat is het rustpunt van de rij.
 *
 * De naam van het vak staat ónder de foto en niet eroverheen: een tekstbalk over
 * een gezicht of een hond is precies wat een goede foto kapotmaakt.
 *
 * Op mobiel wordt het een veegbare strook in plaats van drie foto's onder
 * elkaar. Dat scheelt bijna twee schermen scrollen op de plek waar de bezoeker
 * nog moet beslissen of hij blijft.
 */
const VAKKEN = [
  {
    foto: "branche-hondenschool.jpg",
    alt: "Een hondentrainer oefent samen met een eigenaar en haar hond op het trainingsveld",
    naam: "Hondenschool",
    regel: "Cursussen, groepen en inschrijvingen.",
    path: "/hondenschool-software",
    kolom: "lg:col-span-4",
    hoogte: "lg:mt-10",
  },
  {
    foto: "branche-trimsalon.jpg",
    alt: "Een trimmer verzorgt rustig de vacht van een hond op de trimtafel",
    naam: "Trimsalon",
    regel: "Afspraken, klanten en betalingen.",
    path: "/trimsalon-software",
    kolom: "lg:col-span-5",
    hoogte: "",
  },
  {
    foto: "branche-dagopvang.jpg",
    alt: "Een verzorger begroet een hond op de buitenplaats van een dagopvang",
    naam: "Dagopvang",
    regel: "Boekingen, capaciteit en communicatie.",
    path: "/dagopvang-software",
    kolom: "lg:col-span-3",
    hoogte: "lg:mt-16",
  },
];

export function Herkenning() {
  const zichtbaar = VAKKEN.filter((v) => photoExists(v.foto));
  if (zichtbaar.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow tone="sage">Voor wie DogWare gemaakt is</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 text-balance text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
              Waarschijnlijk lijkt jouw dag hier het meest op.
            </h2>
          </Reveal>
        </div>

        {/* Mobiel een veegbare strook, vanaf lg een ongelijk raster.
            scroll-p is nodig, anders legt snap-start de eerste foto tegen de
            schermrand en scrollt de strook zijn eigen padding weg. */}
        <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-p-5 px-5 pb-2 sm:-mx-8 sm:scroll-p-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:overflow-visible lg:scroll-p-0 lg:px-0 lg:pb-0">
          {zichtbaar.map((v) => (
            <Reveal
              key={v.foto}
              className={cn(
                "w-[78vw] shrink-0 snap-start sm:w-[52vw] lg:w-auto",
                v.kolom,
                v.hoogte,
              )}
            >
              <Link href={v.path} className="group block">
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl ring-1 ring-ink/5">
                  <Image
                    src={`/photos/${v.foto}`}
                    alt={v.alt}
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 40vw, (min-width: 640px) 52vw, 78vw"
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <h3 className="text-lg font-extrabold tracking-tight text-ink">
                    {v.naam}
                  </h3>
                  <ArrowRight className="h-4 w-4 shrink-0 self-center text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
                </div>
                <p className="mt-0.5 text-pretty text-[14px] leading-relaxed text-ink-500">
                  {v.regel}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-[15px] text-ink-500">
            Ook voor pensions, gedragstherapeuten, chipservices en zorg aan
            huis.{" "}
            <Link
              href="/#branches"
              className="font-bold text-brand transition-colors hover:text-brand-600"
            >
              Bekijk alle hondenbedrijven
            </Link>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
