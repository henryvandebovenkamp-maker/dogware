"use server";

import { logActivity } from "@/lib/audit";
import {
  sendContactConfirmation,
  sendContactNotification,
} from "@/lib/email/send";
import { isTelefoonGeldig } from "@/lib/intake";

/**
 * Het contactformulier van de publieke site.
 *
 * Bewust géén tweede aanvraagsysteem naast de demo-intake: een bericht is geen
 * lead en hoort niet in de Demo Journey thuis (dat zou de stages en de
 * conversiecijfers vervuilen). Het loopt daarom over de bestaande
 * mailservice — interne notificatie met `replyTo` naar de afzender, plus een
 * persoonlijke bevestiging — en wordt vastgelegd in het bestaande auditlog,
 * zodat het in /admin/activiteit terugkomt naast al het andere verkeer.
 */

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BERICHT = 5000;

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: een echt mens ziet dit veld niet en laat het dus leeg.
  if (clean(formData.get("bedrijf"), 200)) {
    return { status: "success" };
  }

  const naam = clean(formData.get("naam"), 200);
  const email = clean(formData.get("email"), 320);
  const telefoon = clean(formData.get("telefoon"), 40);
  const bericht = clean(formData.get("bericht"), MAX_BERICHT);
  const herkomst = clean(formData.get("herkomst"), 300);

  if (!naam) {
    return { status: "error", message: "Vul even je naam in, dan weet ik wie ik antwoord." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { status: "error", message: "Controleer je e-mailadres — anders kan ik niet reageren." };
  }
  // Telefoon is optioneel, maar als het is ingevuld moet het wel kloppen.
  if (telefoon && !isTelefoonGeldig(telefoon)) {
    return { status: "error", message: "Dat telefoonnummer lijkt nog niet helemaal te kloppen." };
  }
  if (bericht.length < 5) {
    return { status: "error", message: "Schrijf even kort waar het over gaat." };
  }

  // De interne mail is leidend: komt die aan, dan is het bericht binnen.
  const notification = await sendContactNotification({
    naam,
    email,
    telefoon: telefoon || undefined,
    bericht,
    herkomst: herkomst || undefined,
  });
  if (!notification.ok) {
    return {
      status: "error",
      message:
        "Versturen lukt nu even niet. Probeer het zo nog eens, of mail of bel me direct — mijn gegevens staan op deze pagina.",
    };
  }

  // Bevestiging naar de afzender (nice-to-have, blokkeert nooit).
  await sendContactConfirmation(email, naam, bericht);

  await logActivity({
    action: "CONTACT_MESSAGE",
    objectType: "contact",
    newValue: { naam, email, telefoon: telefoon || null, herkomst: herkomst || null },
  });

  return { status: "success" };
}
