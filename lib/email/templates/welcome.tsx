import { Text } from "@react-email/components";
import { EmailLayout, paragraph, strong } from "./base";

/**
 * Welkomstmail — klaar voor wanneer DogWare accounts/onboarding krijgt.
 * Nog nergens aan gekoppeld; dient als voorbeeld en toekomstige basis.
 */
export function WelcomeEmail({ naam }: { naam: string }) {
  return (
    <EmailLayout
      preview="Welkom bij DogWare!"
      heading={`Welkom bij DogWare, ${naam}! 🐾`}
    >
      <Text style={paragraph}>
        Fijn dat je erbij bent. Vanaf nu heb je één rustige plek voor je
        planning, klanten, betalingen en administratie.
      </Text>
      <Text style={paragraph}>
        Kom je ergens niet uit? Reageer gewoon op deze e-mail — je krijgt
        antwoord van een <span style={strong}>hondenmens</span>, niet van een
        robot.
      </Text>
    </EmailLayout>
  );
}
