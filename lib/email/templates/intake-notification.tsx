import { Hr, Link, Section, Text } from "@react-email/components";
import type { IntakeData } from "@/lib/intake";
import { EmailLayout, emailColors, paragraph, strong } from "./base";

function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <>
      <Text
        style={{
          ...paragraph,
          color: emailColors.ink,
          fontWeight: 800,
          margin: "18px 0 6px",
        }}
      >
        {titel}
      </Text>
      {children}
    </>
  );
}

function Regel({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <Text style={{ ...paragraph, margin: "0 0 4px" }}>
      <span style={strong}>{label}:</span> {value}
    </Text>
  );
}

function Lijst({ items }: { items: string[] }) {
  if (items.length === 0)
    return <Text style={{ ...paragraph, margin: 0 }}>—</Text>;
  return (
    <Text style={{ ...paragraph, margin: 0 }}>{items.join(" · ")}</Text>
  );
}

const WEBSITE_LABELS: Record<string, string> = {
  nee: "Nee",
  ja: "Ja",
  "ja-nieuw": "Ja, maar wil iets nieuws",
};

/** Interne mail: volledige intake van een persoonlijke-demo-aanvraag. */
export function IntakeNotificationEmail({
  data,
  leadUrl,
}: {
  data: IntakeData;
  leadUrl?: string;
}) {
  return (
    <EmailLayout
      preview={`Persoonlijke demo-aanvraag van ${data.naam} (${data.bedrijfsnaam})`}
      heading="Nieuwe persoonlijke demo-aanvraag 🎉"
    >
      <Section
        style={{
          backgroundColor: emailColors.cream,
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <Regel label="Bedrijf" value={data.bedrijfsnaam} />
        <Regel label="Naam" value={data.naam} />
        <Regel label="E-mail" value={data.email} />
        <Regel label="Telefoon" value={data.telefoon} />
        <Regel label="Website" value={data.website} />
        <Regel label="Plaats" value={data.plaats} />
      </Section>

      <Blok titel="Diensten">
        <Lijst items={data.diensten} />
        <Regel label="Anders" value={data.dienstenAnders} />
      </Blok>

      <Blok titel="Huidige website">
        <Regel
          label="Heeft website"
          value={WEBSITE_LABELS[data.heeftWebsite] ?? "—"}
        />
        <Regel label="Goed aan huidige site" value={data.websiteGoed} />
        <Regel label="Mist aan huidige site" value={data.websiteMist} />
      </Blok>

      <Blok titel="Huidige software">
        <Lijst items={data.software} />
      </Blok>

      <Blok titel="Grootste tijdvreters">
        <Lijst items={data.tijdvreters} />
      </Blok>

      <Blok titel="Droomscenario">
        <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-line" }}>
          {data.droomscenario?.trim() || "—"}
        </Text>
      </Blok>

      <Blok titel="Inspiratie">
        <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-line" }}>
          {data.inspiratie?.trim() || "—"}
        </Text>
      </Blok>

      <Blok titel="Huisstijl">
        <Regel label="Logo" value={data.heeftLogo || "—"} />
        <Regel label="Kleuren / huisstijl" value={data.huisstijl} />
        {data.uploads.length > 0 && (
          <>
            {data.uploads.map((url) => (
              <Text key={url} style={{ ...paragraph, margin: "0 0 4px" }}>
                <Link href={url} style={{ color: emailColors.brand }}>
                  {url}
                </Link>
              </Text>
            ))}
          </>
        )}
      </Blok>

      <Blok titel="Gewenste functies">
        <Lijst items={data.functies} />
      </Blok>

      <Blok titel="Extra opmerkingen">
        <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-line" }}>
          {data.opmerkingen?.trim() || "—"}
        </Text>
      </Blok>

      {leadUrl && (
        <>
          <Hr style={{ borderColor: emailColors.line, margin: "20px 0" }} />
          <Text style={{ ...paragraph, margin: 0 }}>
            <Link href={leadUrl} style={{ color: emailColors.brand }}>
              → Open deze lead in het adminportaal
            </Link>
          </Text>
        </>
      )}
    </EmailLayout>
  );
}
