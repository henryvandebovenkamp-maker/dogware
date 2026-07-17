"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { branding } from "@/lib/branding";
import { getAdminActor } from "@/lib/admin-auth";
import { createMagicLinkToken } from "@/lib/auth/challenge";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent, setStage } from "@/lib/journey";
import { sendDemoReady } from "@/lib/email/send";

export type JourneyActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/* ---------- Voorbeeldlinks opslaan (handmatig geplakt) ---------- */

export async function saveDemoLinks(
  _prev: JourneyActionState,
  formData: FormData,
): Promise<JourneyActionState> {
  if (!(await getAdminActor())) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  const leadId = String(formData.get("leadId") ?? "");
  const website = String(formData.get("website") ?? "").trim();
  const portaal = String(formData.get("portaal") ?? "").trim();
  const loginEmail = String(formData.get("loginEmail") ?? "").trim().toLowerCase();

  await db
    .update(schema.leads)
    .set({
      demoDomain: website || null,
      demoPortalUrl: portaal || null,
      demoLoginEmail: loginEmail || null,
    })
    .where(eq(schema.leads.id, leadId));

  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success", message: "Opgeslagen." };
}

/* ---------- Demo versturen (passwordless magic login) ---------- */

export async function sendDemo(
  _prev: JourneyActionState,
  formData: FormData,
): Promise<JourneyActionState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  const leadId = String(formData.get("leadId") ?? "");
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  if (!lead) return { status: "error", message: "Aanvraag niet gevonden." };

  const website = String(formData.get("website") ?? "").trim() || lead.demoDomain;
  if (!website) {
    return { status: "error", message: "Vul eerst de voorbeeldwebsite-URL in." };
  }
  const loginEmail =
    (String(formData.get("loginEmail") ?? "").trim().toLowerCase() ||
      lead.demoLoginEmail ||
      lead.email);

  // Demo-klantaccount aanmaken of hergebruiken (rol CUSTOMER, passwordless)
  let customerId = lead.demoCustomerUserId;
  if (!customerId) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, loginEmail))
      .limit(1);
    if (existing) {
      customerId = existing.id;
    } else {
      const [created] = await db
        .insert(schema.users)
        .values({ email: loginEmail, naam: lead.naam, role: "CUSTOMER", status: "ACTIVE" })
        .returning({ id: schema.users.id });
      customerId = created.id;
    }
    await db
      .update(schema.leads)
      .set({ demoCustomerUserId: customerId })
      .where(eq(schema.leads.id, leadId));
  }

  // Magic login-link, 7 dagen geldig (demo-uitnodiging)
  const token = await createMagicLinkToken(customerId, loginEmail, 7 * 24 * 60);
  if (!token) return { status: "error", message: "Kon geen inloglink maken." };
  const loginUrl = `${branding.siteUrl}/inloggen/${token}`;
  const websiteUrl = website.startsWith("http") ? website : `https://${website}`;

  const mail = await sendDemoReady(
    loginEmail,
    lead.naam,
    lead.bedrijfsnaam,
    loginUrl,
    websiteUrl,
  );
  if (!mail.ok) {
    return { status: "error", message: mail.error.message };
  }

  await db
    .update(schema.leads)
    .set({
      demoDomain: website,
      demoLoginEmail: loginEmail,
      demoSentAt: new Date(),
      status: "demo verstuurd",
    })
    .where(eq(schema.leads.id, leadId));
  await setStage(leadId, "demo-verstuurd");
  await logJourneyEvent(leadId, "email_sent", `Voorbeeld verstuurd naar ${loginEmail}`);
  await logActivity({
    actorUserId: actor.id,
    action: "DEMO_SENT",
    objectType: "lead",
    objectId: leadId,
  });

  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success", message: "Demo verstuurd en journey bijgewerkt." };
}

/* ---------- Stage handmatig aanpassen ---------- */

export async function changeStage(
  _prev: JourneyActionState,
  formData: FormData,
): Promise<JourneyActionState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };

  const leadId = String(formData.get("leadId") ?? "");
  const stage = String(formData.get("stage") ?? "") as JourneyStage;
  if (!JOURNEY_STAGES.includes(stage)) {
    return { status: "error", message: "Ongeldige status." };
  }
  await setStage(leadId, stage, { force: true, reden: "handmatig aangepast" });
  await logActivity({
    actorUserId: actor.id,
    action: "STAGE_CHANGED",
    objectType: "lead",
    objectId: leadId,
    newValue: { stage },
  });
  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success" };
}
