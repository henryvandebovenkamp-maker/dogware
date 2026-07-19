import { Button, Section, Text } from "@react-email/components";
import { branding } from "@/lib/branding";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Automatisch, persoonlijk berichtje aan de partner zodra de demo naar de
 * klant is verstuurd. Geschreven vanuit Henry — kort, warm, geen systeemtaal.
 *
 * BELANGRIJK:
 * - `companyName` alleen tonen als die daadwerkelijk is ingevuld (nooit verzinnen).
 * - `demoUrl` is UITSLUITEND de publieke voorbeeldwebsite — nooit de loginlink,
 *   magic link of beheeromgeving.
 */
export function PartnerDemoSentEmail({
  partnerFirstName,
  companyName,
  demoUrl,
}: {
  partnerFirstName: string;
  companyName?: string;
  demoUrl?: string;
}) {
  const bedrijf = companyName?.trim();

  return (
    <EmailLayout
      preview="Leuk nieuws — de demo is verstuurd"
      heading={`Hi ${partnerFirstName},`}
    >
      <Text style={paragraph}>Even een leuk berichtje! 😊</Text>

      <Text style={paragraph}>
        De demo{bedrijf ? " voor " : " "}
        {bedrijf && <span style={strong}>{bedrijf}</span>} staat inmiddels klaar
        en is verstuurd. Bedankt dat je DogWare hebt aanbevolen, dat waardeer ik
        enorm.
      </Text>

      {demoUrl && (
        <>
          <Text style={paragraph}>
            Ben je benieuwd wat de klant straks te zien krijgt? Via onderstaande
            knop kun je de voorbeeldwebsite alvast bekijken.
          </Text>
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
              Bekijk de demo
            </Button>
          </Section>
        </>
      )}

      <Text style={paragraph}>
        Ik ben heel benieuwd wat de klant ervan vindt. Zodra ik een reactie krijg
        of we een vervolgstap zetten, laat ik het je natuurlijk weten.
      </Text>

      <Signature groet="Met kwispelende groet," />

      <Text style={{ ...paragraph, margin: "6px 0 0" }}>
        📞{" "}
        <a
          href={`tel:${branding.phoneTel}`}
          style={{ ...strong, color: emailColors.ink, textDecoration: "none" }}
        >
          {branding.phone}
        </a>
      </Text>
    </EmailLayout>
  );
}
