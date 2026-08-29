import { Section, Text } from "@react-email/components";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";
import { branding } from "@/lib/branding";

/**
 * Bevestiging aan de bezoeker die het contactformulier invulde.
 * Persoonlijk van toon: geen ticketnummer, gewoon "ik heb het gelezen".
 */
export function ContactConfirmationEmail({
  naam,
  bericht,
}: {
  naam: string;
  bericht: string;
}) {
  return (
    <EmailLayout
      preview="Je bericht is binnen — ik reageer persoonlijk"
      heading={`Hoi ${naam}, je bericht is binnen 🐾`}
    >
      <Text style={paragraph}>
        Bedankt voor je bericht. Het komt rechtstreeks bij mij binnen, niet bij
        een helpdesk. <span style={strong}>Je krijgt gewoon antwoord van mij.</span>
      </Text>
      <Text style={paragraph}>{branding.responseTime}.</Text>

      <Text
        style={{
          ...paragraph,
          color: emailColors.ink,
          fontWeight: 800,
          margin: "18px 0 6px",
        }}
      >
        Dit stuurde je me
      </Text>
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "14px 18px",
        }}
      >
        <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-line" }}>
          {bericht}
        </Text>
      </Section>

      <Text style={{ ...paragraph, margin: "18px 0 0" }}>
        Liever even bellen? Dat mag altijd:{" "}
        <span style={strong}>{branding.phone}</span>.
      </Text>

      <Signature groet="Hartelijke groet," />
    </EmailLayout>
  );
}
