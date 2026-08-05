"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { PARTNER_STATUSES, type PartnerStatus } from "@/lib/db/schema";
import { branding } from "@/lib/branding";
import { getCurrentUser, revokeAllSessions } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { normalizeReferralCode, referralLinkFor } from "@/lib/referral";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent } from "@/lib/journey";
import { sendPartnerInvite, sendPartnerAdded } from "@/lib/email/send";
import {
  activatePartner,
  inspectEmail,
  isValidEmail,
  normalizeEmail,
} from "@/lib/partner-activation";

export type PartnerActionState = {
  status: "idle" | "success" | "error" | "bevestig" | "al_partner";
  message?: string;
  partnerId?: string;
  /** Bij "bevestig"/"al_partner": het herkende e-mailadres, voor de melding. */
  email?: string;
};

/** Alleen de Super Admin mag partneracties uitvoeren — server-side afgedwongen. */
async function requireAdminActor() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("SUPER_ADMIN")) return null;
  return user;
}

/* ---------- Partner aanmaken of koppelen ---------- */

/**
 * Vooraf kijken wat dit e-mailadres betekent, zodat de beheerder een eerlijke
 * melding ziet in plaats van pas bij het opslaan een blokkade. Alleen lezend
 * en alleen voor de Super Admin.
 */
export async function checkPartnerEmail(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) return { status: "idle" };

  const bevinding = await inspectEmail(email);
  if (bevinding.kind === "al_partner") {
    return {
      status: "al_partner",
      partnerId: bevinding.partnerId,
      email,
      message: "Dit account is al als partner actief.",
    };
  }
  if (bevinding.kind === "bestaand_account") {
    return {
      status: "bevestig",
      email,
      message:
        "Er bestaat al een DogWare-account met dit e-mailadres. We koppelen de partneromgeving veilig aan het bestaande account.",
    };
  }
  return { status: "idle" };
}

export async function createPartner(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };

  const db = getDb();
  if (!db) return { status: "error", message: "Database niet geconfigureerd." };

  // Alleen naam + e-mail nodig. Beloning en klantvoordelen zijn optioneel.
  const naam = String(formData.get("naam") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const beloningEuro = Number(String(formData.get("beloning") ?? "500").replace(",", "."));
  const perks = String(formData.get("perks") ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 5);
  const bevestigd = String(formData.get("bevestigd") ?? "") === "1";

  if (!naam || !isValidEmail(email)) {
    return { status: "error", message: "Vul een naam en een geldig e-mailadres in." };
  }

  /*
   * Bestaat er al een account? Dan is dat geen fout maar een keuze. We tonen
   * één keer een rustige melding en koppelen daarna aan hetzelfde account —
   * nooit een tweede gebruiker.
   */
  const bevinding = await inspectEmail(email);
  if (bevinding.kind === "al_partner") {
    return {
      status: "al_partner",
      partnerId: bevinding.partnerId,
      email,
      message: "Dit account is al als partner actief.",
    };
  }
  if (bevinding.kind === "bestaand_account" && !bevestigd) {
    return {
      status: "bevestig",
      email,
      message:
        "Er bestaat al een DogWare-account met dit e-mailadres. We koppelen de partneromgeving veilig aan het bestaande account.",
    };
  }

  const resultaat = await activatePartner({
    email,
    naam,
    actorUserId: actor.id,
    commissionCents: Number.isFinite(beloningEuro) ? beloningEuro * 100 : undefined,
    perks,
  });

  if (resultaat.kind === "fout") {
    return { status: "error", message: resultaat.message };
  }
  if (resultaat.kind === "al_partner") {
    return {
      status: "al_partner",
      partnerId: resultaat.partnerId,
      email,
      message: resultaat.message,
    };
  }

  revalidatePath("/admin/partners");
  return { status: "success", partnerId: resultaat.partnerId, message: resultaat.message };
}

/* ---------- Vanuit een websiteaanvraag ook partner worden ---------- */

/**
 * Dezelfde persoon, hetzelfde e-mailadres, een rol erbij.
 *
 * De aanvraag, de journey en de eventuele affiliate waarlangs deze persoon
 * ooit binnenkwam blijven volledig intact: we schrijven niets op de lead
 * behalve een regel op de tijdlijn.
 */
