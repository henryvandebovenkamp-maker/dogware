import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, paragraph, strong } from "./base";

/** Wachtwoordloze inlogmail: Magic Link + eenmalige Magic Code. */
export function MagicLoginEmail({
  naam,
  loginUrl,
  code,
  geldigMinuten,
}: {
  naam: string;
  loginUrl: string;
  code: string;
  geldigMinuten: number;
}) {
  // Code gespatieerd tonen: 482 917
  const nette = `${code.slice(0, 3)} ${code.slice(3)}`;

  return (
    <EmailLayout
      preview={`Je inlogcode is ${nette} — of log direct in met één klik`}
      heading={`Log veilig in, ${naam}`}
    >
      <Text style={paragraph}>
        Met één klik ben je binnen — zonder wachtwoord:
      </Text>
      <Section style={{ textAlign: "center", padding: "8px 0" }}>
        <Button
          href={loginUrl}
          style={{
            backgroundColor: emailColors.brand,
            borderRadius: 999,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            padding: "13px 32px",
          }}
        >
          Log veilig in bij DogWare
        </Button>
      </Section>

      <Text style={{ ...paragraph, margin: "14px 0 6px" }}>
        Open je deze mail op een ander apparaat? Gebruik dan deze eenmalige
        code:
      </Text>
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "16px",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            color: emailColors.ink,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "0.35em",
            margin: 0,
          }}
        >
          {nette}
        </Text>
      </Section>

      <Text style={{ ...paragraph, fontSize: 12, margin: "16px 0 0" }}>
        De link en code zijn <span style={strong}>{geldigMinuten} minuten</span>{" "}
        geldig en werken één keer. Heb jij dit niet aangevraagd? Dan kun je
        deze e-mail veilig negeren — er gebeurt niets.
      </Text>
    </EmailLayout>
  );
}
