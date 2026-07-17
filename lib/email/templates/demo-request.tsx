import { Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, paragraph, strong } from "./base";

export type DemoRequestData = {
  naam: string;
  bedrijf: string;
  email: string;
  type: string;
};

/** Interne notificatie: er is een nieuwe demo-aanvraag binnengekomen. */
export function DemoRequestEmail({ naam, bedrijf, email, type }: DemoRequestData) {
  return (
    <EmailLayout
      preview={`Nieuwe demo-aanvraag van ${naam} (${bedrijf})`}
      heading="Nieuwe demo-aanvraag 🎉"
    >
      <Text style={paragraph}>
        Er is zojuist een demo-aanvraag binnengekomen via de website:
      </Text>
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <Text style={{ ...paragraph, margin: "0 0 6px" }}>
          <span style={strong}>Naam:</span> {naam}
        </Text>
        <Text style={{ ...paragraph, margin: "0 0 6px" }}>
          <span style={strong}>Bedrijf:</span> {bedrijf}
        </Text>
        <Text style={{ ...paragraph, margin: "0 0 6px" }}>
          <span style={strong}>E-mail:</span> {email}
        </Text>
        <Text style={{ ...paragraph, margin: 0 }}>
          <span style={strong}>Vakgebied:</span> {type}
        </Text>
      </Section>
      <Text style={{ ...paragraph, margin: "14px 0 0" }}>
        Beloofd op de site: reactie binnen 1 werkdag.
      </Text>
    </EmailLayout>
  );
}
