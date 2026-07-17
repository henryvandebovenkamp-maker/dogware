"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { PARTNER_STATUSES, type PartnerStatus } from "@/lib/db/schema";
import { branding } from "@/lib/branding";
import { getCurrentUser, revokeAllSessions } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { generateReferralCode, normalizeReferralCode } from "@/lib/referral";
import { logActivity } from "@/lib/audit";
import { sendPartnerInvite } from "@/lib/email/send";

export type PartnerActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  partnerId?: string;
};

/** Alleen de Super Admin mag partneracties uitvoeren — server-side afgedwongen. */
async function requireAdminActor() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

/* ---------- Partner aanmaken + uitnodigen ---------- */

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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const beloningEuro = Number(String(formData.get("beloning") ?? "500").replace(",", "."));
  const perks = String(formData.get("perks") ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!naam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Vul een naam en een geldig e-mailadres in." };
  }

  const commissionCents = Number.isFinite(beloningEuro)
    ? Math.max(0, Math.round(beloningEuro * 100))
    : 50000;

  // Unieke code automatisch genereren (nooit handmatig)
  let referralCode = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const [inUse] = await db
      .select({ id: schema.partners.id })
      .from(schema.partners)
      .where(eq(schema.partners.referralCode, referralCode))
      .limit(1);
    if (!inUse) break;
    referralCode = generateReferralCode();
  }

  const [existingUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existingUser) {
    return { status: "error", message: "Er bestaat al een account met dit e-mailadres." };
  }

  const [user] = await db
    .insert(schema.users)
    .values({ email, naam, role: "AFFILIATE_PARTNER", status: "INVITED" })
    .returning();

  const [partner] = await db
    .insert(schema.partners)
    .values({
      userId: user.id,
      referralCode,
      commissionCents,
      newCustomerPerks: perks,
      status: "INVITED",
      invitedAt: new Date(),
    })
    .returning();

  await logActivity({
    actorUserId: actor.id,
    action: "PARTNER_CREATED",
    objectType: "partner",
    objectId: partner.id,
    newValue: { naam, email, referralCode, commissionCents },
  });

  const token = await issueToken(user.id, "INVITE");
  const mail = await sendPartnerInvite(
    email,
    naam,
    `${branding.siteUrl}/partner/uitnodiging/${token}`,
  );
  await logActivity({
    actorUserId: actor.id,
    action: mail.ok ? "INVITE_SENT" : "INVITE_SEND_FAILED",
    objectType: "partner",
    objectId: partner.id,
  });

  revalidatePath("/admin/partners");
  return {
    status: "success",
    partnerId: partner.id,
    message: mail.ok
      ? `Partner aangemaakt en uitnodiging verstuurd naar ${email}.`
      : `Partner aangemaakt, maar de uitnodigingsmail kon niet worden verstuurd (${mail.error.message}). Verstuur hem opnieuw vanaf de detailpagina.`,
  };
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
  if (row.user.status === "ACTIVE") {
    return { status: "error", message: "Dit account is al geactiveerd." };
  }

  // issueToken maakt eerdere uitnodigingslinks automatisch ongeldig
  const token = await issueToken(row.user.id, "INVITE");
  const mail = await sendPartnerInvite(
    row.user.email,
    row.user.naam,
    `${branding.siteUrl}/partner/uitnodiging/${token}`,
    true,
  );
  await logActivity({
    actorUserId: actor.id,
    action: "INVITE_RESENT",
    objectType: "partner",
    objectId: partnerId,
  });

  revalidatePath(`/admin/partners/${partnerId}`);
  return mail.ok
    ? { status: "success", message: `Nieuwe uitnodiging verstuurd naar ${row.user.email}.` }
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
