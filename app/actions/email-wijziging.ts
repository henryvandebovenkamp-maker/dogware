"use server";

import { bevestigEmailWijziging } from "@/lib/email-wijziging";

export type EmailBevestigState = { status: "idle" | "success" | "error"; message?: string };

/**
 * Publieke bevestiging van een nieuw e-mailadres. Bewust een POST via een
 * knop en niet het openen van de link zelf: mailscanners openen links
 * automatisch, en die mogen geen account wijzigen. Het token is de enige
 * sleutel; er is geen sessie nodig (de bevestiger bewijst dat hij het nieuwe
 * adres beheert).
 */
export async function bevestigEmailActie(
  _prev: EmailBevestigState,
  formData: FormData,
): Promise<EmailBevestigState> {
  const r = await bevestigEmailWijziging(String(formData.get("token") ?? ""));
  return { status: r.ok ? "success" : "error", message: r.melding };
}
