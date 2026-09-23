import { branding } from "@/lib/branding";
import type { MailType } from "./types";

/**
 * Centrale afzenderconfiguratie van DogWare-systeemmail.
 *
 * Twee werelden, bewust gescheiden:
 *
 *  - Persoonlijke mail van Henry (zijn eigen mailbox) loopt NIET door deze code.
 *    Die gaat via de TransIP-mailbox (IMAP/SMTP in Apple Mail).
 *  - Alles wat de applicatie zelf verstuurt, gaat via Resend en krijgt een
 *    herkenbare systeemafzender uit deze module.
 *
 * Environment variables:
 *  - EMAIL_FROM          systeemafzender, bijv. "DogWare <mail@dogware.nl>"
 *  - EMAIL_FROM_NOREPLY  optioneel, bijv. "DogWare <noreply@dogware.nl>" voor
 *                        inlogcodes; ontbreekt hij, dan valt hij terug op
 *                        EMAIL_FROM (zo breekt er niets zolang hij niet gezet is)
 *
 * Het antwoordadres staat bewust NIET in een environment variable maar in
 * `branding.replyToEmail` (zie daar waarom).
 */

/** Welke afzender een mail krijgt. */
export type SenderKind = "transactional" | "noreply" | "website";

/**
 * Afzender per mailtype. Een `Record` over alle MailTypes: voeg je een type
 * toe zonder hier een keuze te maken, dan weigert TypeScript te bouwen.
 */
const SENDER_BY_TYPE: Record<MailType, SenderKind> = {
  // Websiteformulieren → Henry. Reply-To is de bezoeker (zie VISITOR_REPLY_TYPES).
  "demo-request": "website",
  "intake-request": "website",
  "contact-message": "website",
  // Beveiliging: hier hoeft niemand op te antwoorden.
  "magic-login": "noreply",
  // Al het andere: gewone systeemmail waarop een klant mag antwoorden.
  "demo-confirmation": "transactional",
  "intake-confirmation": "transactional",
  "contact-confirmation": "transactional",
  "partner-invite": "transactional",
  "partner-added": "transactional",
  "partner-activated": "transactional",
  "partner-demo-sent": "transactional",
  "partner-milestone": "transactional",
  "demo-ready": "transactional",
  welcome: "transactional",
  notification: "transactional",
  "groei-bericht": "transactional",
  test: "transactional",
};

/**
 * De enige mailtypes waarbij de Reply-To de bezoeker mag zijn: de interne
 * meldingen van een websiteformulier, die bij Henry binnenkomen. Klikt hij
 * daar op Beantwoorden, dan antwoordt hij de bezoeker. Op elke andere mail
 * wordt een meegegeven `replyToVisitor` genegeerd.
 */
export const VISITOR_REPLY_TYPES: ReadonlySet<MailType> = new Set([
  "demo-request",
  "intake-request",
  "contact-message",
]);

/** Weergavenaam voor meldingen uit een websiteformulier. */
const WEBSITE_SENDER_NAME = `${branding.name} Website`;

export function senderKindFor(type: MailType): SenderKind {
  return SENDER_BY_TYPE[type];
}

/** Haalt het kale adres uit "Naam <adres>" of geeft het adres zelf terug. */
export function addressOf(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

/** Zelfde adres, andere weergavenaam. */
function withDisplayName(from: string, name: string): string {
  return `${name} <${addressOf(from)}>`;
}

/**
 * De From-kopregel voor een mailtype, of null als EMAIL_FROM ontbreekt.
 *
 * In sandbox-modus (EMAIL_FROM op @resend.dev) gaat alles via EMAIL_FROM:
 * Resend accepteert dan geen ander afzenderdomein.
 */
export function resolveFrom(type: MailType): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) return null;

  const kind = senderKindFor(type);
  if (kind === "website") return withDisplayName(from, WEBSITE_SENDER_NAME);
  if (kind === "noreply" && !isSandboxSender(from)) {
    return process.env.EMAIL_FROM_NOREPLY?.trim() || from;
  }
  return from;
}

/** Is dit het proefadres van Resend (nog geen eigen domein)? */
export function isSandboxSender(from: string): boolean {
  return /@resend\.dev>?\s*$/i.test(from.trim());
}

/** Het vaste antwoordadres van alle DogWare-systeemmail. */
export function defaultReplyTo(): string {
  return branding.replyToEmail;
}
