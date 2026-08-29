import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BrancheSwitcher } from "@/components/branche/branche-switcher";
import { Hero } from "@/components/sections/hero";
import { KozenVoorHonden } from "@/components/sections/kozen-voor-honden";
import { Herkenning } from "@/components/sections/herkenning";
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
import { PromiseSection } from "@/components/sections/promise";
import { Results } from "@/components/sections/results";
import { Testimonials } from "@/components/sections/testimonials";
import { FinalCta } from "@/components/sections/final-cta";

/**
 * De homepage vertelt eerst waaróm iemand DogWare zou willen, en pas daarna wat
 * het doet.
 *
 * De bovenkant liep eerder van software naar functionaliteit naar meer
 * functionaliteit; een mens kwam pas ver naar beneden in beeld. Dat is te laat
 * voor advertentieverkeer, waar iemand DogWare nog helemaal niet kent. De
 * volgorde is daarom: het vak (KozenVoorHonden), jezelf herkennen
 * (BrancheSwitcher en Herkenning), en daarna pas het probleem, de oplossing en
 * het platform.
 *
 * Twee ingangen blijven bestaan: herkenning ("ik heb een trimsalon") via de
 * branchekiezer en de branchekaarten, en behoefte ("ik wil minder
 * administratie") via het oplossingenblok. Een keuze in de branchekiezer laat
 * de secties eronder meebewegen, zonder de pagina te herladen — de hero niet,
 * die blijft altijd voor het hele vak spreken.
 *
 * Het verhaal van Henry (`#verhaal`) staat bewust helemaal onderaan, vlak voor
 * de demo-aanvraag: wie tot daar is gekomen, wil weten wie er achter dit ding
 * zit voordat hij zijn gegevens achterlaat. FounderNote hoog op de pagina is de
 * korte brug ernaartoe.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <Hero />
        <KozenVoorHonden />
        <BrancheSwitcher />
        <Herkenning />
        <FounderNote />
        <Problem />
        <Vision />
        <Solution />
        <Ecosystem />
        <BrancheCards />
        <NeedCards />
        <ClientDog />
        <Modules />
        <Webshop />
        <Payments />
        <Invoicing />
        <MeerTijd />
        <TeamPortal />
        <Difference />
        <Showcase />
        <PromiseSection />
        <Results />
        <Testimonials />
        <Story />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
