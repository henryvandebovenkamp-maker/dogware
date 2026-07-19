import { Button, Section, Text } from "@react-email/components";
import { branding } from "@/lib/branding";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Persoonlijke mail wanneer het eerste voorbeeld klaarstaat.
 *
 * Geschreven vanuit Henry, in de ik-vorm: de klant moet voelen dat de aanvraag
 * echt gelezen is en dat Henry er speciaal mee aan de slag is gegaan.
 *
 * BELANGRIJK — nooit aannames doen. Alle inhoud komt uit de demo-aanvraag:
 * - `firstName`   : voornaam uit de aanvraag.
 * - `modules`     : uitsluitend de onderdelen die de klant zelf heeft
 *                   geselecteerd (al leesbare labels). Leeg = niet noemen.
 *
 * Inloggen is passwordless: de knop wijst naar het demoportaal (de link die de
 * beheerder zelf invult), waar de klant het bekende e-mailadres van de aanvraag
 * invult en automatisch een veilige inlogmail ontvangt.
 */
export function DemoReadyEmail({
  firstName,
  modules = [],
  demoUrl,
  portaalUrl,
}: {
  firstName: string;
  /** Optioneel — nooit een bedrijfsnaam of module verzinnen. */
  bedrijfsnaam?: string;
  modules?: string[];
  demoUrl?: string;
  portaalUrl: string;
}) {
  const gekozen = modules.map((m) => m.trim()).filter(Boolean);

  return (
    <EmailLayout
      preview="Ik ben voor je aan de slag gegaan — je eerste DogWare-voorbeeld staat klaar"
      heading={`Hi ${firstName},`}
    >
      <Text style={paragraph}>
        Bedankt voor je aanvraag! Ik ben meteen even voor je aan de slag gegaan.
      </Text>

      <Text style={paragraph}>
        {gekozen.length > 0 ? (
          <>
            Ik zag dat je vooral interesse hebt in{" "}
            <span style={strong}>{formatList(gekozen)}</span>, dus daar heb ik in
            dit eerste voorbeeld alvast extra aandacht aan besteed. Zo krijg je
            direct een goed beeld van wat er allemaal mogelijk is.
          </>
        ) : (
          <>
            Ik heb goed naar je aanvraag gekeken en daar in dit eerste voorbeeld
            alvast extra aandacht aan besteed. Zo krijg je direct een goed beeld
            van wat er allemaal mogelijk is.
          </>
        )}
      </Text>

      {demoUrl && (
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
            Bekijk jouw voorbeeldwebsite
          </Button>
        </Section>
      )}

      <Text style={paragraph}>
        Ben je ook benieuwd hoe de beheeromgeving werkt? Klik dan op de knop
        hieronder en log in met hetzelfde e-mailadres waarmee je de demo hebt
        aangevraagd. Je ontvangt automatisch een e-mail waarmee je veilig kunt
        inloggen. Simpel en zonder wachtwoord.
      </Text>
      <Section style={{ textAlign: "center", padding: "8px 0" }}>
        <Button
          href={portaalUrl}
          style={{
            backgroundColor: emailColors.ink,
            borderRadius: 999,
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            padding: "13px 32px",
          }}
        >
          Inloggen in jouw demo
        </Button>
      </Section>

      <Text style={paragraph}>
        Kijk er rustig even doorheen. Grote kans dat je meteen ideeën of vragen
        krijgt. 😊
      </Text>

      <Text style={paragraph}>
        Vind je het leuk om alles even samen door te nemen? Bel me gerust of
        stuur even een appje. In ongeveer 15 minuten laat ik je zien hoe alles
        werkt en kun je al je vragen stellen.
      </Text>

      <Text style={{ ...paragraph, margin: "0 0 14px" }}>
        📞{" "}
        <a
          href={`tel:${branding.phoneTel}`}
          style={{ ...strong, color: emailColors.ink, textDecoration: "none" }}
        >
          {branding.phone}
        </a>
      </Text>

      <Text style={paragraph}>Veel kijkplezier!</Text>

      <Signature groet="Met vriendelijke groet," />
    </EmailLayout>
  );
}

/** Nette Nederlandse opsomming: "A", "A en B", "A, B en C". */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}
