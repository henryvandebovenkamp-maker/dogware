import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { absoluteUrl, branding } from "@/lib/branding";

/**
 * Gedeelde e-maillayout in de DogWare-huisstijl.
 * Alle templates gebruiken deze wrapper; logo, naam en kleuren komen
 * uitsluitend uit lib/branding.ts.
 */

export const emailColors = {
  cream: branding.colors.background,
  ink: branding.colors.ink,
  inkSoft: "#6b5d4f",
  brand: branding.colors.primary,
  sage: branding.colors.secondary,
  line: "#ece2d3",
};

export function EmailLayout({
  preview,
  heading,
  children,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
}) {
  // Standaard e-maillogo. Een Super Admin-override wordt in service.ts in de
  // gerenderde HTML omgewisseld (voorkomt een client/server-contextgrens).
  const emailLogoSrc = absoluteUrl(branding.logo.email);
  return (
    <Html lang="nl">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: emailColors.cream,
          fontFamily:
            "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 18,
            margin: "0 auto",
            maxWidth: 560,
            overflow: "hidden",
            boxShadow: "0 10px 40px -12px rgba(28,21,15,0.12)",
          }}
        >
          {/* Warme accentrand bovenaan */}
          <Section
            style={{
              backgroundColor: emailColors.brand,
              backgroundImage: `linear-gradient(90deg, ${emailColors.brand}, ${emailColors.sage})`,
              height: 5,
              lineHeight: "5px",
              fontSize: 0,
            }}
          >
            &nbsp;
          </Section>
          {/* Header: e-maillogo (zonder slogan) — eenvoudige tabelstructuur,
              perfect gecentreerd, proportioneel geschaald (geen vaste hoogte). */}
          <Section
            style={{
              backgroundColor: emailColors.cream,
              borderBottom: `1px solid ${emailColors.line}`,
              padding: "24px 32px",
            }}
          >
            <Row>
              <Column align="center">
                <Img
                  src={emailLogoSrc}
                  alt={branding.name}
                  width="234"
                  style={{
                    display: "block",
                    width: "234px",
                    height: "auto",
                    maxWidth: "100%",
                    border: 0,
                    margin: "0 auto",
                  }}
                />
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "32px" }}>
            <Heading
              as="h1"
              style={{
                color: emailColors.ink,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: "0 0 16px",
              }}
            >
              {heading}
            </Heading>
            {children}
          </Section>

          <Hr style={{ borderColor: emailColors.line, margin: 0 }} />
          <Section style={{ padding: "20px 32px" }}>
            <Text
              style={{
                color: emailColors.inkSoft,
                fontSize: 12,
                lineHeight: "18px",
                margin: 0,
              }}
            >
              Gemaakt met liefde voor honden en hun mensen. 🐾
              <br />
              {branding.name}. {branding.slogan}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Standaard broodtekst-stijl voor in templates. */
export const paragraph = {
  color: emailColors.inkSoft,
  fontSize: 15,
  lineHeight: "24px",
  margin: "0 0 14px",
} as const;

/** Vetgedrukte ink-tekst voor nadruk. */
export const strong = {
  color: emailColors.ink,
  fontWeight: 700,
} as const;

/**
 * Persoonlijke ondertekening van Henry. Één centrale plek zodat elke mail
 * dezelfde, natuurlijke afsluiting krijgt.
 *
 * @param groet   De aanhef van de afsluiting (past bij de toon van de mail).
 * @param regel   Optionele korte, warme slotregel boven de groet. Alleen
 *                gebruiken als die de mail echt versterkt.
 */
export function Signature({
  groet = "Met vriendelijke groet,",
  regel,
}: {
  groet?: string;
  regel?: string;
} = {}) {
  return (
    <>
      {regel && (
        <Text style={{ ...paragraph, margin: "18px 0 0" }}>{regel}</Text>
      )}
      <Text style={{ ...paragraph, margin: regel ? "12px 0 0" : "20px 0 0" }}>
        {groet}
        <br />
        <br />
        <span style={strong}>Henry van de Bovenkamp</span>
        <br />
        <span style={{ fontSize: 13, color: emailColors.inkSoft }}>DogWare</span>
      </Text>
    </>
  );
}
