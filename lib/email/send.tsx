import "server-only";
import { renderMailHtml, sendMail } from "./service";
import type { MailResult } from "./types";
import type { IntakeData } from "@/lib/intake";
import { DemoConfirmationEmail } from "./templates/demo-confirmation";
import { DemoRequestEmail, type DemoRequestData } from "./templates/demo-request";
import { IntakeConfirmationEmail } from "./templates/intake-confirmation";
import { IntakeNotificationEmail } from "./templates/intake-notification";
import {
  ContactMessageEmail,
  type ContactMessageData,
} from "./templates/contact-message";
import { ContactConfirmationEmail } from "./templates/contact-confirmation";
import { NotificationEmail } from "./templates/notification";
import { GroeiBerichtEmail } from "./templates/groei-bericht";
import { PartnerActivatedEmail } from "./templates/partner-activated";
import { PartnerDemoSentEmail } from "./templates/partner-demo-sent";
import {
  PartnerMilestoneEmail,
  type PartnerMilestone,
} from "./templates/partner-milestone";
import { PartnerInviteEmail } from "./templates/partner-invite";
import { PartnerAddedEmail } from "./templates/partner-added";
import { MagicLoginEmail } from "./templates/magic-login";
import {
  DemoReadyEmail,
  demoReadySubject,
  DEMO_READY_TEMPLATE_VERSION,
  type DemoReadyContent,
} from "./templates/demo-ready";
import { CommerceEmail, type CommerceMailType } from "./templates/commerce";
import { branding } from "@/lib/branding";
import { WelcomeEmail } from "./templates/welcome";

/**
 * Helper-functies per mailtype. De rest van de applicatie gebruikt uitsluitend
 * deze functies en hoeft niets van Resend of templates te weten.
 */

/** Interne notificatie van een nieuwe demo-aanvraag (naar EMAIL_INTERNAL). */
export async function sendDemoRequestNotification(
  data: DemoRequestData,
): Promise<MailResult> {
  const internal = process.env.EMAIL_INTERNAL;
  if (!internal) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "EMAIL_INTERNAL ontbreekt in de environment variables.",
      },
    };
  }
  return sendMail("demo-request", {
    to: internal,
    subject: `Nieuwe demo-aanvraag: ${data.naam} (${data.bedrijf})`,
    react: <DemoRequestEmail {...data} />,
    replyTo: data.email,
    text: `Nieuwe demo-aanvraag.\nNaam: ${data.naam}\nBedrijf: ${data.bedrijf}\nE-mail: ${data.email}\nVakgebied: ${data.type}`,
  });
}

/** Bevestiging aan de aanvrager van een demo. */
export async function sendDemoConfirmation(
  to: string,
  naam: string,
): Promise<MailResult> {
  return sendMail("demo-confirmation", {
    to,
    subject: "We hebben je demo-aanvraag ontvangen 🐾",
    react: <DemoConfirmationEmail naam={naam} />,
    text: `Hoi ${naam},\n\nWe hebben je demo-aanvraag voor DogWare ontvangen en nemen binnen 1 werkdag contact met je op.\n\nHartelijke groet,\nHenry van de Bovenkamp\nDogWare`,
  });
}

/** Interne mail met de volledige intake van een persoonlijke-demo-aanvraag. */
export async function sendIntakeNotification(
  data: IntakeData,
  leadUrl?: string,
  viaPartner?: string,
): Promise<MailResult> {
  const internal = process.env.EMAIL_INTERNAL;
  if (!internal) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "EMAIL_INTERNAL ontbreekt in de environment variables.",
      },
    };
  }
  return sendMail("intake-request", {
    to: internal,
    subject: `Persoonlijke demo-aanvraag: ${data.naam} (${data.bedrijfsnaam})`,
    react: (
      <IntakeNotificationEmail data={data} leadUrl={leadUrl} viaPartner={viaPartner} />
    ),
    replyTo: data.email,
    text: `Persoonlijke demo-aanvraag van ${data.naam} (${data.bedrijfsnaam}, ${data.plaats}) — ${data.email}${viaPartner ? `\nVia partner: ${viaPartner}` : ""}`,
  });
}

