import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Het e-mailadres van een account wijzigen. Drie berichten:
 *
 * - "bevestigen"  → naar het NIEUWE adres, met de enige link die de wijziging
 *                   doorvoert. Zonder klik verandert er niets.
 * - "aangevraagd" → naar het HUIDIGE adres, ter info en zonder link: wie dit
 *                   niet verwacht, weet zo meteen dat er iets speelt.
 * - "gewijzigd"   → naar het nieuwe adres, nadat de wijziging is doorgevoerd.
 */
export type EmailWijzigingMoment = "bevestigen" | "aangevraagd" | "gewijzigd";

export function EmailWijzigingEmail({
  voornaam,
  moment,
  nieuwAdres,
  bevestigUrl,
  geldigDagen,
}: {
  voornaam: string;
  moment: EmailWijzigingMoment;
  nieuwAdres: string;
  bevestigUrl?: string;
  geldigDagen?: number;
}) {
  return (
    <EmailLayout
      preview={
        moment === "bevestigen"
          ? "Bevestig je nieuwe e-mailadres voor DogWare"
          : moment === "aangevraagd"
            ? "Er is een wijziging van je e-mailadres aangevraagd"
            : "Je e-mailadres is gewijzigd"
      }
      heading={`Hoi ${voornaam},`}
    >
      {moment === "bevestigen" && (
        <>
          <Text style={paragraph}>
            We gaan je DogWare-account voortaan gebruiken met dit e-mailadres:{" "}
            <span style={strong}>{nieuwAdres}</span>. Bevestig hieronder dat
            dit adres van jou is.
          </Text>
          <Section style={{ textAlign: "center", padding: "8px 0" }}>
            <Button
              href={bevestigUrl}
              style={{
                backgroundColor: emailColors.brand,
                borderRadius: 999,
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 700,
                padding: "13px 32px",
              }}
            >
              Bevestig mijn e-mailadres
            </Button>
          </Section>
          <Text style={paragraph}>
            Je account, je persoonlijke link en al je aanbrengingen en
            commissies blijven precies zoals ze zijn. Na de bevestiging log je
            in met dit nieuwe adres.
          </Text>
          <Text style={{ ...paragraph, fontSize: 12 }}>
            Deze link is {geldigDagen ?? 7} dagen geldig en werkt één keer.
            Niet door jou aangevraagd? Dan kun je deze mail negeren — er
            verandert niets.
          </Text>
        </>
      )}
      {moment === "aangevraagd" && (
        <>
          <Text style={paragraph}>
            Er is gevraagd om het e-mailadres van je DogWare-account te wijzigen
            naar <span style={strong}>{nieuwAdres}</span>. De wijziging gaat pas
            in nadat die vanaf het nieuwe adres is bevestigd.
          </Text>
          <Text style={paragraph}>
            Klopt dit niet? Antwoord dan op deze mail, dan zet ik het direct
            stop.
          </Text>
        </>
      )}
      {moment === "gewijzigd" && (
        <>
          <Text style={paragraph}>
            Gelukt: je DogWare-account gebruikt vanaf nu{" "}
            <span style={strong}>{nieuwAdres}</span>. Hier ontvang je voortaan
            al je berichten, en hiermee log je in.
          </Text>
          <Text style={paragraph}>
            Je persoonlijke link, je aanbrengingen en je commissies zijn
            ongewijzigd gebleven.
          </Text>
        </>
      )}
      <Signature groet="Hartelijke groet," />
    </EmailLayout>
  );
}
