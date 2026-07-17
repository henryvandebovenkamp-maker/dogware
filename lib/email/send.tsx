import "server-only";
import { sendMail } from "./service";
import type { MailResult } from "./types";
import type { IntakeData } from "@/lib/intake";
import { DemoConfirmationEmail } from "./templates/demo-confirmation";
import { DemoRequestEmail, type DemoRequestData } from "./templates/demo-request";
import { IntakeConfirmationEmail } from "./templates/intake-confirmation";
import { IntakeNotificationEmail } from "./templates/intake-notification";
import { NotificationEmail } from "./templates/notification";
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
    react: <IntakeNotificationEmail data={data} leadUrl={leadUrl} />,
    replyTo: data.email,
    text: `Persoonlijke demo-aanvraag van ${data.naam} (${data.bedrijfsnaam}, ${data.plaats}) — ${data.email}`,
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
