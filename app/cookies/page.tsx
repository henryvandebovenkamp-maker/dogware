import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Welke cookies DogWare gebruikt en waarvoor.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage titel="Cookies" bijgewerkt="17 juli 2026">
      <p className="rounded-xl bg-cream-100 px-4 py-3 text-[13px] text-ink-500">
        Dit overzicht beschrijft de cookies zoals de site die nu daadwerkelijk
        gebruikt. Laat het voor livegang juridisch toetsen.
      </p>

      <LegalSection titel="Alleen functionele cookies">
        <p>
          DogWare gebruikt op dit moment uitsluitend functionele, first-party
          cookies die nodig zijn om de dienst te laten werken. We gebruiken
          (nog) geen advertentie- of externe trackingcookies.
        </p>
      </LegalSection>

      <LegalSection titel="Welke cookies">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Inlogsessie</strong> — houdt je veilig ingelogd nadat je via
            een e-maillink bent binnengekomen. Vervalt automatisch.
          </li>
          <li>
            <strong>Referralkoppeling</strong> — onthoudt via welke partner je
            binnenkwam, zodat een latere demo-aanvraag aan de juiste partner
            wordt toegewezen. Bevat een anonieme verwijzing, geldig gedurende de
            attributieperiode (standaard 30 dagen).
          </li>
        </ul>
      </LegalSection>

      <LegalSection titel="Beheer">
        <p>
          Je kunt cookies altijd verwijderen via de instellingen van je browser.
          Zonder de functionele cookies werkt inloggen of de partnerkoppeling
          mogelijk niet correct.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