/** Persoonlijke bevestiging aan de aanvrager van een demo-intake. */
export async function sendIntakeConfirmation(
  to: string,
  naam: string,
): Promise<MailResult> {
  return sendMail("intake-confirmation", {
    to,
    subject: "Jouw persoonlijke DogWare-voorbeeld is onderweg 🐾",
    react: <IntakeConfirmationEmail naam={naam} />,
    text: `Hoi ${naam},\n\nBedankt voor je aanvraag! Binnen 24 uur ontvang je geen offerte, maar een kosteloos voorbeeld van hoe jouw eigen DogWare-omgeving eruit kan zien. Je zit nergens aan vast.\n\nHartelijke groet,\nHenry van de Bovenkamp\nDogWare`,
  });
}

/** Interne mail: een bezoeker vulde het contactformulier in. */
export async function sendContactNotification(
  data: ContactMessageData,
): Promise<MailResult> {
  const internal = process.env.EMAIL_INTERNAL;
  if (!internal) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "EMAIL_INTERNAL ontbreekt in de environment variables.",
      },
    };
  }
  return sendMail("contact-message", {
    to: internal,
    subject: `Bericht via de website: ${data.naam}`,
    react: <ContactMessageEmail {...data} />,
    // Zo is antwoorden vanuit de mailbox meteen antwoorden aan de bezoeker.
    replyTo: data.email,
    text: `Bericht via het contactformulier.\nNaam: ${data.naam}\nE-mail: ${data.email}${data.telefoon ? `\nTelefoon: ${data.telefoon}` : ""}${data.herkomst ? `\nPagina: ${data.herkomst}` : ""}\n\n${data.bericht}`,
  });
}

/** Persoonlijke bevestiging aan wie het contactformulier invulde. */
export async function sendContactConfirmation(
  to: string,
  naam: string,
  bericht: string,
): Promise<MailResult> {
  return sendMail("contact-confirmation", {
    to,
    subject: "Je bericht is binnen 🐾",
    react: <ContactConfirmationEmail naam={naam} bericht={bericht} />,
    text: `Hoi ${naam},\n\nBedankt voor je bericht. Het komt rechtstreeks bij mij binnen, niet bij een helpdesk. Je krijgt gewoon antwoord van mij.\n\nHartelijke groet,\nHenry van de Bovenkamp\nDogWare`,
  });
}

/** Welkomstmail — voor toekomstige accounts/onboarding. */
export async function sendWelcomeEmail(
  to: string,
  naam: string,
): Promise<MailResult> {
  return sendMail("welcome", {
    to,
    subject: "Welkom bij DogWare 🐾",
    react: <WelcomeEmail naam={naam} />,
    text: `Welkom bij DogWare, ${naam}!`,
  });
}

/** Uitnodiging voor het Partnerprogramma (nieuw of opnieuw verstuurd). */
export async function sendPartnerInvite(
  to: string,
  naam: string,
  inviteUrl: string,
  opnieuw = false,
): Promise<MailResult> {
  return sendMail("partner-invite", {
    to,
    subject: opnieuw
      ? "Je nieuwe uitnodiging voor het DogWare Partnerprogramma"
      : "Uitnodiging: het DogWare Partnerprogramma 🤝",
    react: <PartnerInviteEmail naam={naam} inviteUrl={inviteUrl} opnieuw={opnieuw} />,
    text: `Hoi ${naam},\n\nJe bent uitgenodigd voor het DogWare Partnerprogramma. Activeer je account via: ${inviteUrl}\n\nDeze link is 7 dagen geldig en werkt één keer.`,
  });
}

/**
 * Partneromgeving toegevoegd aan een bestaand, al gebruikt DogWare-account.
 * Bewust géén activatielink: dit account bestaat al en logt in zoals altijd.
 */
