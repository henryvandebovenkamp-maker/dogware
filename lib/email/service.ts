import "server-only";
import { render } from "@react-email/render";
import { Resend } from "resend";
import type { MailError, MailOptions, MailResult, MailType } from "./types";
import { defaultEmailLogoUrl, getEmailLogoUrl } from "@/lib/site-settings";

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

/**
 * Sandbox-modus: zolang je nog geen eigen domein bij Resend hebt geverifieerd,
 * mag het proefadres onboarding@resend.dev alléén naar je eigen Resend-adres
 * sturen. In plaats van te falen, sturen we élke mail dan naar dat adres
 * (EMAIL_SANDBOX_TO) met de bedoelde ontvanger in het onderwerp — zodat de
 * hele flow gewoon werkt tijdens het testen. Zodra EMAIL_FROM een eigen
 * (geverifieerd) domein gebruikt, stopt dit automatisch.
 */
function getSandboxRedirect(from: string): string | null {
  const usesSandboxSender = /@resend\.dev>?\s*$/i.test(from.trim());
  const to = process.env.EMAIL_SANDBOX_TO?.trim();
  if (usesSandboxSender && to) return to;
  return null;
}

/** Is de mailservice in sandbox-testmodus (nog geen eigen domein)? */
export function isEmailSandbox(): boolean {
  const from = process.env.EMAIL_FROM ?? "";
  return getSandboxRedirect(from) !== null;
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

  // Super Admin-logo-override: als die is ingesteld, renderen we de React-mail
  // zelf naar HTML en wisselen we de default-logo-URL om. Zo hoeft geen enkele
  // template te weten van de override en vermijden we een client/server-context.
  let reactToSend = options.react;
  let htmlToSend = options.html;
  if (options.react) {
    const emailLogoUrl = await getEmailLogoUrl();
    const defaultLogo = defaultEmailLogoUrl();
    if (emailLogoUrl && emailLogoUrl !== defaultLogo) {
      const rendered = await render(options.react);
      htmlToSend = rendered.split(defaultLogo).join(emailLogoUrl);
      reactToSend = undefined; // niet dubbel: óf react óf html
    }
  }

  // Sandbox: alle mail omleiden naar het testadres zodat er niets faalt.
  const sandboxTo = getSandboxRedirect(config.from);
  const origineleOntvanger = Array.isArray(options.to)
    ? options.to.join(", ")
    : options.to;
  const payload = {
    from: config.from,
    to: sandboxTo ?? options.to,
    subject: sandboxTo
      ? `[TEST → ${origineleOntvanger}] ${options.subject}`
      : options.subject,
    react: reactToSend,
    html: htmlToSend,
    text: options.text,
    replyTo: options.replyTo ?? config.replyTo,
    // In sandbox geen cc/bcc naar echte ontvangers sturen
    cc: sandboxTo ? undefined : options.cc,
    bcc: sandboxTo ? undefined : options.bcc,
    attachments: options.attachments,
  };

  if (sandboxTo) {
    logMail("info", "email.sandbox_redirect", {
      type,
      intended: origineleOntvanger,
      redirected_to: sandboxTo,
    });
  }

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
