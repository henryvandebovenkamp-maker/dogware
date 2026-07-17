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
export async function sendDemoReady(
  to: string,
  naam: string,
  bedrijfsnaam: string,
  loginUrl: string,
  demoUrl?: string,
): Promise<MailResult> {
  return sendMail("demo-ready", {
    to,
    subject: `Je persoonlijke DogWare-voorbeeld staat klaar, ${naam}`,
    react: (
      <DemoReadyEmail
        naam={naam}
        bedrijfsnaam={bedrijfsnaam}
        demoUrl={demoUrl}
        loginUrl={loginUrl}
      />
    ),
    text: `Hoi ${naam},\n\nJe persoonlijke DogWare-voorbeeld voor ${bedrijfsnaam} staat klaar.\n${demoUrl ? `Voorbeeldwebsite: ${demoUrl}\n` : ""}Log veilig in (zonder wachtwoord): ${loginUrl}\n\nBenieuwd wat je ervan vindt!\n\nHartelijke groet,\nHenry van de Bovenkamp\nDogWare`,
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
