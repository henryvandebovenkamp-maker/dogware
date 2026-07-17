import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, paragraph, strong } from "./base";

/** Uitnodiging voor het DogWare Partnerprogramma. */
export function PartnerInviteEmail({
  naam,
  inviteUrl,
  opnieuw = false,
}: {
  naam: string;
  inviteUrl: string;
  opnieuw?: boolean;
}) {
  return (
    <EmailLayout
      preview="Je bent uitgenodigd voor het DogWare Partnerprogramma"
      heading={
        opnieuw
          ? `Hier is je nieuwe uitnodiging, ${naam}`
          : `Welkom bij het Partnerprogramma, ${naam}!`
      }
    >
      <Text style={paragraph}>
        Je bent uitgenodigd voor het <span style={strong}>DogWare
        Partnerprogramma</span>. Als partner krijg je een persoonlijke link
        waarmee je hondenprofessionals kennis laat maken met DogWare — en je
        volgt in je eigen omgeving precies wat jouw aanbevelingen opleveren.
      </Text>
      <Text style={paragraph}>
        Bevestig je account met één klik — wachtwoorden zijn bij DogWare niet
        nodig; je logt voortaan in met een veilige link per e-mail:
      </Text>
      <Section style={{ textAlign: "center", padding: "12px 0 4px" }}>
        <Button
          href={inviteUrl}
          style={{
            backgroundColor: emailColors.brand,
            borderRadius: 999,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            padding: "12px 28px",
          }}
        >
          Activeer mijn partneraccount
        </Button>
      </Section>
      <Text style={{ ...paragraph, fontSize: 12, margin: "16px 0 0" }}>
        Deze link is 7 dagen geldig en werkt één keer.{" "}
        {opnieuw && "Eerdere uitnodigingslinks zijn hiermee vervallen. "}
        Verwachtte je deze uitnodiging niet? Dan kun je deze e-mail negeren.
      </Text>
    </EmailLayout>
  );
}
