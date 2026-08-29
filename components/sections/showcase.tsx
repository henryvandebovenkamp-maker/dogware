"use client";

import Image from "next/image";
import { ArrowRight, ArrowUpRight, Globe } from "lucide-react";
import { Button, Container, SectionHeading } from "@/components/ui";
import { BrandMark } from "@/components/brand";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";
import { useBrancheContent } from "@/components/branche/branche-context";
import { demoHref } from "@/lib/branches";

/**
 * Bewijs in plaats van belofte: drie échte DogWare-bedrijven, elk met een
 * volstrekt eigen website.
 *
 * Deze sectie staat bewust direct na "Waarom DogWare" (`#verschil`), waar het
 * gesprek over websites wordt gevoerd. Daar zegt de pagina dat een gewone
 * website onderhoud vraagt en DogWare niet; hier laat hij zien wat je er dan
 * voor terugkrijgt — en dat het geen sjabloon met een ander logo is.
 *
 * Het is nadrukkelijk geen portfolio: geen beschrijvingen, geen casussen. Drie
 * previews, een naam, het soort bedrijf en een link. De previews zijn echte
 * schermafdrukken van de betreffende homepages (public/showcase); het
 * browserbalkje erboven maakt in één oogopslag duidelijk dat dit websites zijn
 * en toont het eigen domein.
 */

const SITES = [
  {
    naam: "Miss Molly",
    type: "Gedragstherapie & coaching",
    domein: "hondengedragsdeskundige-miss-molly.nl",
    href: "https://www.hondengedragsdeskundige-miss-molly.nl/",
    preview: "/showcase/miss-molly.jpg",
    alt: "Homepage van Miss Molly: een donkere sfeerfoto van een rennende hond in een korenveld met een serif-kop eroverheen.",
  },
  {
    naam: "A Doggy Business",
    type: "Uitlaatservice, hondenschool & oppas",
    domein: "adoggybusiness.nl",
    href: "https://www.adoggybusiness.nl",
    preview: "/showcase/a-doggy-business.jpg",
    alt: "Homepage van A Doggy Business: een lichte, strak getypografeerde pagina met een foto van een begeleidster met hond.",
  },
  {
    naam: "Spin & Kwispel",
    type: "Uitlaatservice, training & webshop",
    domein: "spinenkwispel.nl",
    href: "https://spinenkwispel.nl/",
    preview: "/showcase/spin-en-kwispel.jpg",
    alt: "Homepage van Spin & Kwispel: een groenblauwe pagina met roze accenten en een foto van een vrouw tussen twee honden.",
  },
];

/** Eén stap in het strookje "voorkant → DogWare → wat het regelt". */
function Stap({
  label,
  waarde,
  icon,
}: {
  label?: string;
  waarde: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5 text-center sm:text-left">
      {icon}
      <span className="min-w-0">
        {label && (
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-300">
            {label}
          </span>
        )}
        <span className="block text-pretty text-[13px] font-bold leading-snug text-ink">
          {waarde}
        </span>
      </span>
    </span>
  );
}

/** Wijst omlaag op mobiel (gestapeld) en opzij op een breed scherm. */
function Pijl() {
  return (
    <ArrowRight
      aria-hidden="true"
      className="h-4 w-4 shrink-0 rotate-90 text-brand sm:rotate-0"
    />
  );
}

export function Showcase({ branche }: { branche?: string }) {
  const c = useBrancheContent(branche);

  return (
    // Het anker waar "Voorbeelden" in de hoofdnavigatie naartoe wijst.
    <section id="voorbeelden" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="DogWare in de praktijk"
          title="Jouw bedrijf. Jouw uitstraling. Eén slim systeem erachter."
          intro="Geen standaard template met een ander logo. Iedere onderneming krijgt een website die past bij het eigen bedrijf. Daarachter regelt DogWare de planning, klanten, betalingen en automatisering."
        />

        {/* Mobiel een veegbare strook, vanaf lg drie kaarten naast elkaar. Zo
            blijft de pagina kort en worden de previews nooit postzegels.
            Scroll-snap is gewone CSS — hier komt geen carrouselbibliotheek aan
            te pas. */}
        {/* scroll-p is hier geen detail: zonder scroll-padding legt snap-start
            de kaart tegen de rand van de scrollbox en scrollt de strook de
            eigen padding weg — de eerste kaart plakt dan aan de schermrand. */}
        <RevealStagger className="-mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-p-5 px-5 pb-3 sm:-mx-8 sm:scroll-p-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:scroll-p-0 lg:px-0 lg:pb-0">
          {SITES.map((site) => (
            <RevealItem
              key={site.href}
              className="w-[78vw] shrink-0 snap-start sm:w-[46vw] lg:w-auto"
            >
              <a
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink/8 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
              >
                {/* Browserbalkje: maakt meteen duidelijk dat dit een website is */}
                <span className="flex items-center gap-2 border-b border-cream-200 bg-cream-100/70 px-3.5 py-2.5">
                  <span className="flex shrink-0 gap-1" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-ink/15" />
                    <span className="h-2 w-2 rounded-full bg-ink/15" />
                    <span className="h-2 w-2 rounded-full bg-ink/15" />
                  </span>
                  <span className="min-w-0 flex-1 truncate rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-300 ring-1 ring-ink/5">
                    {site.domein}
                  </span>
                </span>

                <span className="relative block aspect-[16/10] overflow-hidden bg-cream-100">
                  <Image
                    src={site.preview}
                    alt={site.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 46vw, 78vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </span>

                <span className="flex flex-1 items-center justify-between gap-3 px-4 py-4">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-extrabold tracking-tight text-ink">
                      {site.naam}
                    </span>
                    <span className="mt-0.5 block text-pretty text-[12px] leading-snug text-ink-500">
                      {site.type}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-brand">
                    Bekijk website
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </span>
              </a>
            </RevealItem>
          ))}
        </RevealStagger>

        {/* De kern in één regel: voorkant helemaal van hen, motor van DogWare. */}
        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 flex max-w-4xl flex-col items-center justify-center gap-3 rounded-3xl bg-cream px-5 py-6 ring-1 ring-ink/5 sm:flex-row sm:gap-5 sm:px-8">
            <Stap
              label="Voorkant"
              waarde="Helemaal jouw bedrijf"
              icon={
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-ink/5">
                  <Globe className="h-4 w-4" />
                </span>
              }
            />
            <Pijl />
            <Stap
              label="Daarachter"
              waarde="DogWare"
              icon={<BrandMark size={36} className="h-9 w-9 shrink-0" />}
            />
            <Pijl />
            <Stap waarde="Planning · klanten · betalingen · communicatie · automatisering" />
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-10 max-w-3xl text-balance text-center text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
            Drie verschillende bedrijven. Drie compleet eigen websites. Eén
            DogWare erachter.
          </p>
          <div className="mt-6 flex justify-center">
            <Button href={demoHref(c)} variant="primary" size="lg">
              Bekijk wat DogWare voor mijn bedrijf kan doen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
