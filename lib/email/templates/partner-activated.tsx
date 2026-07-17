import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, paragraph, strong } from "./base";

/** Bevestiging: partneraccount is actief. */
export function PartnerActivatedEmail({
  naam,
  referralLink,
  portalUrl,
}: {
  naam: string;
  referralLink: string;
  portalUrl: string;
}) {
  return (
    <EmailLayout
      preview="Je partneraccount is actief — hier is je persoonlijke link"
      heading={`Je account is actief, ${naam}!`}
    >
      <Text style={paragraph}>
        Welkom bij het <span style={strong}>DogWare Partnerprogramma</span>. Je
        persoonlijke link staat voor je klaar:
      </Text>
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
        jou gekoppeld. In je partneromgeving volg je clicks, aanvragen en
        resultaten.
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
    </EmailLayout>
  );
}
