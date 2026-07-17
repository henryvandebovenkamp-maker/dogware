import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Warme, persoonlijke mail wanneer de voorbeeldwebsite klaarstaat.
 * Passwordless: de klant logt in via de meegestuurde magic link.
 */
export function DemoReadyEmail({
  naam,
  bedrijfsnaam,
  demoUrl,
  loginUrl,
}: {
  naam: string;
  bedrijfsnaam: string;
  demoUrl?: string;
  loginUrl: string;
}) {
  return (
    <EmailLayout
      preview={`Je persoonlijke DogWare-voorbeeld voor ${bedrijfsnaam} staat klaar`}
      heading={`Het staat klaar, ${naam}!`}
    >
      <Text style={paragraph}>
        Wat leuk dat je een demo aanvroeg voor{" "}
        <span style={strong}>{bedrijfsnaam}</span>. Ik heb er geen standaard
        presentatie van gemaakt, maar een <span style={strong}>voorbeeld dat
        past bij jouw bedrijf</span> — helemaal klaar om te bekijken.
      </Text>

      {demoUrl && (
        <Section style={{ textAlign: "center", padding: "8px 0" }}>
          <Button
            href={demoUrl}
            style={{
              backgroundColor: emailColors.brand,
              borderRadius: 999,
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              padding: "13px 32px",
            }}
          >
            Bekijk jouw voorbeeldwebsite
          </Button>
        </Section>
      )}

      <Text style={paragraph}>
        Je kunt zowel de <span style={strong}>website</span> bekijken als een
        kijkje nemen in de <span style={strong}>beheeromgeving</span>, zodat je
        precies ziet hoe het straks voor jou werkt. Inloggen kan zonder
        wachtwoord — met één klik:
      </Text>
      <Section style={{ textAlign: "center", padding: "8px 0" }}>
        <Button
          href={loginUrl}
          style={{
            backgroundColor: emailColors.ink,
            borderRadius: 999,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            padding: "13px 32px",
          }}
        >
          Log veilig in
        </Button>
      </Section>

      <Hr style={{ borderColor: emailColors.line, margin: "22px 0" }} />

      <Text style={paragraph}>
        Benieuwd wat je ervan vindt! Reageer gerust op deze mail met je
        wensen of opmerkingen — of laat weten wanneer het jou uitkomt voor een
        korte persoonlijke afspraak. Ik denk graag met je mee.
      </Text>
      <Signature />
    </EmailLayout>
  );
}
