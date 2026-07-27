import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui";
import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { Solution } from "@/components/sections/solution";
import { Modules } from "@/components/sections/modules";
import { Payments } from "@/components/sections/payments";
import { Difference } from "@/components/sections/difference";
import { Results } from "@/components/sections/results";
import { Testimonials } from "@/components/sections/testimonials";
import { Story } from "@/components/sections/story";
import { FinalCta } from "@/components/sections/final-cta";
import { BrancheShowcase } from "@/components/landing/branche-showcase";
import { CrossLinks } from "@/components/landing/cross-links";
import { Faq } from "@/components/landing/faq";
import type { Branche } from "@/lib/branches";

/**
 * De branchespecifieke landingspagina. Geen losse website: exact dezelfde
 * componenten als de homepage, alleen vastgezet op één branche via de
 * `branche`-prop. Zo blijven huisstijl, gedrag en onderhoud gedeeld.
 */
export function BranchePage({ branche }: { branche: Branche }) {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <Hero branche={branche.slug} />

        {/* Kruimelpad — ook voor zoekmachines de plek in de structuur */}
        <nav
          aria-label="Kruimelpad"
          className="border-y border-cream-200 bg-white/50 py-4"
        >
          <Container>
            <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-300">
              <li>
                <Link href="/" className="font-semibold transition-colors hover:text-ink">
                  DogWare
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <li>
                <Link
                  href="/#branches"
                  className="font-semibold transition-colors hover:text-ink"
                >
                  Branches
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <li aria-current="page" className="font-bold text-ink-700">
                Software voor {branche.meervoud}
              </li>
            </ol>
          </Container>
        </nav>

        <Problem branche={branche.slug} />
        <BrancheShowcase branche={branche} />
        <Solution branche={branche.slug} />
        <Modules branche={branche.slug} />
        <Payments />
        <Difference />
        <Results branche={branche.slug} />
        <Testimonials branche={branche.slug} />
        <Story />
        <Faq
          items={branche.faq}
          titel={`Vragen over DogWare voor jouw ${branche.naamKlein}`}
        />
        <FinalCta branche={branche.slug} />
        <CrossLinks exclude={branche.slug} />
      </main>
      <SiteFooter />
    </>
  );
}