export async function activatePartnerFromLead(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet geconfigureerd." };

  const leadId = String(formData.get("leadId") ?? "");
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  if (!lead) return { status: "error", message: "Aanvraag niet gevonden." };

  const email = normalizeEmail(String(formData.get("email") ?? "") || lead.email);
  const naam = String(formData.get("naam") ?? "").trim() || lead.naam;
  const telefoon = String(formData.get("telefoon") ?? "").trim() || lead.telefoon;
  const bedrijfsnaam = String(formData.get("bedrijfsnaam") ?? "").trim() || lead.bedrijfsnaam;
  const beloningEuro = Number(String(formData.get("beloning") ?? "500").replace(",", "."));

  if (!isValidEmail(email)) {
    return { status: "error", message: "Deze aanvraag heeft geen geldig e-mailadres." };
  }

  const bevinding = await inspectEmail(email);
  if (bevinding.kind === "al_partner") {
    return {
      status: "al_partner",
      partnerId: bevinding.partnerId,
      email,
      message: "Deze persoon is al als partner actief.",
    };
  }

  // Uitnodiging gaat pas de deur uit na een expliciete bevestiging.
  if (String(formData.get("bevestigd") ?? "") !== "1") {
    return {
      status: "bevestig",
      email,
      message:
        bevinding.kind === "bestaand_account"
          ? `${naam} heeft al een DogWare-account. We koppelen de partneromgeving veilig aan dat account en sturen daarna een bericht naar ${email}.`
          : `We maken een partneromgeving voor ${naam} en sturen een uitnodiging naar ${email}.`,
    };
  }

  const resultaat = await activatePartner({
    email,
    naam,
    actorUserId: actor.id,
    commissionCents: Number.isFinite(beloningEuro) ? beloningEuro * 100 : undefined,
    bedrijfsnaam,
    telefoon,
    website: lead.website,
    herkomst: { leadId: lead.id, via: "websiteaanvraag" },
  });

  if (resultaat.kind === "fout") return { status: "error", message: resultaat.message };
  if (resultaat.kind === "al_partner") {
    return {
      status: "al_partner",
      partnerId: resultaat.partnerId,
      email,
      message: "Deze persoon is al als partner actief.",
    };
  }

  // De koppeling zichtbaar maken op de tijdlijn van de aanvraag zelf.
  await logJourneyEvent(
    lead.id,
    "partner_activated",
    `Ook als partner geactiveerd${resultaat.nieuwAccount ? "" : " (gekoppeld aan het bestaande account)"}`,
    { partnerId: resultaat.partnerId, userId: resultaat.userId },
  );

  revalidatePath(`/admin/leads/${lead.id}`);
  revalidatePath("/admin/partners");
  return { status: "success", partnerId: resultaat.partnerId, message: resultaat.message };
}

/* ---------- Uitnodiging opnieuw versturen ---------- */

export async function resendInvite(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet geconfigureerd." };

  const partnerId = String(formData.get("partnerId") ?? "");
  const rows = await db
    .select({ partner: schema.partners, user: schema.users })
    .from(schema.partners)
    .innerJoin(schema.users, eq(schema.partners.userId, schema.users.id))
    .where(eq(schema.partners.id, partnerId))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "error", message: "Partner niet gevonden." };

  /*
   * Een account dat al in gebruik is heeft geen activatielink nodig — dat zou
   * suggereren dat er een nieuw account klaarstaat. Die persoon krijgt zijn
   * persoonlijke link opnieuw, met de gewone inlogroute.
   */
  const alActief = row.user.status === "ACTIVE";
  const mail = alActief
    ? await sendPartnerAdded(
        row.user.email,
        row.user.naam,
        referralLinkFor(row.partner.referralCode),
        `${branding.siteUrl}/partner`,
        true,
      )
    : // issueToken maakt eerdere uitnodigingslinks automatisch ongeldig
      await sendPartnerInvite(
        row.user.email,
        row.user.naam,
        `${branding.siteUrl}/partner/uitnodiging/${await issueToken(row.user.id, "INVITE")}`,
        true,
      );

  await logActivity({
    actorUserId: actor.id,
    action: alActief ? "PARTNER_LINK_RESENT" : "INVITE_RESENT",
    objectType: "partner",
    objectId: partnerId,
  });

  revalidatePath(`/admin/partners/${partnerId}`);
  return mail.ok
    ? {
        status: "success",
        message: alActief
          ? `Persoonlijke link opnieuw verstuurd naar ${row.user.email}.`
          : `Nieuwe uitnodiging verstuurd naar ${row.user.email}.`,
      }
    : { status: "error", message: `Versturen mislukt: ${mail.error.message}` };
}

/* ---------- Status wijzigen (pauzeren, blokkeren, beëindigen) ---------- */

