import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { AudienceStrip } from "@/components/sections/audience-strip";
import { Problem } from "@/components/sections/problem";
import { Story } from "@/components/sections/story";
import { Vision } from "@/components/sections/vision";
import { Solution } from "@/components/sections/solution";
import { Ecosystem } from "@/components/sections/ecosystem";
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

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex-1">
        <Hero />
        <AudienceStrip />
        <Problem />
        <Story />
        <Vision />
        <Solution />
        <Ecosystem />
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
