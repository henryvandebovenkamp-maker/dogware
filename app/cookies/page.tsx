import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { REFERRAL_WINDOW_DAYS } from "@/lib/referral-config";

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
            wordt toegewezen. Hij wordt geplaatst op het moment dat je een
            partnerlink opent, bevat uitsluitend een anonieme verwijzing naar
            die partner (geen naam, e-mailadres of ander gegeven over jou) en is
            alleen door onze server te lezen. Geldig tot {REFERRAL_WINDOW_DAYS}{" "}
            dagen na dat eerste bezoek; herhaalde bezoeken verlengen dat niet.
          </li>
          <li>
            <strong>Bezoekersaanduiding</strong> — een willekeurig nummer waarmee
            we herhaalde klikken op dezelfde partnerlink als één bezoek tellen.
            Niet herleidbaar tot jou als persoon.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titel="Beheer">
        <p>
          Je kunt cookies altijd verwijderen via de instellingen van je browser.
          Zonder de functionele cookies werkt inloggen of de partnerkoppeling
          mogelijk niet correct.
        </p>
        <p>
          Heb je al een demo aangevraagd, dan is de partner waarlangs je
          binnenkwam bij die aanvraag vastgelegd. Het verwijderen van je cookies
          verandert daar niets meer aan; die gegevens vallen onder de bewaartermijn
          in onze privacyverklaring.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