export async function updatePartnerStatus(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet geconfigureerd." };

  const partnerId = String(formData.get("partnerId") ?? "");
  const status = String(formData.get("status") ?? "") as PartnerStatus;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!PARTNER_STATUSES.includes(status)) {
    return { status: "error", message: "Ongeldige status." };
  }

  const [partner] = await db
    .select()
    .from(schema.partners)
    .where(eq(schema.partners.id, partnerId))
    .limit(1);
  if (!partner) return { status: "error", message: "Partner niet gevonden." };

  await db
    .update(schema.partners)
    .set({ status })
    .where(eq(schema.partners.id, partnerId));

  // Gebruikerstoegang synchroon houden
  if (status === "BLOCKED" || status === "ENDED") {
    await db
      .update(schema.users)
      .set({ status: "BLOCKED" })
      .where(eq(schema.users.id, partner.userId));
    await revokeAllSessions(partner.userId);
  } else if (status === "ACTIVE" || status === "PAUSED") {
    await db
      .update(schema.users)
      .set({ status: "ACTIVE" })
      .where(eq(schema.users.id, partner.userId));
  }

  await logActivity({
    actorUserId: actor.id,
    action: "PARTNER_STATUS_CHANGED",
    objectType: "partner",
    objectId: partnerId,
    oldValue: { status: partner.status },
    newValue: { status },
    reason: reason || undefined,
  });

  revalidatePath(`/admin/partners/${partnerId}`);
  revalidatePath("/admin/partners");
  return { status: "success", message: `Status gewijzigd naar ${status}.` };
}

/* ---------- Referralcode wijzigen ---------- */

export async function changeReferralCode(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet geconfigureerd." };

  const partnerId = String(formData.get("partnerId") ?? "");
  const normalized = normalizeReferralCode(String(formData.get("referralCode") ?? ""));
  if (!normalized) {
    return { status: "error", message: "Ongeldige referralcode (4–40 tekens, letters/cijfers/streepjes)." };
  }

  const [inUse] = await db
    .select({ id: schema.partners.id })
    .from(schema.partners)
    .where(eq(schema.partners.referralCode, normalized))
    .limit(1);
  if (inUse && inUse.id !== partnerId) {
    return { status: "error", message: "Deze code is al in gebruik." };
  }

  const [partner] = await db
    .select()
    .from(schema.partners)
    .where(eq(schema.partners.id, partnerId))
    .limit(1);
  if (!partner) return { status: "error", message: "Partner niet gevonden." };

  // Historische clicks en leads bewaren hun eigen snapshot — die blijven kloppen
  await db
    .update(schema.partners)
    .set({ referralCode: normalized })
    .where(eq(schema.partners.id, partnerId));

  await logActivity({
    actorUserId: actor.id,
    action: "REFERRAL_CODE_CHANGED",
    objectType: "partner",
    objectId: partnerId,
    oldValue: { referralCode: partner.referralCode },
    newValue: { referralCode: normalized },
  });

  revalidatePath(`/admin/partners/${partnerId}`);
  return { status: "success", message: `Referralcode gewijzigd naar ${normalized}.` };
}

/* ---------- Lead handmatig aan andere partner koppelen ---------- */

export async function reassignLead(
  _prev: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const actor = await requireAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet geconfigureerd." };

  const leadId = String(formData.get("leadId") ?? "");
  const partnerId = String(formData.get("partnerId") ?? ""); // leeg = loskoppelen
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    return { status: "error", message: "Een reden is verplicht bij handmatige toewijzing." };
  }

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  if (!lead) return { status: "error", message: "Aanvraag niet gevonden." };

  let newPartner = null;
  if (partnerId) {
    [newPartner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, partnerId))
      .limit(1);
    if (!newPartner) return { status: "error", message: "Partner niet gevonden." };
  }

  await db
    .update(schema.leads)
    .set({
      affiliatePartnerId: newPartner?.id ?? null,
      referralCodeSnapshot: newPartner?.referralCode ?? null,
      attributionModel: "MANUAL",
      attributedAt: new Date(),
    })
    .where(eq(schema.leads.id, leadId));

  // Oorspronkelijke attributie blijft bewaard in de auditlog
  await logActivity({
    actorUserId: actor.id,
    action: "LEAD_REASSIGNED",
    objectType: "lead",
    objectId: leadId,
    oldValue: {
      affiliatePartnerId: lead.affiliatePartnerId,
      referralCodeSnapshot: lead.referralCodeSnapshot,
      attributionModel: lead.attributionModel,
    },
    newValue: {
      affiliatePartnerId: newPartner?.id ?? null,
      referralCodeSnapshot: newPartner?.referralCode ?? null,
      attributionModel: "MANUAL",
    },
    reason,
  });

  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success", message: "Toewijzing aangepast en vastgelegd in de auditlog." };
}
