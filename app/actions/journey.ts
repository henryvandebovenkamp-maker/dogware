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

/* ---------- Voorbeeldwebsite-opzet opslaan ---------- */

export async function saveDemoSetup(
  _prev: JourneyActionState,
  formData: FormData,
): Promise<JourneyActionState> {
  if (!(await getAdminActor())) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  const leadId = String(formData.get("leadId") ?? "");
  const template = String(formData.get("template") ?? "").trim();
  const domein = String(formData.get("domein") ?? "").trim();
  const primair = String(formData.get("primair") ?? "").trim();
  const secundair = String(formData.get("secundair") ?? "").trim();

  await db
    .update(schema.leads)
    .set({
      demoTemplate: template || null,
      demoDomain: domein || null,
      demoPrimaryColor: primair || null,
      demoSecondaryColor: secundair || null,
    })
    .where(eq(schema.leads.id, leadId));

  // Bij het klaarzetten schuift de journey naar "voorbereiden"
  await setStage(leadId, "voorbereiden");
  await logJourneyEvent(leadId, "demo_setup", `Voorbeeldwebsite ingesteld${template ? ` (${template})` : ""}`);

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

  // Demo-klantaccount aanmaken of hergebruiken (rol CUSTOMER, passwordless)
  let customerId = lead.demoCustomerUserId;
  if (!customerId) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, lead.email))
      .limit(1);
    if (existing) {
      customerId = existing.id;
    } else {
      const [created] = await db
        .insert(schema.users)
        .values({
          email: lead.email,
          naam: lead.naam,
          role: "CUSTOMER",
          status: "ACTIVE",
        })
        .returning({ id: schema.users.id });
      customerId = created.id;
    }
    await db
      .update(schema.leads)
      .set({ demoCustomerUserId: customerId })
      .where(eq(schema.leads.id, leadId));
  }

  // Magic login-link, 7 dagen geldig (demo-uitnodiging)
  const token = await createMagicLinkToken(customerId, lead.email, 7 * 24 * 60);
  if (!token) return { status: "error", message: "Kon geen inloglink maken." };
  const loginUrl = `${branding.siteUrl}/inloggen/${token}`;
  const demoUrl = lead.demoDomain
    ? lead.demoDomain.startsWith("http")
      ? lead.demoDomain
      : `https://${lead.demoDomain}`
    : undefined;

  const mail = await sendDemoReady(
    lead.email,
    lead.naam,
    lead.bedrijfsnaam,
    loginUrl,
    demoUrl,
  );
  if (!mail.ok) {
    return { status: "error", message: `Versturen mislukt: ${mail.error.message}` };
  }

  await db
    .update(schema.leads)
    .set({ demoSentAt: new Date(), status: "demo verstuurd" })
    .where(eq(schema.leads.id, leadId));
  await setStage(leadId, "demo-verstuurd");
  await logJourneyEvent(leadId, "email_sent", `Demo-mail verzonden naar ${lead.email}`);
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

/* ---------- Interne taken ---------- */

export async function addTask(
  _prev: JourneyActionState,
  formData: FormData,
): Promise<JourneyActionState> {
  if (!(await getAdminActor())) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  const leadId = String(formData.get("leadId") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 200);
  if (!label) return { status: "error", message: "Lege taak." };

  await db.insert(schema.journeyTasks).values({ leadId, label });
  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success" };
}

export async function toggleTask(formData: FormData): Promise<void> {
  if (!(await getAdminActor())) return;
  const db = getDb();
  if (!db) return;
  const taskId = String(formData.get("taskId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  await db
    .update(schema.journeyTasks)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(schema.journeyTasks.id, taskId));
  revalidatePath(`/admin/leads/${leadId}`);
}
