import "server-only";
import type { Lead } from "@/lib/db/schema";
import type { DemoReadyContent } from "@/lib/email/send";

/**
 * De inhoud van de demo-mail, afgeleid uit één aanvraag.
 *
 * Eén plek, zodat de preview in de admin, de testmail en de echte verzending
 * per definitie dezelfde mail opleveren. Zodra dit drie keer los zou worden
 * samengesteld, gaat de preview vroeg of laat iets anders tonen dan wat de
 * klant krijgt — en dat merk je pas als het te laat is.
 */
export type DemoMailOpzet = {
  data: DemoReadyContent;
  /** Menselijke omschrijving van wat er nog mist. Leeg = klaar om te versturen. */
  ontbreekt: string[];
  /** Het adres waar de echte mail heen gaat. */
  ontvanger: string;
};

/** Losse URL netjes maken; leeg blijft leeg (nooit een kale "https://"). */
export function normaliseerUrl(waarde: string | null | undefined): string {
  const schoon = waarde?.trim() ?? "";
  if (!schoon) return "";
  return /^https?:\/\//i.test(schoon) ? schoon : `https://${schoon}`;
}

/**
 * Bouwt de inhoud van de demo-mail uit de aanvraag.
 *
 * Uitsluitend velden die de klant zelf heeft ingevuld. De formuliervelden mogen
 * de opgeslagen links overschrijven (de beheerder plakt ze vaak in hetzelfde
 * scherm), maar er wordt niets aangevuld of verzonnen: ontbreekt er iets, dan
 * staat dat in `ontbreekt` en hoort de mail niet naar een klant te gaan.
 *
 * Interne notities, taken, tijdlijn en partnergegevens komen hier bewust niet
 * in voor — die mogen een potentiële klant nooit bereiken.
 */
export function demoMailOpzet(
  lead: Lead,
  form?: { website?: string; portaal?: string; loginEmail?: string },
): DemoMailOpzet {
  const website = normaliseerUrl(form?.website || lead.demoDomain);
  const portaal = normaliseerUrl(form?.portaal || lead.demoPortalUrl);
  const loginEmail = (
    form?.loginEmail?.trim() ||
    lead.demoLoginEmail?.trim() ||
    lead.email
  )
    .trim()
    .toLowerCase();

  const ontbreekt: string[] = [];
  if (!website) ontbreekt.push("de demolink (voorbeeldwebsite)");
  if (!portaal) ontbreekt.push("de inloglink (demoportaal)");
  if (!loginEmail) ontbreekt.push("het login-e-mailadres");

  return {
    data: {
      firstName: lead.naam.trim().split(/\s+/)[0] || undefined,
      bedrijfsnaam: lead.bedrijfsnaam?.trim() || undefined,
      demoUrl: website || undefined,
      portaalUrl: portaal || undefined,
      loginEmail: loginEmail || undefined,
      diensten: lead.diensten ?? [],
      functies: lead.functies ?? [],
    },
    ontbreekt,
    ontvanger: loginEmail,
  };
}
