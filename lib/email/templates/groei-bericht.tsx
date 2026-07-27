import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { branding } from "@/lib/branding";

/**
 * Een mail van Henry aan een collega.
 *
 * Deze template gebruikt met opzet NIET de gedeelde EmailLayout. Die zet een
 * logo, een kleurbalk en een witte kaart op je scherm — precies de signalen
 * waaraan je een mailing herkent. Deze mail moet eruitzien alsof iemand hem
 * heeft getypt, want dat is ook wat er gebeurde: Henry heeft hem gelezen en
 * op verzenden gedrukt.
 *
 * Wat er wel in staat en er wettelijk in moet: wie de afzender is, en hoe je
 * van de lijst af komt.
 */

const tekststijl = {
  color: "#1c150f",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSize: 16,
  lineHeight: "26px",
  margin: "0 0 18px",
};

export function GroeiBerichtEmail({
  tekst,
  voorstelUrl,
  afmeldUrl,
  voorbeeld,
}: {
  /** De tekst zoals Henry hem heeft achtergelaten, inclusief witregels. */
  tekst: string;
  /** Waar het inspiratievoorstel staat, als er één is. */
  voorstelUrl: string | null;
  afmeldUrl: string;
  /** Eerste regel in het voorvertoningsvenster van de mail. */
  voorbeeld: string;
}) {
  // De plaatshouder wordt hier pas een link, zodat de tekst in het scherm van
  // Henry leesbaar blijft en de link nooit dubbel in de mail belandt.
  const delen = tekst.split("{{voorstel}}");

  return (
    <Html lang="nl">
      <Head />
      <Preview>{voorbeeld}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container style={{ margin: "0 auto", maxWidth: 560, padding: "0 24px" }}>
          <Section>
            {delen.map((deel, i) => (
              <span key={i}>
                <Text style={{ ...tekststijl, whiteSpace: "pre-line" }}>{deel.trim()}</Text>
                {i < delen.length - 1 && voorstelUrl && (
                  <Text style={tekststijl}>
                    <Link
                      href={voorstelUrl}
                      style={{ color: branding.colors.primary, textDecoration: "underline" }}
                    >
                      {voorstelUrl.replace(/^https?:\/\//, "")}
                    </Link>
                  </Text>
                )}
              </span>
            ))}
          </Section>

          <Hr style={{ borderColor: "#ece2d3", margin: "28px 0 16px" }} />

          {/* Wie dit stuurt en hoe je ervan af komt. Klein, maar het hoort er
              te staan — en het hoort ook waar te zijn. */}
          <Text
            style={{
              ...tekststijl,
              color: "#8a7a6a",
              fontSize: 13,
              lineHeight: "21px",
              margin: 0,
            }}
          >
            Henry van de Bovenkamp · {branding.name} ·{" "}
            <Link
              href={branding.siteUrl}
              style={{ color: "#8a7a6a", textDecoration: "underline" }}
            >
              {branding.siteUrl.replace(/^https?:\/\//, "")}
            </Link>
            <br />
            Ik schrijf je omdat ik je bedrijf tegenkwam en dacht dat dit je kon
            helpen.{" "}
            <Link href={afmeldUrl} style={{ color: "#8a7a6a", textDecoration: "underline" }}>
              Liever geen mail meer?
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