export async function sendPartnerAdded(
  to: string,
  naam: string,
  referralLink: string,
  portalUrl: string,
  opnieuw = false,
): Promise<MailResult> {
  return sendMail("partner-added", {
    to,
    subject: opnieuw
      ? "Nogmaals: je persoonlijke DogWare-partnerlink"
      : "Je partneromgeving staat klaar in je DogWare-account 🤝",
    react: (
      <PartnerAddedEmail
        naam={naam}
        referralLink={referralLink}
        portalUrl={portalUrl}
        opnieuw={opnieuw}
      />
    ),
    text: `Hoi ${naam},\n\nJe partneromgeving is toegevoegd aan je bestaande DogWare-account — er is geen tweede account gemaakt.\n\nJouw persoonlijke link: ${referralLink}\nJe partneromgeving: ${portalUrl}\n\nJe logt in met hetzelfde e-mailadres als altijd.`,
  });
}

/** Bevestiging dat het partneraccount actief is. */
export async function sendPartnerActivated(
  to: string,
  naam: string,
  referralLink: string,
  portalUrl: string,
): Promise<MailResult> {
  return sendMail("partner-activated", {
    to,
    subject: "Je partneraccount is actief — hier is je persoonlijke link",
    react: (
      <PartnerActivatedEmail
        naam={naam}
        referralLink={referralLink}
        portalUrl={portalUrl}
      />
    ),
    text: `Hoi ${naam},\n\nJe partneraccount is actief. Jouw persoonlijke link: ${referralLink}\nJe omgeving: ${portalUrl}`,
  });
}

/**
 * Automatisch berichtje aan de partner zodra de demo naar de klant is
 * verstuurd. Alleen versturen bij een partner-/affiliate-aanvraag.
 *
 * @param demoUrl     UITSLUITEND de publieke voorbeeldwebsite — nooit de
 *                    loginlink, magic link of beheeromgeving.
 * @param companyName alleen meesturen als die is ingevuld — nooit verzinnen.
 */
export async function sendPartnerDemoSent(
  to: string,
  partnerFirstName: string,
  demoUrl?: string,
  companyName?: string,
): Promise<MailResult> {
  return sendMail("partner-demo-sent", {
    to,
    subject: "Leuk nieuws! De demo is verstuurd 🎉",
    react: (
      <PartnerDemoSentEmail
        partnerFirstName={partnerFirstName}
        companyName={companyName}
        demoUrl={demoUrl}
      />
    ),
    text:
      `Hi ${partnerFirstName},\n\n` +
      `Even een leuk berichtje! De demo${companyName ? ` voor ${companyName}` : ""} staat inmiddels klaar en is verstuurd. ` +
      `Bedankt dat je DogWare hebt aanbevolen, dat waardeer ik enorm.\n\n` +
      (demoUrl ? `Bekijk de demo (voorbeeldwebsite): ${demoUrl}\n\n` : "") +
      `Zodra ik een reactie krijg of we een vervolgstap zetten, laat ik het je natuurlijk weten.\n\n` +
      `Met kwispelende groet,\nHenry van de Bovenkamp\nDogWare\n${branding.phone}`,
  });
}

/**
 * Voortgangsbericht aan de partner ná de demo: voorstel verstuurd, klant
 * akkoord, overeenkomst getekend.
 *
 * Bewust zonder klantlink en zonder bedragen — de enige knop wijst naar de
 * eigen partneromgeving. Zie de template voor de reden.
 *
 * @param companyName alleen meesturen als die is ingevuld — nooit verzinnen.
 */
export async function sendPartnerMilestone(
  to: string,
  partnerFirstName: string,
  milestone: PartnerMilestone,
  companyName?: string,
): Promise<MailResult> {
  const onderwerpen: Record<PartnerMilestone, string> = {
    "voorstel-verstuurd": "Update: het voorstel is verstuurd",
    "voorstel-akkoord": "Mooi nieuws! Het voorstel is geaccepteerd \u{1F389}",
    "overeenkomst-getekend": "Het is rond — de overeenkomst is getekend \u{1F58A}\uFE0F",
  };
  const kern: Record<PartnerMilestone, string> = {
    "voorstel-verstuurd":
      "heeft zojuist het voorstel ontvangen. Nu even afwachten wat ze ervan vinden.",
    "voorstel-akkoord":
      "is akkoord met het voorstel. De samenwerkingsovereenkomst staat voor ze klaar om te tekenen.",
    "overeenkomst-getekend":
      "heeft de samenwerkingsovereenkomst getekend. Je commissie staat vanaf nu als gereserveerd in je partneromgeving.",
  };
  const wie = companyName?.trim() || "De klant die jij aanbracht";
  return sendMail("partner-milestone", {
    to,
    subject: onderwerpen[milestone],
    react: (
      <PartnerMilestoneEmail
        partnerFirstName={partnerFirstName}
        milestone={milestone}
        companyName={companyName}
      />
    ),
    text:
      `Hi ${partnerFirstName},\n\n` +
      `${wie} ${kern[milestone]}\n\n` +
      `Je partneromgeving: ${branding.siteUrl}/partner\n\n` +
      `Met kwispelende groet,\nHenry van de Bovenkamp\nDogWare\n${branding.phone}`,
  });
}

