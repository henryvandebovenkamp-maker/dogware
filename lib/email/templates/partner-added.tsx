import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Voor iemand die DogWare al kent: er is géén nieuw account gemaakt, de
 * partneromgeving is aan het bestaande account toegevoegd. Geen
 * activatielink, geen tweede wachtwoord — inloggen gaat zoals altijd.
 */
export function PartnerAddedEmail({
  naam,
  referralLink,
  portalUrl,
  opnieuw = false,
}: {
  naam: string;
  referralLink: string;
  portalUrl: string;
  opnieuw?: boolean;
}) {
  const voornaam = naam.split(" ")[0];
  return (
    <EmailLayout
      preview={`${voornaam}, je partneromgeving staat klaar in je bestaande DogWare-account`}
      heading={opnieuw ? `Hier is je link nog een keer, ${voornaam}` : `Je doet mee, ${voornaam}!`}
    >
      <Text style={paragraph}>
        Wat leuk dat je DogWare gaat aanbevelen. Je hebt al een DogWare-account
        en dat blijft gewoon zoals het is — ik heb de{" "}
        <span style={strong}>partneromgeving eraan toegevoegd</span>. Zelfde
        e-mailadres, zelfde manier van inloggen, alles wat je al had blijft
        staan.
      </Text>
      <Text style={paragraph}>Dit is jouw persoonlijke link:</Text>
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "14px 18px",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            color: emailColors.brand,
            fontSize: 15,
            fontWeight: 700,
            margin: 0,
            wordBreak: "break-all",
          }}
        >
          {referralLink}
        </Text>
      </Section>
      <Text style={paragraph}>
        Iedereen die via deze link een demo aanvraagt, wordt automatisch aan
        jou gekoppeld. De rest doe ik persoonlijk.
      </Text>
      <Section style={{ textAlign: "center", padding: "12px 0 4px" }}>
        <Button
          href={portalUrl}
          style={{
            backgroundColor: emailColors.ink,
            borderRadius: 999,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            padding: "12px 28px",
          }}
        >
          Open mijn partneromgeving
        </Button>
      </Section>
      <Text style={{ ...paragraph, fontSize: 12, margin: "16px 0 0" }}>
        Je logt in met {""}
        hetzelfde e-mailadres als altijd — je ontvangt dan een veilige
        inloglink. Er is geen nieuw wachtwoord en geen tweede account.
      </Text>
      <Signature
        groet="Hartelijke groet,"
        regel="Met dezelfde passie voor honden als jij."
      />
    </EmailLayout>
  );
}
