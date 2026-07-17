import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui";

/**
 * Gedeelde schil voor juridische pagina's, in de DogWare-huisstijl.
 * De inhoud is een eerlijk concept op basis van de werkelijke implementatie;
 * plekken met [vierkante haken] moeten door DogWare zelf worden ingevuld en
 * bij voorkeur juridisch worden getoetst.
 */
export function LegalPage({
  titel,
  bijgewerkt,
  children,
}: {
  titel: string;
  bijgewerkt: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <section className="pt-28 pb-20 sm:pt-36">
          <Container className="max-w-2xl">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {titel}
            </h1>
            <p className="mt-2 text-[13px] text-ink-300">Laatst bijgewerkt: {bijgewerkt}</p>
            <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-600">
              {children}
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalSection({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-extrabold text-ink">{titel}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
