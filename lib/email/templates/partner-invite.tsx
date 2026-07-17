import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Persoonlijke uitnodiging van Henry om samen DogWare te laten groeien.
 * Geen systeemmail, geen marketingtaal — warm en dankbaar.
 */
export function PartnerInviteEmail({
  naam,
  inviteUrl,
  opnieuw = false,
}: {
  naam: string;
  inviteUrl: string;
  opnieuw?: boolean;
}) {
  const voornaam = naam.split(" ")[0];
  return (
    <EmailLayout
      preview={`${voornaam}, wat leuk dat je mee wilt helpen DogWare te laten groeien`}
      heading={opnieuw ? `Hier is je nieuwe link, ${voornaam}` : `Wat leuk, ${voornaam}!`}
    >
      <Text style={paragraph}>
        Wat ontzettend leuk dat je mee wilt helpen om DogWare verder te laten
        groeien. Ik meen het: daar word ik echt blij van.
      </Text>
      <Text style={paragraph}>
        DogWare groeit het mooist via mensen die andere hondenondernemers
        kennen en gunnen dat hun bedrijf net zo soepel gaat lopen. Dat jij
        DogWare wilt aanbevelen, betekent veel voor me.
      </Text>
      <Text style={paragraph}>
        Zo simpel is het:
      </Text>
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "14px 20px",
          margin: "0 0 14px",
        }}
      >
        <Text style={{ ...paragraph, margin: "0 0 6px" }}>
          <span style={strong}>1.</span> Je deelt jouw persoonlijke link.
        </Text>
        <Text style={{ ...paragraph, margin: "0 0 6px" }}>
          <span style={strong}>2.</span> Wie interesse heeft, vraagt een demo aan.
        </Text>
        <Text style={{ ...paragraph, margin: 0 }}>
          <span style={strong}>3.</span> De rest doe ik persoonlijk. Iedereen
          die via jou binnenkomt wordt automatisch aan jou gekoppeld.
        </Text>
      </Section>
      <Text style={paragraph}>
        Activeer je plek met één klik. Je hebt geen wachtwoord nodig; voortaan log je
        in met een veilige link:
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
            padding: "13px 30px",
          }}
        >
          Ja, ik doe mee
        </Button>
      </Section>
      <Text style={{ ...paragraph, fontSize: 12, margin: "16px 0 0" }}>
        Deze link is 7 dagen geldig en werkt één keer.{" "}
        {opnieuw && "Je eerdere link is hiermee vervallen. "}
        Verwachtte je dit niet? Dan mag je deze mail rustig negeren.
      </Text>
      <Signature
        groet="Hartelijke groet,"
        regel="Met dezelfde passie voor honden als jij."
      />
    </EmailLayout>
  );
}
