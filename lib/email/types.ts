import type { ReactNode } from "react";

/** Alle mailtypes die DogWare kent — uitbreiden wanneer er modules bijkomen. */
export type MailType =
  | "demo-request"
  | "demo-confirmation"
  | "intake-request"
  | "intake-confirmation"
  | "partner-invite"
  | "partner-activated"
  | "magic-login"
  | "demo-ready"
  | "welcome"
  | "notification"
  | "test";

export type MailAttachment = {
  filename: string;
  /** Base64-string of Buffer met de bestandsinhoud */
  content: string | Buffer;
};

export type MailOptions = {
  to: string | string[];
  subject: string;
  /** React Email template — voorkeursmanier */
  react?: ReactNode;
  /** Alleen gebruiken als een template niet mogelijk is */
  html?: string;
  /** Platte-tekstversie (aanrader voor deliverability) */
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: MailAttachment[];
};

export type MailResult =
  | { ok: true; id: string }
  | { ok: false; error: MailError };

export type MailError = {
  /** Stabiele code om op te programmeren */
  code:
    | "NOT_CONFIGURED"
    | "INVALID_RECIPIENT"
    | "INVALID_SUBJECT"
    | "EMPTY_BODY"
    | "PROVIDER_ERROR"
    | "NETWORK_ERROR";
  /** Veilige, menselijke omschrijving — bevat nooit secrets */
  message: string;
};
