import { Button, Section, Text } from "@react-email/components";
import { branding } from "@/lib/branding";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * Voortgangsberichtje aan de partner ná de demo: voorstel verstuurd, klant
 * akkoord, overeenkomst getekend. Zonder deze mails is het voor de partner
 * stil vanaf het moment dat de demo weggaat, terwijl juist dán het deel begint
 * waar zijn commissie van afhangt.
 *
 * BELANGRIJK — wat hier NOOIT in mag:
 * - Geen portaal-, traject- of loginlink van de klant. De enige knop wijst
 *   naar de eigen partneromgeving.
 * - Geen bedragen uit het voorstel. Wat de klant betaalt gaat de partner niet
 *   aan; zijn eigen commissie staat in zijn portaal.
 * - `companyName` alleen tonen als die is ingevuld — nooit verzinnen.
 */
export type PartnerMilestone =
  | "voorstel-verstuurd"
  | "voorstel-akkoord"
  | "overeenkomst-getekend";

type Copy = {
  preview: string;
  opening: string;
  /** Zin ná de bedrijfsnaam. Begint met een spatie. */
  staart: string;
  slot: string;
};

const COPY: Record<PartnerMilestone, Copy> = {
  "voorstel-verstuurd": {
    preview: "Het voorstel is verstuurd",
    opening: "Weer een stapje verder!",
    staart: " heeft zojuist het voorstel ontvangen. Nu even afwachten wat ze ervan vinden.",
    slot: "Zodra ze reageren, laat ik het je weten.",
  },
  "voorstel-akkoord": {
    preview: "Het voorstel is geaccepteerd",
    opening: "Mooi nieuws! 🎉",
    staart:
      " is akkoord met het voorstel. De samenwerkingsovereenkomst staat inmiddels voor ze klaar om te tekenen.",
    slot: "Nog één handtekening en het is rond. Ik hou je op de hoogte.",
  },
  "overeenkomst-getekend": {
    preview: "De overeenkomst is getekend",
    opening: "Het is rond! 🖊️",
    staart:
      " heeft de samenwerkingsovereenkomst getekend. Dankjewel dat je ons hebt aanbevolen — zonder jou was dit niet gebeurd.",
    slot:
      "Je commissie staat vanaf nu als gereserveerd in je partneromgeving. Zodra we met de bouw beginnen, telt hij mee als verkocht.",
  },
};

export function PartnerMilestoneEmail({
  partnerFirstName,
  milestone,
  companyName,
}: {
  partnerFirstName: string;
  milestone: PartnerMilestone;
  companyName?: string;
}) {
  const c = COPY[milestone];
  const bedrijf = companyName?.trim();
  const portaal = `${branding.siteUrl}/partner`;

  return (
    <EmailLayout preview={c.preview} heading={`Hi ${partnerFirstName},`}>
      <Text style={paragraph}>{c.opening}</Text>

      <Text style={paragraph}>
        {bedrijf ? <span style={strong}>{bedrijf}</span> : "De klant die jij aanbracht"}
        {c.staart}
      </Text>

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

      <Text style={paragraph}>{c.slot}</Text>

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
