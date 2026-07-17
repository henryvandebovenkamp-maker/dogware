import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Algemene voorwaarden",
  description: "De voorwaarden voor het gebruik van DogWare en het partnerprogramma.",
  alternates: { canonical: "/voorwaarden" },
};

export default function VoorwaardenPage() {
  return (
    <LegalPage titel="Algemene voorwaarden" bijgewerkt="17 juli 2026">
      <p className="rounded-xl bg-cream-100 px-4 py-3 text-[13px] text-ink-500">
        Dit is een beknopt, eerlijk concept op basis van de huidige werking. Laat
        het vóór livegang aanvullen en juridisch toetsen, en vul de gemarkeerde
        bedrijfsgegevens aan.
      </p>

      <LegalSection titel="Over deze voorwaarden">
        <p>
          Deze voorwaarden gelden voor het gebruik van de website van DogWare,
          het aanvragen van een demo en deelname aan het partnerprogramma.
          DogWare is een dienst van [officiële bedrijfsnaam], KvK [KvK-nummer].
        </p>
      </LegalSection>

      <LegalSection titel="Demo-aanvragen">
        <p>
          Een demo-aanvraag is vrijblijvend en verplicht je tot niets. We
          gebruiken je gegevens om een persoonlijk voorbeeld voor je te maken en
          contact met je op te nemen. Aan een voorbeeld kunnen geen rechten
          worden ontleend.
        </p>
      </LegalSection>

      <LegalSection titel="Partnerprogramma">
        <p>
          Als partner ontvang je een persoonlijke link. Aanmeldingen die via jouw
          link binnenkomen, worden aan jou gekoppeld binnen de attributieperiode.
          De vergoeding per verkochte website spreken we vooraf met je af en
          wordt uitbetaald wanneer een aangebrachte klant daadwerkelijk klant
          wordt en de commissie beschikbaar komt. Misbruik van referrals
          (bijvoorbeeld nep-aanmeldingen) kan leiden tot beëindiging van het
          partnerschap.
        </p>
      </LegalSection>

      <LegalSection titel="Aansprakelijkheid">
        <p>
          We doen ons best de dienst zorgvuldig aan te bieden, maar kunnen niet
          garanderen dat de website altijd ononderbroken beschikbaar of foutvrij
          is. [Aanvullende aansprakelijkheidsbepalingen in te vullen door
          DogWare / juridisch adviseur.]
        </p>
      </LegalSection>

      <LegalSection titel="Contact">
        <p>Vragen over deze voorwaarden? Mail naar [contact-e-mailadres].</p>
      </LegalSection>
    </LegalPage>
  );
}
