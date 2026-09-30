import { Section, Text } from "@react-email/components";
import { EmailLayout, Signature, paragraph } from "./base";

/**
 * De laatste mail bij een demo die we netjes afronden. Warm en zonder
 * verwijt: de tijdelijke demo gaat offline, de deur blijft open. De PDF van
 * de voorbeeldwebsite zit als bijlage bij de mail.
 *
 * De tekst komt uit de editor van de beheerder (die hem kan aanpassen); dit
 * template zorgt alleen voor de DogWare-vormgeving eromheen.
 */
export function DemoAfsluitingEmail({
  alineas,
  bijlage,
  proef,
}: {
  alineas: string[];
  bijlage: string;
  /** Proef voor Henry: alleen een strook bovenaan, verder identiek. */
  proef?: { klant: string };
}) {
  return (
    <EmailLayout
      preview={proef ? "PROEF — je voorbeeldwebsite, om te bewaren" : "Je voorbeeldwebsite, om te bewaren"}
      heading="Je voorbeeldwebsite, om te bewaren"
      banner={
        proef && (
          <Section style={{ backgroundColor: "#1c150f", padding: "14px 24px" }}>
            <Text style={{ margin: 0, color: "#ffffff", fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
              PROEFVERSIE — NIET NAAR DE KLANT VERSTUURD
            </Text>
            <Text style={{ margin: "4px 0 0", color: "#d8cfc4", fontSize: 12, lineHeight: "18px" }}>
              Zo ontvangt {proef.klant} deze mail, met dezelfde PDF als bijlage.
            </Text>
          </Section>
        )
      }
    >
      {alineas.map((a, i) => (
        <Text key={i} style={paragraph}>
          {a}
        </Text>
      ))}
      <Text style={{ ...paragraph, fontSize: 13, color: "#8a8178" }}>📎 Bijlage: {bijlage}</Text>
      <Signature groet="Groet," />
    </EmailLayout>
  );
}
