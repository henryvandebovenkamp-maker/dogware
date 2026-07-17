import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
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
            borderRadius: 16,
            margin: "0 auto",
            maxWidth: 560,
            overflow: "hidden",
          }}
        >
          <Section
            style={{
              backgroundColor: emailColors.cream,
              borderBottom: `1px solid ${emailColors.line}`,
              padding: "22px 32px",
            }}
          >
            <Img
              src={absoluteUrl(branding.logo.email)}
              alt={`${branding.name} — ${branding.slogan}`}
              width="192"
              height="96"
            />
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
              {branding.name} — {branding.slogan}.
              <br />
              Je ontvangt deze e-mail omdat je contact met ons had via{" "}
              {branding.siteUrl.replace(/^https?:\/\//, "")}.
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
