import type { Metadata } from "next";
import { CalendarRange, Layers, MessageCircleHeart } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container, Eyebrow, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { Faq } from "@/components/landing/faq";
import { MaandKosten, PrijsCta, PrijsKaart } from "@/components/sections/pricing";
import { absoluteUrl, branding } from "@/lib/branding";
import { MAX_TERMIJNEN_PUBLIEK, PLATFORM_PRIJS, TARIEVEN_FAQ } from "@/lib/tarieven";

const TITEL = "Tarieven";
const OMSCHRIJVING = `Een compleet DogWare-platform met website bouwen en inrichten kost ${PLATFORM_PRIJS.label}. Betalen kan in overleg in maximaal ${MAX_TERMIJNEN_PUBLIEK} termijnen. De maandelijkse kosten staan vooraf in je persoonlijke voorstel.`;

export const metadata: Metadata = {
  title: `${TITEL} — wat kost DogWare?`,
  description: OMSCHRIJVING,
  alternates: { canonical: "/tarieven" },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: absoluteUrl("/tarieven"),
    siteName: branding.name,
    title: `Wat kost DogWare? — ${branding.name}`,
    description: OMSCHRIJVING,
  },
  twitter: {
    card: "summary_large_image",
    title: `Wat kost DogWare? — ${branding.name}`,
    description: OMSCHRIJVING,
  },
};

/**
 * De tarievenpagina. Geen verkooppraat: het bedrag, wat erin zit, hoe je het
 * kunt spreiden, hoe de maandelijkse kosten werken en waarom daar geen vast
 * bedrag bij staat. Dezelfde bouwstenen als de prijssectie op de homepage.
 */
export default function TarievenPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${branding.name}-platform bouwen en inrichten`,
      serviceType: "Website en bedrijfsplatform voor hondenprofessionals",
      description: OMSCHRIJVING,
      url: absoluteUrl("/tarieven"),
      areaServed: { "@type": "Country", name: "Nederland" },
      provider: { "@type": "Organization", name: branding.name, url: branding.siteUrl },
      // Alleen de vaste, eenmalige prijs. De maandelijkse kosten verschillen
      // per bedrijf en staan daarom bewust niet in de structured data.
      offers: {
        "@type": "Offer",
        price: PLATFORM_PRIJS.bedrag,
        priceCurrency: PLATFORM_PRIJS.valuta,
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/tarieven"),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: branding.name, item: branding.siteUrl },
        { "@type": "ListItem", position: 2, name: TITEL, item: absoluteUrl("/tarieven") },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: TARIEVEN_FAQ.map((f) => ({
        "@type": "Question",
        name: f.v,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="relative z-10 flex-1">
        {/* 1–2. Het bedrag en wat erin zit */}
        <section className="relative overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-36">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-20 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-brand-100/50 blur-3xl" />
          </div>
          <Container>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
              <Eyebrow>Helder over de investering</Eyebrow>
              <h1 className="text-balance text-4xl font-extrabold tracking-tight text-ink sm:text-5xl md:text-[3.4rem] md:leading-[1.05]">
                Wat kost DogWare?
              </h1>
              <p className="max-w-2xl text-pretty text-base leading-relaxed text-ink-500 sm:text-lg">
                Eén bedrag voor je complete platform, de mogelijkheid om het te spreiden, en de
                maandelijkse kosten vooraf zwart op wit. Zo weet je precies waar je aan toe bent
                voordat je klant wordt.
              </p>
            </div>
            <Reveal className="mx-auto mt-12 max-w-5xl">
              <PrijsKaart />
            </Reveal>
          </Container>
        </section>

        {/* 3. Termijnen — 4. maandkosten — 5. waarom geen standaardabonnement */}
        <section className="bg-white py-20 sm:py-24">
          <Container>
            <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
              <Reveal>
                <Blok
                  icon={<CalendarRange className="h-6 w-6" />}
                  tint="sage"
                  titel={`Betalen in maximaal ${MAX_TERMIJNEN_PUBLIEK} termijnen`}
                >
                  <p>
                    De investering van {PLATFORM_PRIJS.label} hoeft niet in één keer. In overleg
                    verdelen we het bedrag over maximaal {MAX_TERMIJNEN_PUBLIEK} termijnen.
                  </p>
                  <p>
                    Dat is gewoon een betaalafspraak tussen jou en ons, geen lening of
                    financiering. We maken hem persoonlijk en hij staat in je voorstel.
                  </p>
                </Blok>
              </Reveal>
              <Reveal delay={0.05}>
                <Blok
                  icon={<Layers className="h-6 w-6" />}
                  tint="brand"
                  titel="Waarom geen standaard maandabonnement?"
                >
                  <p>
                    Omdat niet ieder hondenbedrijf dezelfde onderdelen gebruikt. Een hondenschool
                    heeft andere dingen nodig dan een trimsalon, een uitlaatservice of een
                    hondenpension.
                  </p>
                  <p>
                    Een standaardpakket betekent al snel betalen voor wat je niet gebruikt. Wij
                    spreken liever vooraf een bedrag af dat past bij hoe jij werkt.
                  </p>
                </Blok>
              </Reveal>
            </div>
            <Reveal delay={0.1} className="mx-auto mt-5 max-w-5xl">
              <MaandKosten />
            </Reveal>
          </Container>
        </section>

        {/* 6. Persoonlijk voorstel */}
        <section className="py-20 sm:py-24">
          <Container>
            <SectionHeading
              eyebrow="Jouw persoonlijke voorstel"
              eyebrowTone="sage"
              title="Eerst zien, dan beslissen."
              intro="Vertel in een paar minuten iets over je bedrijf. Je krijgt een kosteloos voorbeeld van jouw eigen omgeving en daarna een persoonlijk voorstel met de investering, de betaalafspraak en de maandelijkse kosten."
            />
            <div className="mt-10">
              <PrijsCta secundair={{ href: "/#oplossingen", label: "Bekijk wat DogWare voor mij kan doen" }} />
            </div>
            <p className="mx-auto mt-8 flex max-w-lg items-center justify-center gap-2 text-center text-[14px] text-ink-500">
              <MessageCircleHeart className="h-4 w-4 shrink-0 text-brand" />
              <span>
                Liever eerst even bellen? Henry is bereikbaar op{" "}
                <a href={`tel:${branding.phoneTel}`} className="font-bold text-ink hover:text-brand">
                  {branding.phone}
                </a>
                .
              </span>
            </p>
          </Container>
        </section>

        {/* 7. Veelgestelde vragen */}
        <Faq items={TARIEVEN_FAQ} titel="Vragen over de tarieven" />
      </main>
      <SiteFooter />
    </>
  );
}

function Blok({
  icon,
  tint,
  titel,
  children,
}: {
  icon: React.ReactNode;
  tint: "brand" | "sage";
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-3xl bg-cream p-7 ring-1 ring-ink/5 sm:p-8">
      <span
        className={
          tint === "sage"
            ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-sage-600"
            : "flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand"
        }
      >
        {icon}
      </span>
      <h2 className="mt-5 text-xl font-extrabold tracking-tight text-ink">{titel}</h2>
      <div className="mt-3 space-y-3 text-pretty text-[15px] leading-relaxed text-ink-500">{children}</div>
    </div>
  );
}
