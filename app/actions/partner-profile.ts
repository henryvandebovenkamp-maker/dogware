"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requirePartner } from "@/lib/auth/session";
import { getPartnerForUser } from "@/lib/partner-data";
import { encryptField } from "@/lib/crypto-field";
import { isValidIban, normalizeIban } from "@/lib/iban";

/**
 * Profielgegevens van de partner opslaan. Wordt gebruikt voor zowel autosave
 * (debounced) als de definitieve opslagknop. Bankgegevens worden versleuteld
 * opgeslagen; nooit in localStorage of drafts.
 */

export type ProfileInput = {
  voornaam: string;
  achternaam: string;
  bedrijfsnaam: string;
  telefoon: string;
  website: string;
  avatarUrl: string;
  rekeninghouder: string;
  iban: string;
  bic: string;
  land: string;
  factuurType: "particulier" | "zakelijk" | "";
  kvkNummer: string;
  btwNummer: string;
};

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; message: string };

function clean(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function savePartnerProfile(
  input: ProfileInput,
): Promise<SaveProfileResult> {
  const user = await requirePartner();
  const db = getDb();
  if (!db) return { ok: false, message: "Tijdelijk niet beschikbaar." };
  const partner = await getPartnerForUser(user.id);
  if (!partner) return { ok: false, message: "Profiel niet gevonden." };

  const factuurType =
    input.factuurType === "zakelijk" ? "zakelijk" : input.factuurType === "particulier" ? "particulier" : null;

  // IBAN alleen valideren als er iets is ingevuld (concept mag onvolledig zijn)
  const ibanRaw = clean(input.iban, 40);
  let ibanEnc = partner.ibanEnc;
  if (ibanRaw) {
    if (!isValidIban(ibanRaw)) {
      return { ok: false, message: "Dat IBAN lijkt niet te kloppen." };
    }
    ibanEnc = encryptField(normalizeIban(ibanRaw));
  } else {
    ibanEnc = null;
  }

  const bicRaw = clean(input.bic, 20).toUpperCase();
  const bicEnc = bicRaw ? encryptField(bicRaw) : null;

  await db
    .update(schema.partners)
    .set({
      voornaam: clean(input.voornaam) || null,
      achternaam: clean(input.achternaam) || null,
      bedrijfsnaam: clean(input.bedrijfsnaam) || null,
      telefoon: clean(input.telefoon, 40) || null,
      website: clean(input.website, 300) || null,
      avatarUrl: clean(input.avatarUrl, 500) || null,
      rekeninghouder: clean(input.rekeninghouder) || null,
      ibanEnc,
      bicEnc,
      land: clean(input.land, 60) || null,
      factuurType,
      kvkNummer: factuurType === "zakelijk" ? clean(input.kvkNummer, 20) || null : null,
      btwNummer: factuurType === "zakelijk" ? clean(input.btwNummer, 20) || null : null,
    })
    .where(eq(schema.partners.id, partner.id));

  return { ok: true };
}
