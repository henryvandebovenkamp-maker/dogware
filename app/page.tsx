import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BrancheSwitcher } from "@/components/branche/branche-switcher";
import { Hero } from "@/components/sections/hero";
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
import { TeamPortal } from "@/components/sections/team-portal";
import { Difference } from "@/components/sections/difference";
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
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <Hero />
        <BrancheSwitcher />
        <Problem />
        <Story />
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
        <TeamPortal />
        <Difference />
        <PromiseSection />
        <Results />
        <Testimonials />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
