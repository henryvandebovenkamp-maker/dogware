import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacyverklaring",
  description:
    "Hoe DogWare omgaat met je persoonsgegevens: welke gegevens we verwerken, waarom, en welke rechten je hebt.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage titel="Privacyverklaring" bijgewerkt="17 juli 2026">
      <p className="rounded-xl bg-cream-100 px-4 py-3 text-[13px] text-ink-500">
        Dit is een eerlijke, op de werkelijke werking gebaseerde tekst. Vul de
        gemarkeerde bedrijfsgegevens aan en laat de tekst voor livegang
        juridisch toetsen.
      </p>

      <LegalSection titel="Wie zijn wij">
        <p>
          DogWare is een dienst van [officiële bedrijfsnaam], gevestigd te
          [adres], ingeschreven bij de KvK onder [KvK-nummer]. Voor vragen over
          privacy kun je mailen naar [privacy-e-mailadres].
        </p>
      </LegalSection>

      <LegalSection titel="Welke gegevens we verwerken">
        <p>Wij verwerken alleen wat nodig is voor onze dienstverlening:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Demo-aanvragen:</strong> naam, bedrijfsnaam, e-mailadres,
            telefoonnummer, plaats en de antwoorden die je zelf invult over je
            bedrijf.
          </li>
          <li>
            <strong>Partners:</strong> naam, e-mailadres en — als je die zelf
            invult — bedrijfs-, contact- en uitbetaalgegevens (IBAN/BIC). Je
            bank­gegevens slaan we versleuteld op en gebruiken we uitsluitend
            voor het uitbetalen van commissie.
          </li>
          <li>
            <strong>Accountgegevens:</strong> e-mailadres en inlogsessies. We
            werken wachtwoordloos; je logt in via een veilige e-maillink of code.
          </li>
          <li>
            <strong>Referralbezoeken:</strong> een anonieme bezoekers-id, de
            partnercode, tijdstip en beperkte technische gegevens, om een
            aanmelding aan de juiste partner te koppelen.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titel="Waarom en op welke grondslag">
        <p>
          We gebruiken je gegevens om je demo voor te bereiden, contact met je
          op te nemen, ons partnerprogramma uit te voeren en commissies uit te
          betalen. De grondslag is uitvoering van of aanloop naar een
          overeenkomst, en ons gerechtvaardigd belang om aanmeldingen correct
          aan partners toe te wijzen.
        </p>
      </LegalSection>

      <LegalSection titel="Wie je gegevens verwerkt namens ons">
        <p>
          We schakelen zorgvuldig gekozen dienstverleners in: Vercel en Neon
          (hosting en database, gegevens binnen de EU waar mogelijk) en Resend
          (e-mailverzending). Met deze partijen zijn of worden
          verwerkersovereenkomsten gesloten. We verkopen je gegevens nooit.
        </p>
      </LegalSection>

      <LegalSection titel="Hoe lang we gegevens bewaren">
        <p>
          Onvolledige concept-aanvragen bewaren we maximaal 30 dagen. Ingediende
          aanvragen en partnergegevens bewaren we zolang dat nodig is voor onze
          dienstverlening en wettelijke bewaarplichten, en daarna verwijderen of
          anonimiseren we ze.
        </p>
      </LegalSection>

      <LegalSection titel="Je rechten">
        <p>
          Je hebt recht op inzage, correctie, verwijdering, beperking en
          overdracht van je gegevens, en je kunt bezwaar maken. Stuur een mail
          naar [privacy-e-mailadres]. Je kunt ook een klacht indienen bij de
          Autoriteit Persoonsgegevens.
        </p>
      </LegalSection>

      <LegalSection titel="Beveiliging">
        <p>
          We nemen passende technische maatregelen. Zo werken we volledig
          wachtwoordloos, versleutelen we gevoelige gegevens zoals bank­rekeningen
          en verloopt alle communicatie via HTTPS.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
