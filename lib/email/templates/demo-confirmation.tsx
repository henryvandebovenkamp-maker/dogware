import { Text } from "@react-email/components";
import { EmailLayout, Signature, paragraph, strong } from "./base";

/** Bevestiging aan de aanvrager: we hebben je demo-aanvraag ontvangen. */
export function DemoConfirmationEmail({ naam }: { naam: string }) {
  return (
    <EmailLayout
      preview="We hebben je demo-aanvraag ontvangen. Tot snel!"
      heading={`Bedankt, ${naam}! 🐾`}
    >
      <Text style={paragraph}>
        We hebben je aanvraag voor een demo van{" "}
        <span style={strong}>DogWare</span> goed ontvangen.
      </Text>
      <Text style={paragraph}>
        We nemen <span style={strong}>binnen 1 werkdag</span> contact met je op
        om een moment in te plannen. Vrijblijvend, en helemaal afgestemd op
        jouw bedrijf.
      </Text>
      <Text style={paragraph}>
        Tot snel. En doe tot die tijd waar je goed in bent: werken met honden.
        De rest regelen wij.
      </Text>
      <Signature groet="Hartelijke groet," />
    </EmailLayout>
  );
}