/** Wachtwoordloze inlogmail: Magic Link + Magic Code. */
export async function sendMagicLogin(
  to: string,
  naam: string,
  loginUrl: string,
  code: string,
  geldigMinuten: number,
): Promise<MailResult> {
  return sendMail("magic-login", {
    to,
    subject: `${code.slice(0, 3)} ${code.slice(3)} is je DogWare-inlogcode`,
    react: (
      <MagicLoginEmail
        naam={naam}
        loginUrl={loginUrl}
        code={code}
        geldigMinuten={geldigMinuten}
      />
    ),
    text: `Hoi ${naam},\n\nLog in via: ${loginUrl}\nOf gebruik code: ${code}\n\nGeldig: ${geldigMinuten} minuten, eenmalig. Niet aangevraagd? Negeer deze mail.`,
  });
}

/* ---------- "Jouw persoonlijke DogWare-demo staat klaar" ---------- */

export type { DemoReadyContent };
export { DEMO_READY_TEMPLATE_VERSION, demoReadySubject };

/**
 * De platte-tekstversie van de demo-mail.
 *
 * Niet optioneel: een mail die alleen uit HTML bestaat is een spamsignaal, en
 * sommige mailclients tonen niets anders. Hij volgt dezelfde volgorde als de
 * HTML, met dezelfde links — zodat een klant in tekstweergave niets mist.
 */
/** Nette Nederlandse opsomming met kleine letter, gelijk aan de HTML-versie. */
function nlOpsomming(items: string[]): string {
  const laag = items.map((i) =>
    i === i.toUpperCase() ? i : i.charAt(0).toLowerCase() + i.slice(1),
  );
  if (laag.length <= 1) return laag[0] ?? "";
  return `${laag.slice(0, -1).join(", ")} en ${laag[laag.length - 1]}`;
}

