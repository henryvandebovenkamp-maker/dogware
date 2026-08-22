/**
 * Vervangt lib/email/send.tsx tijdens headless tests.
 *
 * Reden is technisch, niet inhoudelijk: Node kan types uit .ts strippen maar
 * geen JSX uit .tsx compileren, en de maillaag is een React-Email-template.
 *
 * De stub is bewust een RECORDER en geen stille no-op: een test kan zo
 * controleren welke mails de flow zou versturen, zonder dat er echt post de
 * deur uit gaat.
 */
globalThis.__verzondenMails ??= [];

export async function sendCommerceMail(type, to, naam, vars = {}, ctaUrl) {
  globalThis.__verzondenMails.push({ type, to, naam, vars, ctaUrl });
  return { ok: true, id: `stub_${globalThis.__verzondenMails.length}` };
}

/* De overige helpers uit send.tsx, voor het geval een pad ze aanraakt. */
const recorder =
  (naam) =>
  async (...args) => {
    globalThis.__verzondenMails.push({ type: naam, args });
    return { ok: true, id: "stub" };
  };

export const sendDemoRequestNotification = recorder("demo-request");
export const sendDemoConfirmation = recorder("demo-confirmation");
export const sendIntakeNotification = recorder("intake-notification");
export const sendIntakeConfirmation = recorder("intake-confirmation");
export const sendWelcomeEmail = recorder("welcome");
export const sendNotification = recorder("notification");
export const sendDemoReady = recorder("demo-ready");
export const sendPartnerInvite = recorder("partner-invite");
export const sendPartnerAdded = recorder("partner-added");
export const sendPartnerActivated = recorder("partner-activated");
export const sendPartnerDemoSent = recorder("partner-demo-sent");
export const sendMagicLogin = recorder("magic-login");
export const sendGroeiBericht = recorder("groei-bericht");
