import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BrancheSwitcher } from "@/components/branche/branche-switcher";
import { Hero } from "@/components/sections/hero";
import { FounderNote } from "@/components/sections/founder-note";
import { Problem } from "@/components/sections/problem";
import { Story } from "@/components/sections/story";
import { Vision } from "@/components/sections/vision";
import { Solution } from "@/components/sections/solution";
import { Ecosystem } from "@/components/sections/ecosystem";
import { BrancheCards } from "@/components/sections/branche-cards";
import { NeedCards } from "@/components/sections/need-cards";
import { ClientDog } from "@/components/sections/client-dog";
import { Modules } from "@/components/sections/modules";
import { Webshop } from "@/components/sections/webshop";
import { Payments } from "@/components/sections/payments";
import { Invoicing } from "@/components/sections/invoicing";
import { MeerTijd } from "@/components/sections/meer-tijd";
import { TeamPortal } from "@/components/sections/team-portal";
import { Difference } from "@/components/sections/difference";
import { Showcase } from "@/components/sections/showcase";
import { PraktijkMoment } from "@/components/sections/praktijk-moment";
import { PromiseSection } from "@/components/sections/promise";
import { Results } from "@/components/sections/results";
import { Testimonials } from "@/components/sections/testimonials";
import { FinalCta } from "@/components/sections/final-cta";

/**
 * De homepage kent twee ingangen: herkenning ("ik heb een trimsalon") via de
 * branchekiezer en de branchekaarten, en behoefte ("ik wil minder
 * administratie") via het oplossingenblok. Een keuze in de branchekiezer laat
 * hero, problem, solution, modules, results, testimonials en de CTA meebewegen,
 * zonder de pagina te herladen.
 *
 * Direct onder de branchekiezer staat een piepklein vertrouwenssignaal
 * (FounderNote): wie zit er achter DogWare. Het volledige verhaal blijft waar
 * het stond (Story, `#verhaal`); FounderNote is alleen de brug ernaartoe.
 *
 * Showcase staat direct na Difference (`#verschil`): daar gaat het gesprek
 * over websites, en daar hoort het bewijs — drie echte klanten met drie
 * volstrekt eigen sites — dus vlak voor de belofte en de afsluiting.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <Hero />
        <BrancheSwitcher />
        <FounderNote />
        <Problem />
        <Story />
        <Vision />
        <Solution />
        <PraktijkMoment
          foto="branche-trimsalon.jpg"
          alt="Een trimmer verzorgt rustig de vacht van een hond op de trimtafel"
          eyebrow="In de praktijk"
          titel="Een afspraak die zichzelf inplant."
          tekst="Terwijl jij met je handen in een vacht zit, boekt de volgende klant online een plek, krijgt hij een bevestiging en staat de afspraak al in je agenda."
          melding={{ titel: "Nieuwe afspraak", detail: "Dinsdag 10:30 · automatisch bevestigd" }}
        />
        <Ecosystem />
        <BrancheCards />
        <NeedCards />
        <PraktijkMoment
          foto="branche-hondenschool.jpg"
          alt="Een hondentrainer oefent samen met een eigenaar en haar hond op het veld"
          eyebrow="In de praktijk"
          titel="Jij geeft les. De administratie loopt vanzelf mee."
          tekst="Cursisten kiezen zelf hun groep, vullen de gegevens van hun hond in en betalen direct. Jij ziet alleen nog wie er komt."
          melding={{ titel: "Cursus volgeboekt", detail: "8 van 8 plekken · betaald met iDEAL" }}
          spiegel
        />
        <ClientDog />
        <Modules />
        <Webshop />
        <Payments />
        <Invoicing />
        <MeerTijd />
        <TeamPortal />
        <Difference />
        <PraktijkMoment
          foto="branche-uitlaatservice.jpg"
          alt="Een uitlaatservice onderweg met een rustige groep honden over de heide"
          eyebrow="In de praktijk"
          titel="Buiten zijn, terwijl morgen al geregeld is."
          tekst="Routes, groepen en capaciteit staan klaar voordat je de bus instapt. Klanten geven zelf hun dagen door, de facturatie loopt door zonder dat je eraan denkt."
          melding={{ titel: "Planning voor morgen staat klaar", detail: "8 wandelingen · routes gepland" }}
        />
        <Showcase />
        <PromiseSection />
        <Results />
        <Testimonials />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
