import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

export type CommerceMailType =
  | "proposal-sent"
  | "deposit-ready"
  | "deposit-received"
  | "delivery-ready"
  | "final-ready"
  | "final-received"
  | "subscription-started"
  | "charge-failed";

const COPY: Record<
  CommerceMailType,
  { heading: (n: string) => string; body: (v: Vars) => string[]; cta?: string }
> = {
  "proposal-sent": {
    heading: (n) => `Je voorstel staat klaar, ${n}`,
    body: () => [
      "Ik heb met plezier een persoonlijk voorstel voor je uitgewerkt. Je vindt er alles in: wat we maken, de kosten en hoe het abonnement werkt.",
      "Bekijk het rustig in je eigen omgeving. Klopt alles? Dan kun je er met één klik akkoord op geven.",
    ],
    cta: "Bekijk je voorstel",
  },
  "deposit-ready": {
    heading: (n) => `Mooi, ${n} — we kunnen beginnen`,
    body: (v) => [
      "Bedankt voor je akkoord! Om te starten met bouwen vragen we de eerste termijn.",
      `De eerste termijn is ${v.amount}. Zodra dit binnen is, gaan we voor je aan de slag.`,
    ],
    cta: "Betaal de eerste termijn",
  },
  "deposit-received": {
    heading: (n) => `Gelukt, ${n} — we gaan bouwen!`,
    body: (v) => [
      `We hebben je eerste termijn van ${v.amount} ontvangen. Dank je wel!`,
      "Vanaf nu bouwen wij jouw DogWare-omgeving. Je hoort van ons zodra er iets te zien is.",
    ],
  },
  "delivery-ready": {
    heading: (n) => `Het is klaar, ${n}!`,
    body: (v) => [
      "Je DogWare-omgeving is opgeleverd — benieuwd wat je ervan vindt.",
      `Om alles definitief te maken staat de laatste termijn van ${v.amount} klaar.`,
    ],
    cta: "Bekijk oplevering",
  },
  "final-ready": {
    heading: (n) => `Laatste stap, ${n}`,
    body: (v) => [`De laatste termijn van ${v.amount} staat voor je klaar. Daarna is alles van jou.`],
    cta: "Betaal de laatste termijn",
  },
  "final-received": {
    heading: (n) => `Helemaal rond, ${n} 🐾`,
    body: (v) => [
      `We hebben de laatste termijn van ${v.amount} ontvangen. Je project is volledig betaald — gefeliciteerd!`,
      "Binnenkort regelen we samen je maandabonnement, zodat alles blijft draaien.",
    ],
  },
  "subscription-started": {
    heading: (n) => `Welkom als vaste klant, ${n}`,
    body: (v) => [`Je abonnement is geregeld. ${v.extra ?? ""}`.trim()],
  },
  "charge-failed": {
    heading: (n) => `Even een seintje, ${n}`,
    body: () => [
      "Het is deze maand niet gelukt om je abonnement automatisch af te schrijven. Geen zorgen — dat gebeurt zo af en toe.",
      "Je kunt het bedrag eenvoudig zelf via iDEAL voldoen; dan is het meteen weer geregeld.",
    ],
    cta: "Betaal via iDEAL",
  },
};

type Vars = { amount?: string; extra?: string };

export function CommerceEmail({
  type,
  naam,
  ctaUrl,
  vars = {},
}: {
  type: CommerceMailType;
  naam: string;
  ctaUrl?: string;
  vars?: Vars;
}) {
  const copy = COPY[type];
  return (
    <EmailLayout preview={copy.heading(naam)} heading={copy.heading(naam)}>
      {copy.body(vars).map((p, i) => (
        <Text key={i} style={paragraph}>
          {p}
        </Text>
      ))}
      {copy.cta && ctaUrl && (
        <Section style={{ textAlign: "center", padding: "10px 0 4px" }}>
          <Button
            href={ctaUrl}
            style={{
              backgroundColor: emailColors.brand,
              borderRadius: 999,
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              padding: "13px 30px",
            }}
          >
            {copy.cta}
          </Button>
        </Section>
      )}
      <Text style={{ ...paragraph, fontSize: 13 }}>
        Vragen? Reageer gerust op deze mail — je krijgt <span style={strong}>mij</span> aan de lijn.
      </Text>
      <Signature />
    </EmailLayout>
  );
}
