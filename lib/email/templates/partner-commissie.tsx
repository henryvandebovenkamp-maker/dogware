import { Button, Section, Text } from "@react-email/components";
import { branding } from "@/lib/branding";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Commissieberichten aan de partner: "je commissie is beschikbaar" en "je
 * commissie is uitbetaald".
 *
 * BELANGRIJK — wat hier NOOIT in mag:
 * - Geen bedragen of betaalgegevens van de klant. De partner hoort alleen
 *   zijn eigen commissie te zien.
 * - De "uitbetaald"-mail gaat uitsluitend uit nadat een financieel bevoegde
 *   beheerder de overschrijving met datum en referentie heeft vastgelegd.
 *   Nooit eerder, nooit "onderweg".
 * - Het IBAN alleen gemaskeerd.
 */
export type PartnerCommissieMoment = "uitbetaalbaar" | "uitbetaald";

export function PartnerCommissieEmail({
  partnerFirstName,
  moment,
  bedrag,
  companyName,
  uitbetaling,
}: {
  partnerFirstName: string;
  moment: PartnerCommissieMoment;
  /** Het commissiebedrag, al opgemaakt ("€ 500"). */
  bedrag: string;
  companyName?: string;
  /** Alleen bij "uitbetaald". */
  uitbetaling?: { datum: string; referentie: string; ibanGemaskeerd?: string };
}) {
  const bedrijf = companyName?.trim();
  const portaal = `${branding.siteUrl}/partner`;
  const wie = bedrijf ? <span style={strong}>{bedrijf}</span> : "De klant die jij aanbracht";

  return (
    <EmailLayout
      preview={
        moment === "uitbetaald"
          ? `Je commissie van ${bedrag} is uitbetaald`
          : `Je commissie van ${bedrag} is beschikbaar`
      }
      heading={`Hi ${partnerFirstName},`}
    >
      {moment === "uitbetaalbaar" ? (
        <>
          <Text style={paragraph}>Goed nieuws! 🎉</Text>
          <Text style={paragraph}>
            {wie} heeft de eenmalige investering volledig voldaan. Daarmee is
            jouw commissie van <span style={strong}>{bedrag}</span> definitief
            en beschikbaar voor uitbetaling.
          </Text>
          <Text style={paragraph}>
            Ik zet de overschrijving voor je klaar. Controleer in je
            partneromgeving onder <span style={strong}>Profiel</span> even of
            je rekeninghouder en IBAN kloppen — dan komt het geld op de juiste
            plek terecht. Zodra het bedrag daadwerkelijk is overgemaakt, krijg
            je van mij een bevestiging.
          </Text>
        </>
      ) : (
        <>
          <Text style={paragraph}>
            Je commissie van <span style={strong}>{bedrag}</span>
            {bedrijf ? (
              <>
                {" "}voor <span style={strong}>{bedrijf}</span>
              </>
            ) : null}{" "}
            is uitbetaald. Dankjewel dat je DogWare hebt aanbevolen!
          </Text>
          {uitbetaling && (
            <Section
              style={{
                backgroundColor: emailColors.cream,
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <Text style={{ ...paragraph, margin: 0 }}>
                Bedrag: <span style={strong}>{bedrag}</span>
                <br />
                Overgemaakt op: <span style={strong}>{uitbetaling.datum}</span>
                <br />
                Kenmerk: <span style={strong}>{uitbetaling.referentie}</span>
                {uitbetaling.ibanGemaskeerd && (
                  <>
                    <br />
                    Naar rekening: <span style={strong}>{uitbetaling.ibanGemaskeerd}</span>
                  </>
                )}
              </Text>
            </Section>
          )}
          <Text style={paragraph}>
            Afhankelijk van je bank staat het bedrag binnen één à twee
            werkdagen op je rekening.
          </Text>
        </>
      )}

      <Section style={{ textAlign: "center", padding: "8px 0" }}>
        <Button
          href={portaal}
          style={{
            backgroundColor: emailColors.brand,
            borderRadius: 999,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            padding: "13px 32px",
          }}
        >
          Bekijk je partneromgeving
        </Button>
      </Section>

      <Signature groet="Met kwispelende groet," />
    </EmailLayout>
  );
}
