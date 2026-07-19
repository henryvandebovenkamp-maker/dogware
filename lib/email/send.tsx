import "server-only";
import { sendMail } from "./service";
import type { MailResult } from "./types";
import type { IntakeData } from "@/lib/intake";
import { DemoConfirmationEmail } from "./templates/demo-confirmation";
import { DemoRequestEmail, type DemoRequestData } from "./templates/demo-request";
import { IntakeConfirmationEmail } from "./templates/intake-confirmation";
import { IntakeNotificationEmail } from "./templates/intake-notification";
import { NotificationEmail } from "./templates/notification";
import { PartnerActivatedEmail } from "./templates/partner-activated";
import { PartnerDemoSentEmail } from "./templates/partner-demo-sent";
import { PartnerInviteEmail } from "./templates/partner-invite";
import { MagicLoginEmail } from "./templates/magic-login";
import { DemoReadyEmail } from "./templates/demo-ready";
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

/** Warme mail: de voorbeeldwebsite staat klaar (met passwordless magic login). */
/**
 * Persoonlijk eerste voorbeeld. Alle inhoud komt uit de aanvraag:
 * @param firstName    voornaam uit de aanvraag
 * @param portaalUrl   link naar het demoportaal (login met het bekende mailadres)
 * @param demoUrl      link naar de voorbeeldwebsite (optioneel)
 * @param modules      door de klant geselecteerde onderdelen (leesbare labels)
 * @param bedrijfsnaam alleen meesturen als die is ingevuld — nooit verzinnen
 */
export async function sendDemoReady(
  to: string,
  firstName: string,
  portaalUrl: string,
  demoUrl?: string,
  modules: string[] = [],
  bedrijfsnaam?: string,
): Promise<MailResult> {
  const gekozen = modules.map((m) => m.trim()).filter(Boolean);
  return sendMail("demo-ready", {
    to,
    subject: `Je persoonlijke DogWare-voorbeeld staat klaar, ${firstName}`,
    react: (
      <DemoReadyEmail
        firstName={firstName}
        bedrijfsnaam={bedrijfsnaam}
        modules={gekozen}
        demoUrl={demoUrl}
        portaalUrl={portaalUrl}
      />
    ),
    text:
      `Hi ${firstName},\n\n` +
      `Bedankt voor je aanvraag! Ik ben meteen even voor je aan de slag gegaan.\n\n` +
      (gekozen.length
        ? `Ik zag dat je vooral interesse hebt in ${gekozen.join(", ")}, dus daar heb ik in dit eerste voorbeeld alvast extra aandacht aan besteed. Zo krijg je direct een goed beeld van wat er allemaal mogelijk is.\n\n`
        : `Ik heb goed naar je aanvraag gekeken en daar in dit eerste voorbeeld alvast extra aandacht aan besteed. Zo krijg je direct een goed beeld van wat er allemaal mogelijk is.\n\n`) +
      (demoUrl ? `Bekijk jouw voorbeeldwebsite: ${demoUrl}\n\n` : "") +
      `Ben je ook benieuwd hoe de beheeromgeving werkt? Log in met hetzelfde e-mailadres waarmee je de demo hebt aangevraagd. Je ontvangt automatisch een e-mail waarmee je veilig kunt inloggen. Simpel en zonder wachtwoord.\n` +
      `Inloggen in jouw demo: ${portaalUrl}\n\n` +
      `Kijk er rustig even doorheen. Grote kans dat je meteen ideeën of vragen krijgt.\n\n` +
      `Vind je het leuk om alles even samen door te nemen? Bel me gerust of stuur even een appje. In ongeveer 15 minuten laat ik je zien hoe alles werkt en kun je al je vragen stellen.\n` +
      `06-83853373\n\n` +
      `Veel kijkplezier!\n\n` +
      `Met vriendelijke groet,\nHenry van de Bovenkamp\nDogWare`,
  });
}

/** Commerciële journey-mails (voorstel, betalingen, abonnement). */
export async function sendCommerceMail(
  type: CommerceMailType,
  to: string,
  naam: string,
  vars: { amount?: string; extra?: string } = {},
): Promise<MailResult> {
  const subjects: Record<CommerceMailType, string> = {
    "proposal-sent": "Je persoonlijke voorstel van DogWare",
    "deposit-ready": "We kunnen beginnen — de eerste termijn staat klaar",
    "deposit-received": "Ontvangen! We gaan jouw DogWare bouwen",
    "delivery-ready": "Je DogWare-omgeving is klaar",
    "final-ready": "De laatste termijn staat voor je klaar",
    "final-received": "Helemaal rond — bedankt!",
    "subscription-started": "Welkom als vaste DogWare-klant",
    "charge-failed": "Je maandbetaling is nog niet gelukt",
  };
  return sendMail(type === "charge-failed" ? "notification" : "demo-ready", {
    to,
    subject: subjects[type],
    react: (
      <CommerceEmail
        type={type}
        naam={naam.split(" ")[0]}
        ctaUrl={`${branding.siteUrl}/account`}
        vars={vars}
      />
    ),
    text: `${subjects[type]}${vars.amount ? ` — ${vars.amount}` : ""}. Bekijk het in je omgeving: ${branding.siteUrl}/account`,
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
