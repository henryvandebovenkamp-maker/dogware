import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailColors, paragraph, strong } from "./base";

export type ContactMessageData = {
  naam: string;
  email: string;
  telefoon?: string;
  bericht: string;
  /** Waar de bezoeker vandaan kwam, bijv. "/trimsalon-software" */
  herkomst?: string;
};

function Regel({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <Text style={{ ...paragraph, margin: "0 0 4px" }}>
      <span style={strong}>{label}:</span> {value}
    </Text>
  );
}

/** Interne mail: iemand heeft het contactformulier ingevuld. */
export function ContactMessageEmail({
  naam,
  email,
  telefoon,
  bericht,
  herkomst,
}: ContactMessageData) {
  return (
    <EmailLayout
      preview={`Bericht van ${naam} via het contactformulier`}
      heading="Nieuw bericht via de website 💬"
    >
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <Regel label="Naam" value={naam} />
        <Regel label="E-mail" value={email} />
        <Regel label="Telefoon" value={telefoon} />
        <Regel label="Pagina" value={herkomst} />
      </Section>

      <Text
        style={{
          ...paragraph,
          color: emailColors.ink,
          fontWeight: 800,
          margin: "18px 0 6px",
        }}
      >
        Het bericht
      </Text>
      <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-line" }}>
        {bericht}
      </Text>

      <Text style={{ ...paragraph, margin: "20px 0 0" }}>
        <Link href={`mailto:${email}`} style={{ color: emailColors.brand }}>
          → Antwoord {naam} direct
        </Link>
      </Text>
    </EmailLayout>
  );
}
