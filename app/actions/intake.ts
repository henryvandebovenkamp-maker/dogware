"use server";

import { branding } from "@/lib/branding";
import { getDb, schema } from "@/lib/db";
import {
  sendIntakeConfirmation,
  sendIntakeNotification,
} from "@/lib/email/send";
import type { IntakeData } from "@/lib/intake";

export type IntakeState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 5000;

function clean(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => clean(v, 200)).filter(Boolean).slice(0, 20);
}

/** Verwerkt een persoonlijke-demo-intake: opslaan + interne mail + bevestiging. */
export async function submitIntake(raw: IntakeData): Promise<IntakeState> {
  // Nooit client-input vertrouwen: alles opnieuw valideren en begrenzen.
  const data: IntakeData = {
    bedrijfsnaam: clean(raw.bedrijfsnaam, 200),
    naam: clean(raw.naam, 200),
    email: clean(raw.email, 320),
    telefoon: clean(raw.telefoon, 40),
    website: clean(raw.website, 500),
    plaats: clean(raw.plaats, 200),
    diensten: cleanList(raw.diensten),
    dienstenAnders: clean(raw.dienstenAnders, 500),
    heeftWebsite: ["nee", "ja", "ja-nieuw"].includes(raw.heeftWebsite)
      ? raw.heeftWebsite
      : "",
    websiteGoed: clean(raw.websiteGoed, MAX_TEXT),
    websiteMist: clean(raw.websiteMist, MAX_TEXT),
    software: cleanList(raw.software),
    tijdvreters: cleanList(raw.tijdvreters),
    droomscenario: clean(raw.droomscenario, MAX_TEXT),
    inspiratie: clean(raw.inspiratie, MAX_TEXT),
    heeftLogo: raw.heeftLogo === "ja" || raw.heeftLogo === "nee" ? raw.heeftLogo : "",
    huisstijl: clean(raw.huisstijl, MAX_TEXT),
    uploads: cleanList(raw.uploads).filter((u) => u.startsWith("https://")),
    functies: cleanList(raw.functies),
    opmerkingen: clean(raw.opmerkingen, MAX_TEXT),
  };

  if (!data.bedrijfsnaam || !data.naam || !data.plaats) {
    return { status: "error", message: "Vul je bedrijfsnaam, naam en plaats in." };
  }
  if (!EMAIL_REGEX.test(data.email)) {
    return { status: "error", message: "Controleer je e-mailadres." };
  }
  if (data.diensten.length === 0 && !data.dienstenAnders) {
    return { status: "error", message: "Kies minimaal één dienst." };
  }

  // 1. Opslaan in de database (indien geconfigureerd — anders alleen mail).
  let leadUrl: string | undefined;
  const db = getDb();
  if (db) {
    try {
      const [lead] = await db
        .insert(schema.leads)
        .values({
          bedrijfsnaam: data.bedrijfsnaam,
          naam: data.naam,
          email: data.email,
          telefoon: data.telefoon || null,
          website: data.website || null,
          plaats: data.plaats,
          diensten: data.diensten,
          dienstenAnders: data.dienstenAnders || null,
          heeftWebsite: data.heeftWebsite || null,
          websiteGoed: data.websiteGoed || null,
          websiteMist: data.websiteMist || null,
          software: data.software,
          tijdvreters: data.tijdvreters,
          droomscenario: data.droomscenario || null,
          inspiratie: data.inspiratie || null,
          heeftLogo: data.heeftLogo || null,
          huisstijl: data.huisstijl || null,
          uploads: data.uploads,
          functies: data.functies,
          opmerkingen: data.opmerkingen || null,
        })
        .returning({ id: schema.leads.id });
      if (lead) {
        leadUrl = `${branding.siteUrl}/admin/leads/${lead.id}`;
      }
    } catch (err) {
      // Database-fout mag de aanvraag niet blokkeren — mail is het vangnet.
      console.error(
        JSON.stringify({
          evt: "lead.db_error",
          at: new Date().toISOString(),
          error: err instanceof Error ? err.message : "Onbekende fout",
        }),
      );
    }
  }

  // 2. Interne notificatie is leidend: als die lukt, is de aanvraag binnen.
  const notification = await sendIntakeNotification(data, leadUrl);
  if (!notification.ok && !leadUrl) {
    return {
      status: "error",
      message:
        "Versturen is nu even niet gelukt. Probeer het later opnieuw of mail ons direct.",
    };
  }

  // 3. Bevestiging naar de aanvrager (nice-to-have, blokkeert nooit).
  await sendIntakeConfirmation(data.email, data.naam);

  return { status: "success" };
}
