import { Text } from "@react-email/components";
import { EmailLayout, Signature, paragraph, strong } from "./base";

/** Persoonlijke bevestiging aan de aanvrager van een demo-intake. */
export function IntakeConfirmationEmail({ naam }: { naam: string }) {
  return (
    <EmailLayout
      preview="Ik ga aan de slag met jouw persoonlijke DogWare-voorbeeld"
      heading={`Bedankt, ${naam}! 🐾`}
    >
      <Text style={paragraph}>
        Superleuk dat je interesse hebt in <span style={strong}>DogWare</span>.
      </Text>
      <Text style={paragraph}>
        Ik ga jouw antwoorden rustig bekijken en maak vervolgens een demo die
        écht aansluit op jouw bedrijf. Geen standaard presentatie, maar een
        voorstel waarin je kunt zien hoe jouw eigen onderneming eruit zou
        kunnen zien met DogWare.
      </Text>
      <Text style={paragraph}>
        <span style={strong}>
          Binnen 24 uur ontvang je geen offerte, maar een kosteloos voorbeeld
          van hoe jouw eigen DogWare-omgeving eruit kan zien.
        </span>{" "}
        Je zit nergens aan vast.
      </Text>
      <Text style={paragraph}>Tot snel! En geniet ondertussen van je honden. 🐾</Text>
      <Signature
        groet="Hartelijke groet,"
        regel="Ik kijk ernaar uit je te laten zien wat DogWare voor jouw bedrijf kan betekenen."
      />
    </EmailLayout>
  );
}