function demoReadyText(data: DemoReadyContent): string {
  const naam = data.firstName?.trim();
  const bedrijf = data.bedrijfsnaam?.trim();
  const login = data.loginEmail?.trim();
  const onderdelen = [...(data.diensten ?? []), ...(data.functies ?? [])]
    .map((m) => m.trim())
    .filter(Boolean);

  return [
    naam ? `Hoi ${naam},` : "Hoi,",
    "",
    "Ik ben alvast voor je aan de slag gegaan: je persoonlijke DogWare-demo staat klaar.",
    "",
    bedrijf
      ? `Op basis van wat ik van ${bedrijf} weet, heb ik een eerste versie gemaakt van hoe jouw website en jouw omgeving eruit zouden kunnen zien.`
      : "Op basis van je aanvraag heb ik een eerste versie gemaakt van hoe jouw website en jouw omgeving eruit zouden kunnen zien.",
    "",
    data.demoUrl ? `Bekijk jouw demo: ${data.demoUrl}` : "",
    "",
    "Zie het vooral als een eerste indruk, niet als een definitief ontwerp. De uitstraling, de kleuren, de foto's, de teksten, de pagina's — het staat allemaal nog open. Word je enthousiast van de richting, dan kijk ik graag samen met je hoe we het helemaal naar jouw wens maken.",
    "",
    data.portaalUrl
      ? [
          "ER ZIT MEER ACHTER DAN EEN WEBSITE",
          `Je kijkt niet alleen naar een website. In de demo kun je ook ervaren hoe DogWare achter die website${bedrijf ? ` voor ${bedrijf}` : ""} kan werken.`,
          "",
          `Log in in jouw demoportaal: ${data.portaalUrl}`,
          login
            ? `Log in met ${login} — hetzelfde adres als in je aanvraag. Je krijgt een inlogmail van me, dus je hoeft geen wachtwoord te onthouden.`
            : "Log in met het e-mailadres waarmee je de demo hebt aangevraagd. Je krijgt een inlogmail, dus je hoeft geen wachtwoord te onthouden.",
          onderdelen.length
            ? `Zo krijg je een beeld van hoe ${nlOpsomming(onderdelen)} straks vanuit één omgeving kunnen samenwerken.`
            : "",
          "",
        ].join("\n")
      : "",
    "MIS JE IETS?",
    `Dat is juist waardevolle feedback. DogWare wordt voor ${bedrijf || "jouw bedrijf"} ingericht: niet alleen de uitstraling kan anders, ook de functionaliteit. Is er iets wat je nodig hebt om makkelijker te werken, dan hoor ik dat graag. Meestal kunnen we het gewoon bouwen.`,
    "",
    "Ik ben vooral heel benieuwd wat je ervan vindt. Wat spreekt je aan? Wat zou je anders willen? En mis je nog iets waarvan je denkt: als dát erin zou zitten, werd het pas echt interessant voor mij?",
    "",
    "Je mag gewoon op deze mail reageren. Kijk je liever even samen? Bel of app me, dan plannen we een moment en lopen we de demo rustig samen door.",
    branding.phone,
    "",
    "Kwispelende groet,",
    "",
    "Henry van de Bovenkamp",
    "DogWare",
  ]
    .filter((regel, i, alle) => !(regel === "" && alle[i - 1] === ""))
    .join("\n");
}

/**
 * De demo-mail aan de potentiële klant.
 *
 * Alle inhoud komt uit de aanvraag (zie `DemoReadyContent`) — deze functie
 * verzint niets en vult niets aan. Ontbreekt de demo- of portaal-URL, dan
 * vervalt dat blok in de mail; de admin-actie hoort dat vóór verzending al af
 * te vangen, zodat een klant nooit een halve mail krijgt.
 *
 * @param opts.test  Testmail: het onderwerp krijgt "TEST — " ervoor. De
 *                   aanroeper is verantwoordelijk voor het níét bijwerken van
 *                   de journey; deze functie raakt geen enkele status aan.
 */
export async function sendDemoReady(
  to: string,
  data: DemoReadyContent,
  opts: { test?: boolean } = {},
): Promise<MailResult> {
  return sendMail("demo-ready", {
    to,
    subject: demoReadySubject({ test: opts.test }),
    react: <DemoReadyEmail {...data} />,
    text: opts.test
      ? `TEST — deze mail is een testverzending.\n\n${demoReadyText(data)}`
      : demoReadyText(data),
  });
}

/**
 * De demo-mail renderen zonder hem te versturen — voor de preview in de admin.
 * Gebruikt exact dezelfde template, hetzelfde onderwerp en dezelfde logo-logica
 * als het echte versturen, zodat een preview geen aparte waarheid wordt.
 */
export async function renderDemoReady(
  data: DemoReadyContent,
  opts: { test?: boolean } = {},
): Promise<{ subject: string; html: string; text: string }> {
  return {
    subject: demoReadySubject({ test: opts.test }),
    html: await renderMailHtml(<DemoReadyEmail {...data} />),
    text: demoReadyText(data),
  };
}

