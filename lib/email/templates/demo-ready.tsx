import { Button, Hr, Section, Text } from "@react-email/components";
import { branding } from "@/lib/branding";
import { EmailLayout, Signature, emailColors, paragraph, strong } from "./base";

/**
 * "Jouw persoonlijke DogWare-demo staat klaar" — de mail die de potentiële
 * klant krijgt zodra Henry een eerste demo voor zijn bedrijf heeft gemaakt.
 *
 * De toon is bewust die van een persoonlijk berichtje, niet van een
 * SaaS-notificatie. De ontvanger moet voelen dat er iemand tijd heeft genomen
 * om alvast iets voor zíjn bedrijf te maken — en begrijpen dat dit een eerste
 * richting is, geen definitieve website.
 *
 * Drie dingen waar deze template hard op stuurt:
 *
 * 1. De demo is een eerste indruk. Nergens staat of suggereert de tekst "dit
 *    is jouw website". Overal staat er een uitnodiging tegenover om samen
 *    verder te kijken.
 * 2. Alles is custom te bouwen. Niet "kies uit deze functies", maar "mis je
 *    iets, vertel het me". Zonder de onhoudbare belofte dat álles kan.
 * 3. Nooit aannames. Elke naam, elk voorbeeld en elke module komt uit de
 *    aanvraag. Is iets niet ingevuld, dan wordt het niet genoemd — er wordt
 *    niets verzonnen en er blijft geen placeholder staan.
 *
 * Inloggen is passwordless: de knop wijst naar het demoportaal, waar de klant
 * het e-mailadres van de aanvraag invult en een veilige inlogmail ontvangt.
 * Er staat dus nooit een wachtwoord of token in deze mail.
 */

/**
 * Versie van deze template. Wordt bij verzending in de tijdlijn vastgelegd,
 * zodat later terug te zien is welke tekst een klant precies heeft gekregen.
 * Ophogen zodra de inhoud wezenlijk verandert.
 */
export const DEMO_READY_TEMPLATE_VERSION = "demo-ready-v2";

export type DemoReadyContent = {
  /** Voornaam uit de aanvraag. Leeg = neutrale begroeting, nooit een gok. */
  firstName?: string;
  /** Bedrijfsnaam uit de aanvraag. Leeg = niet noemen. */
  bedrijfsnaam?: string;
  /** Publieke demo-website. Ontbreekt hij, dan vervalt de primaire knop. */
  demoUrl?: string;
  /** Demoportaal (inloglink). Ontbreekt hij, dan vervalt het hele portaalblok. */
  portaalUrl?: string;
  /** Adres waarmee de klant inlogt — uit de aanvraag, nooit hardcoded. */
  loginEmail?: string;
  /** Diensten die de klant zelf heeft aangevinkt (leesbare labels). */
  diensten?: string[];
  /** Gewenste functionaliteit die de klant zelf heeft aangevinkt. */
  functies?: string[];
};

/** Het onderwerp van deze mail — één plek, zodat preview en verzending gelijk zijn. */
export function demoReadySubject(opts: { test?: boolean } = {}): string {
  const onderwerp = "Jouw persoonlijke DogWare-demo staat klaar";
  return opts.test ? `TEST — ${onderwerp}` : onderwerp;
}

