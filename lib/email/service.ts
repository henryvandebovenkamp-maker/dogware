import "server-only";
import { Resend } from "resend";
import type { MailError, MailOptions, MailResult, MailType } from "./types";

/**
 * Centrale mailservice van DogWare.
 *
 * Alle e-mail verloopt via deze service — nergens anders mag de Resend SDK
 * rechtstreeks worden aangeroepen. Configuratie uitsluitend via environment
 * variables: RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO (optioneel),
 * EMAIL_INTERNAL (ontvanger van interne notificaties).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
  };
}

/** Is de mailservice volledig geconfigureerd? */
export function isEmailConfigured(): boolean {
  return getConfig() !== null;
}

function validate(options: MailOptions): MailError | null {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  if (recipients.length === 0) {
    return { code: "INVALID_RECIPIENT", message: "Geen ontvanger opgegeven." };
  }
  for (const to of recipients) {
    if (!to || !EMAIL_REGEX.test(to)) {
      return {
        code: "INVALID_RECIPIENT",
        message: "Ongeldig e-mailadres als ontvanger.",
      };
    }
  }
  if (!options.subject?.trim()) {
    return { code: "INVALID_SUBJECT", message: "Onderwerp is leeg." };
  }
  if (!options.react && !options.html?.trim() && !options.text?.trim()) {
    return { code: "EMPTY_BODY", message: "E-mail heeft geen inhoud." };
  }
  return null;
}

/** Gestructureerde log zonder secrets. */
function logMail(
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown>,
) {
  const line = JSON.stringify({
    evt: event,
    at: new Date().toISOString(),
    ...data,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/**
 * Verstuur een e-mail via Resend.
 *
 * Gooit nooit een exception — geeft altijd een `MailResult` terug, zodat de
 * applicatie stabiel blijft als Resend niet geconfigureerd of bereikbaar is.
 * Bij een netwerkfout wordt één keer opnieuw geprobeerd.
 */
export async function sendMail(
  type: MailType,
  options: MailOptions,
): Promise<MailResult> {
  const config = getConfig();
  if (!config) {
    logMail("warn", "email.not_configured", {
      type,
      hint: "Zet RESEND_API_KEY en EMAIL_FROM in de environment variables.",
    });
    return {
      ok: false,
      error: {
        code: "NOT_CONFIGURED",
        message:
          "E-mailservice is niet geconfigureerd. RESEND_API_KEY en EMAIL_FROM ontbreken.",
      },
    };
  }

  const invalid = validate(options);
  if (invalid) {
    logMail("warn", "email.invalid", { type, code: invalid.code });
    return { ok: false, error: invalid };
  }

  const resend = new Resend(config.apiKey);
  const payload = {
    from: config.from,
    to: options.to,
    subject: options.subject,
    react: options.react,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo ?? config.replyTo,
    cc: options.cc,
    bcc: options.bcc,
    attachments: options.attachments,
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await resend.emails.send(payload);

      if (error) {
        // API-fout (bijv. ongeldig domein) — opnieuw proberen heeft geen zin.
        logMail("error", "email.provider_error", {
          type,
          to: options.to,
          subject: options.subject,
          provider_error: error.message,
        });
        return {
          ok: false,
          error: {
            code: "PROVIDER_ERROR",
            message: `Versturen mislukt: ${error.message}`,
          },
        };
      }

      logMail("info", "email.sent", {
        type,
        to: options.to,
        subject: options.subject,
        id: data?.id,
        attempt,
      });
      return { ok: true, id: data?.id ?? "unknown" };
    } catch (err) {
      // Netwerkfout — één retry, daarna netjes opgeven.
      const message = err instanceof Error ? err.message : "Onbekende fout";
      logMail("error", "email.network_error", {
        type,
        to: options.to,
        attempt,
        error: message,
      });
      if (attempt === maxAttempts) {
        return {
          ok: false,
          error: {
            code: "NETWORK_ERROR",
            message: "E-mailservice is tijdelijk niet bereikbaar.",
          },
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Onbereikbaar, maar TypeScript wil een sluitend pad.
  return {
    ok: false,
    error: { code: "NETWORK_ERROR", message: "Versturen mislukt." },
  };
}