/** Commerciële journey-mails (voorstel, betalingen, abonnement). */
export async function sendCommerceMail(
  type: CommerceMailType,
  to: string,
  naam: string,
  vars: { amount?: string; extra?: string } = {},
  /**
   * Persoonlijke, beveiligde link naar de klantomgeving. Zonder deze link valt
   * de mail terug op /account — dat werkt alleen voor wie al een account
   * heeft, dus geef hem altijd mee als je hem hebt.
   */
  ctaUrl?: string,
): Promise<MailResult> {
  const subjects: Record<CommerceMailType, string> = {
    "proposal-sent": "Je persoonlijke voorstel van DogWare",
    "proposal-reminder": "Je voorstel staat nog voor je klaar",
    "proposal-accepted": "Je akkoord is binnen — nu de overeenkomst",
    "agreement-ready": "De samenwerkingsovereenkomst staat klaar",
    "agreement-reminder": "De overeenkomst wacht nog op je handtekening",
    "agreement-signed": "Getekend — nu de eerste termijn",
    "deposit-ready": "We kunnen beginnen — de eerste termijn staat klaar",
    "deposit-reminder": "De eerste termijn staat nog open",
    "deposit-received": "Ontvangen! We gaan jouw DogWare bouwen",
    "delivery-ready": "Je DogWare-omgeving is klaar",
    "final-ready": "De laatste termijn staat voor je klaar",
    "final-reminder": "Nog één stap voor je livegang",
    "final-received": "Helemaal rond — bedankt!",
    "subscription-started": "Je DogWare-abonnement is geregeld",
    "website-live": "Je website staat live 🎉",
    "welcome-customer": "Welkom als vaste DogWare-klant",
    "charge-failed": "Je maandbetaling is nog niet gelukt",
  };
  const link = ctaUrl ?? `${branding.siteUrl}/account`;
  return sendMail(type === "charge-failed" ? "notification" : "demo-ready", {
    to,
    subject: subjects[type],
    react: (
      <CommerceEmail type={type} naam={naam.split(" ")[0]} ctaUrl={link} vars={vars} />
    ),
    text: `${subjects[type]}${vars.amount ? ` — ${vars.amount}` : ""}. Bekijk het in je omgeving: ${link}`,
  });
}

/** Generieke interne notificatie. */
export async function sendNotification(
  title: string,
  message: string,
  to?: string,
): Promise<MailResult> {
  const recipient = to ?? process.env.EMAIL_INTERNAL;
  if (!recipient) {
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message: "EMAIL_INTERNAL ontbreekt in de environment variables.",
      },
    };
  }
  return sendMail("notification", {
    to: recipient,
    subject: title,
    react: <NotificationEmail title={title} message={message} />,
    text: message,
  });
}

/**
 * Een persoonlijk bericht van Henry aan een collega-hondenbedrijf.
 *
 * Drie dingen die deze functie anders doet dan de rest:
 *
 * 1. `replyTo` gaat naar Henry's eigen adres. Antwoorden op deze mail hoort
 *    bij hem terecht te komen, niet bij een postbus die niemand leest.
 * 2. De afmeldlink zit óók in de kopregels, zodat Gmail en Outlook hun eigen
 *    afmeldknop kunnen tonen. Zonder die koppen leest een mailprovider dit
 *    als post die zich verstopt, en dat kost je bezorging.
 * 3. Er gaat een platte-tekstversie mee met dezelfde inhoud. Een mail die
 *    alleen uit HTML bestaat is een spamsignaal.
 */
export async function sendGroeiBericht(data: {
  to: string;
  onderwerp: string;
  tekst: string;
  voorstelUrl: string | null;
  afmeldUrl: string;
  afmeldEenKlikUrl: string;
  antwoordNaar?: string;
}): Promise<MailResult> {
  const platteTekst = [
    data.voorstelUrl
      ? data.tekst.replaceAll("{{voorstel}}", data.voorstelUrl)
      : data.tekst.replaceAll("{{voorstel}}", ""),
    "",
    "—",
    `Henry van de Bovenkamp · ${branding.name} · ${branding.siteUrl}`,
    `Liever geen mail meer? ${data.afmeldUrl}`,
  ].join("\n");

  return sendMail("groei-bericht", {
    to: data.to,
    subject: data.onderwerp,
    replyTo: data.antwoordNaar,
    react: (
      <GroeiBerichtEmail
        tekst={data.tekst}
        voorstelUrl={data.voorstelUrl}
        afmeldUrl={data.afmeldUrl}
        voorbeeld={data.tekst.replace(/\s+/g, " ").slice(0, 110)}
      />
    ),
    text: platteTekst,
    headers: {
      "List-Unsubscribe": `<${data.afmeldEenKlikUrl}>, <${data.afmeldUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