export function DemoReadyEmail({
  firstName,
  bedrijfsnaam,
  demoUrl,
  portaalUrl,
  loginEmail,
  diensten = [],
  functies = [],
}: DemoReadyContent) {
  const naam = firstName?.trim();
  const bedrijf = bedrijfsnaam?.trim();
  const login = loginEmail?.trim();
  const gekozenDiensten = schoon(diensten);
  const gekozenFuncties = schoon(functies);

  return (
    <EmailLayout
      preview="Ik ben alvast voor je aan de slag gegaan — je eerste demo staat klaar"
      heading={naam ? `Hoi ${naam},` : "Hoi,"}
    >
      <Text style={paragraph}>
        Ik ben alvast voor je aan de slag gegaan: je persoonlijke
        DogWare-demo staat klaar.
      </Text>

      <Text style={paragraph}>
        {bedrijf ? (
          <>
            Op basis van wat ik van <span style={strong}>{bedrijf}</span> weet, heb ik
          </>
        ) : (
          <>Op basis van je aanvraag heb ik</>
        )}{" "}
        een eerste versie gemaakt van hoe jouw website en jouw omgeving eruit zouden
        kunnen zien.
      </Text>

      {demoUrl && (
        <>
          <PrimaireKnop href={demoUrl}>Bekijk jouw demo</PrimaireKnop>
          <Text style={{ ...paragraph, ...klein, textAlign: "center" as const }}>
            Werkt de knop niet? Open dan{" "}
            <a href={demoUrl} style={link}>
              {kortLink(demoUrl)}
            </a>
          </Text>
        </>
      )}

      <Text style={paragraph}>
        Zie het vooral als een eerste indruk, niet als een definitief ontwerp. De
        uitstraling, de kleuren, de foto&apos;s, de teksten, de pagina&apos;s — het staat
        allemaal nog open. Word je enthousiast van de richting, dan kijk ik graag
        samen met je hoe we het helemaal naar jouw wens maken.
      </Text>

      {portaalUrl && (
        <>
          <Hr style={lijn} />

          <Text style={kopje}>Er zit meer achter dan een website</Text>
          <Text style={paragraph}>
            Je kijkt niet alleen naar een website. In de demo kun je ook ervaren hoe
            DogWare achter die website{bedrijf ? ` voor ${bedrijf}` : ""} kan werken.
          </Text>

          <TweedeKnop href={portaalUrl}>Log in in jouw demoportaal</TweedeKnop>

          <Text style={paragraph}>
            {login ? (
              <>
                Log in met <span style={strong}>{login}</span> — hetzelfde adres als in je
                aanvraag. Je krijgt een inlogmail van me, dus je hoeft geen wachtwoord te
                onthouden.
              </>
            ) : (
              <>
                Log in met het e-mailadres waarmee je de demo hebt aangevraagd. Je krijgt
                een inlogmail, dus je hoeft geen wachtwoord te onthouden.
              </>
            )}{" "}
            Kijk daarna rustig rond.
          </Text>

          {(gekozenDiensten.length > 0 || gekozenFuncties.length > 0) && (
            <Text style={paragraph}>
              Zo krijg je een beeld van hoe{" "}
              <span style={strong}>{opsomming([...gekozenDiensten, ...gekozenFuncties])}</span>{" "}
              straks vanuit één omgeving kunnen samenwerken.
            </Text>
          )}
        </>
      )}

      <Hr style={lijn} />

      <Text style={kopje}>Mis je iets?</Text>
      <Text style={paragraph}>
        Dat is juist waardevolle feedback. DogWare wordt voor{" "}
        {bedrijf ? bedrijf : "jouw bedrijf"} ingericht: niet alleen de uitstraling kan
        anders, ook de functionaliteit. Is er iets wat je nodig hebt om makkelijker te
        werken — een pagina, een formulier, een stukje planning of iets wat automatisch
        moet gaan — dan hoor ik dat graag. Meestal kunnen we het gewoon bouwen.
      </Text>

      <Hr style={lijn} />

      <Text style={paragraph}>
        Ik ben vooral heel benieuwd wat je ervan vindt. Wat spreekt je aan? Wat zou je
        anders willen? En mis je nog iets waarvan je denkt: als dát erin zou zitten, werd
        het pas echt interessant voor mij?
      </Text>

      <Text style={paragraph}>
        Je mag gewoon op deze mail reageren. Kijk je liever even samen? Bel of app me,
        dan plannen we een moment en lopen we de demo rustig samen door.
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

      <Signature groet="Kwispelende groet," />
    </EmailLayout>
  );
}

/* ---------- Knoppen ---------- */

/**
 * De belangrijkste actie van deze mail: de demo bekijken. Bewust groter en in
 * de merkkleur; op een telefoon vult hij de breedte, zodat hij met één duim
 * te raken is.
 */
function PrimaireKnop({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ padding: "6px 0 4px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: emailColors.brand,
          borderRadius: 999,
          color: "#ffffff",
          display: "block",
          fontSize: 17,
          fontWeight: 700,
          padding: "16px 24px",
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/** De tweede actie: het demoportaal. Rustiger, zodat de demo vooraan blijft staan. */
function TweedeKnop({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ padding: "6px 0 10px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: "#ffffff",
          border: `2px solid ${emailColors.ink}`,
          borderRadius: 999,
          color: emailColors.ink,
          display: "block",
          fontSize: 15,
          fontWeight: 700,
          padding: "12px 24px",
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/* ---------- Stijlen ---------- */

const kopje = {
  color: emailColors.ink,
  fontSize: 16,
  fontWeight: 700,
  lineHeight: "22px",
  margin: "0 0 8px",
} as const;

const klein = {
  color: emailColors.inkSoft,
  fontSize: 12,
  lineHeight: "18px",
  margin: "0 0 10px",
} as const;

const lijn = {
  borderColor: emailColors.line,
  margin: "22px 0",
} as const;

const link = {
  color: emailColors.brand,
  textDecoration: "underline",
} as const;

/* ---------- Hulpjes ---------- */

function schoon(items: string[]): string[] {
  const uniek: string[] = [];
  for (const item of items) {
    const waarde = item?.trim();
    if (waarde && !uniek.some((u) => u.toLowerCase() === waarde.toLowerCase())) {
      uniek.push(waarde);
    }
  }
  return uniek;
}

/**
 * Nette Nederlandse opsomming met een kleine letter, zodat hij midden in een
 * zin past: "online boeken, betalen en je klantportaal".
 */
function opsomming(items: string[]): string {
  const laag = items.map((i) => (i === i.toUpperCase() ? i : ontHoofdletter(i)));
  if (laag.length <= 1) return laag[0] ?? "";
  return `${laag.slice(0, -1).join(", ")} en ${laag[laag.length - 1]}`;
}

function ontHoofdletter(waarde: string): string {
  return waarde.charAt(0).toLowerCase() + waarde.slice(1);
}

/** Leesbare fallback-link onder de knop — zonder protocol en zonder slotslash. */
function kortLink(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
