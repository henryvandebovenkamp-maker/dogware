import Image from "next/image";
import { Check } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { photoExists } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/cn";

/**
 * Eén praktijkmoment: een foto uit het vak, met daaronder één klein
 * DogWare-bericht en ernaast een korte tekst.
 *
 * Deze component bestaat om drie keer op de homepage hetzelfde te doen op een
 * andere plek, in plaats van drie losse secties met kopieerwerk. De momenten
 * staan bewust ver uit elkaar en nooit naast elkaar: vier branchefoto's in één
 * blok leest als stockfotografie, verspreid door de pagina leest het als
 * herkenning.
 *
 * De foto's zijn exact 3:2 en het kader is dat ook. Daardoor wordt er níets
 * weggesneden — op geen enkele breedte — en blijven gezicht, hond en handeling
 * altijd volledig in beeld. Dat is hier belangrijker dan een modieuze uitsnede.
 *
 * Het berichtje staat onder de foto en niet erop. Dat was een bewuste correctie:
 * overlappend oogt mooier, maar bij de uitlaatservicefoto lopen er honden tot
 * aan de onderrand en dan valt zo'n kaartje daar overheen. Geen enkele hoek is
 * bij alle drie de foto's leeg, dus staat hij er nu netjes onder — en dekt hij
 * gegarandeerd nooit een gezicht of een hond af. Geen dashboardmockup: één
 * regel over wat DogWare op de achtergrond deed terwijl dit gebeurde.
 *
 * De sectie verdwijnt geruisloos zolang de foto ontbreekt, zodat er nooit een
 * lege plaatshouder op een live pagina staat.
 */
export function PraktijkMoment({
  foto,
  alt,
  eyebrow,
  titel,
  tekst,
  melding,
  spiegel = false,
}: {
  /** Bestandsnaam in /public/photos */
  foto: string;
  alt: string;
  eyebrow: string;
  titel: string;
  tekst: string;
  /** Het kleine DogWare-bericht onder de foto — houd het bij één handeling. */
  melding: { titel: string; detail: string };
  /** Foto rechts in plaats van links, zodat de momenten elkaar afwisselen. */
  spiegel?: boolean;
}) {
  if (!photoExists(foto)) return null;

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className={cn("flex flex-col", spiegel && "lg:order-2")}>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl shadow-soft ring-1 ring-ink/5">
              <Image
                src={`/photos/${foto}`}
                alt={alt}
                fill
                loading="lazy"
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-cover object-center"
              />
            </div>

            <div
              className={cn(
                // self-start, want een flex-kolom rekt zijn kinderen anders
                // over de volle breedte uit en dan is het geen chip meer.
                "mt-4 flex max-w-full items-center gap-2.5 self-start rounded-2xl bg-white px-3.5 py-2.5 shadow-lift ring-1 ring-ink/5",
                spiegel && "lg:self-end",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage">
                <Check className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold leading-tight text-ink">
                  {melding.titel}
                </span>
                <span className="block text-[11px] leading-tight text-ink-300">
                  {melding.detail}
                </span>
              </span>
            </div>
          </Reveal>

          <div className={cn(spiegel && "lg:order-1")}>
            <Reveal>
              <Eyebrow tone="sage">{eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 text-balance text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
                {titel}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-ink-500">
                {tekst}
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
