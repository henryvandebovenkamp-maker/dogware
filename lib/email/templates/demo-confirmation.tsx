import { Text } from "@react-email/components";
import { EmailLayout, paragraph, strong } from "./base";

/** Bevestiging aan de aanvrager: we hebben je demo-aanvraag ontvangen. */
export function DemoConfirmationEmail({ naam }: { naam: string }) {
  return (
    <EmailLayout
      preview="We hebben je demo-aanvraag ontvangen — tot snel!"
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
        Tot snel — en tot die tijd: doe waar je goed in bent. Werk met honden,
        wij regelen de rest.
      </Text>
      <Text style={{ ...paragraph, margin: "20px 0 0" }}>
        Hartelijke groet,
        <br />
        <span style={strong}>Henry van de Bovenkamp</span>
        <br />
        Oprichter van DogWare
      </Text>
    </EmailLayout>
  );
}
