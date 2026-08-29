import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MessageCircleHeart, PawPrint, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container, Eyebrow } from "@/components/ui";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { ContactForm } from "@/components/contact/contact-form";
import { absoluteUrl, branding } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Een vraag over DogWare, of gewoon even overleggen of het bij jouw hondenbedrijf past? Je bericht komt rechtstreeks bij Henry van de Bovenkamp binnen.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: absoluteUrl("/contact"),
    siteName: branding.name,
    title: `Contact · ${branding.name}`,
    description:
      "Stuur Henry gerust een bericht. Je krijgt gewoon antwoord van hem — geen helpdesk, geen ticketnummer.",
  },
};

/**
 * De contactpagina. Bewust géén anoniem SaaS-formulier: links staat de persoon
 * met wie je te maken krijgt, rechts het formulier. Telefoonnummer en
 * e-mailadres komen uit lib/branding.ts, zodat ze op één plek te wijzigen zijn
 * en overal (footer, mails, deze pagina) gelijk blijven.
 */
export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <section className="relative overflow-hidden pb-20 pt-28 sm:pb-24 sm:pt-36">
          {/* Zelfde zachte gloed als de hero en het verhaalblok */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-100 via-cream-100 to-sage-100 opacity-70 blur-3xl" />
          </div>

          <Container>
            <div className="max-w-2xl">
              <Reveal>
                <Eyebrow tone="sage">
                  <MessageCircleHeart className="h-3.5 w-3.5" />
                  Contact
                </Eyebrow>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
                  Even kennismaken?
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-5 text-pretty text-lg leading-relaxed text-ink-500">
                  Heb je een vraag over DogWare of wil je gewoon even bespreken
                  of het bij jouw bedrijf past? Stuur me gerust een bericht.{" "}
                  <span className="font-semibold text-ink">
                    Je krijgt gewoon antwoord van mij.
                  </span>
                </p>
              </Reveal>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
              {/* Wie je aan de lijn krijgt */}
              <Reveal>
                <div className="flex flex-col gap-6">
                  {/* Mobiel: klein portret naast de naam, zodat het formulier
                      en de belknop binnen handbereik blijven. Vanaf lg krijgt
                      het portret de ruimte die het op een groot scherm mag
                      hebben. */}
                  <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
                    <Photo
                      file="henry-portret.jpg"
                      alt="Henry van de Bovenkamp, neus aan neus met zijn hond"
                      label="Henry, tussen de honden"
                      position="object-left"
                      sizes="(min-width: 1024px) 260px, 120px"
                      priority
                      className="aspect-[4/5] w-24 shrink-0 sm:w-28 lg:w-full lg:max-w-[16rem]"
                    />

                    <div className="min-w-0">
                      <p className="text-lg font-extrabold tracking-tight text-ink">
                        Henry van de Bovenkamp
                      </p>
                      <p className="mt-0.5 text-[14px] text-ink-500">
                        Oprichter van DogWare · uitlaatservice &amp; hondentrainer
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-col gap-2.5">
                      <a
                        href={`mailto:${branding.contactEmail}`}
                        className="group inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand">
                          <Mail className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold text-ink-300">
                            Mail me
                          </span>
                          <span className="block truncate text-[14px] font-bold text-ink">
                            {branding.contactEmail}
                          </span>
                        </span>
                      </a>

                      <a
                        href={`tel:${branding.phoneTel}`}
                        className="group inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage">
                          <Phone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold text-ink-300">
                            Bel of app me
                          </span>
                          <span className="block truncate text-[14px] font-bold text-ink">
                            {branding.phone}
                          </span>
                        </span>
                      </a>
                    </div>

                    <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
                      {branding.responseTime}. Sta ik tussen de honden, dan hoor
                      je zodra ik de riem heb opgehangen.
                    </p>

                    <Link
                      href="/#verhaal"
                      className="group mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand transition-colors hover:text-brand-600"
                    >
                      <PawPrint className="h-4 w-4" />
                      Lees het verhaal achter DogWare
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </Reveal>

              {/* Het formulier */}
              <Reveal delay={0.08}>
                <ContactForm />

                <p className="mt-5 text-pretty text-[14px] leading-relaxed text-ink-500">
                  Liever meteen zien wat DogWare voor jouw bedrijf doet?{" "}
                  <Link
                    href="/demo"
                    className="font-bold text-brand transition-colors hover:text-brand-600"
                  >
                    Vraag een kosteloos voorbeeld aan
                  </Link>{" "}
                  — geen offerte, je zit nergens aan vast.
                </p>
              </Reveal>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
