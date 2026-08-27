"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { getAdminActor } from "@/lib/admin-auth";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent, setStage } from "@/lib/journey";
import { grantRole } from "@/lib/auth/grant";
import {
  DEMO_READY_TEMPLATE_VERSION,
  renderDemoReady,
  sendDemoReady,
} from "@/lib/email/send";
import { isEmailConfigured } from "@/lib/email/service";
import { notifyPartner } from "@/lib/partner-notify";
import { demoMailOpzet } from "@/lib/demo-mail";

export type JourneyActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

async function haalLead(leadId: string) {
  const db = getDb();
  if (!db) return null;
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  return lead ?? null;
}

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

/* ---------- De demo-mail bekijken vóór verzending ---------- */

export type DemoMailPreviewState = {
  status: "idle" | "ready" | "error";
  message?: string;
  /** Het onderwerp zoals de klant het ziet. */
  subject?: string;
  /** De volledig gerenderde mail — precies wat er verstuurd wordt. */
  html?: string;
  /** De links die meegaan, zodat je ze kunt controleren en openen. */
  demoUrl?: string;
  portaalUrl?: string;
  loginEmail?: string;
  /** Ontvanger van de echte mail. */
  ontvanger?: string;
  /** Wat er nog ontbreekt; leeg = klaar om te versturen. */
  ontbreekt?: string[];
  templateVersie?: string;
};

/**
 * Rendert de demo-mail voor deze aanvraag zonder iets te versturen of te
 * wijzigen. Gebruikt dezelfde template en dezelfde gegevens als het echte
 * versturen, zodat de preview geen aparte waarheid kan worden.
 */
export async function previewDemoMail(
  _prev: DemoMailPreviewState,
  formData: FormData,
): Promise<DemoMailPreviewState> {
  if (!(await getAdminActor())) return { status: "error", message: "Geen toegang." };

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await haalLead(leadId);
  if (!lead) return { status: "error", message: "Aanvraag niet gevonden." };

  const opzet = demoMailOpzet(lead, {
    website: String(formData.get("website") ?? ""),
    portaal: String(formData.get("portaal") ?? ""),
    loginEmail: String(formData.get("loginEmail") ?? ""),
  });
  const { subject, html } = await renderDemoReady(opzet.data);

  return {
    status: "ready",
    subject,
    html,
    demoUrl: opzet.data.demoUrl,
    portaalUrl: opzet.data.portaalUrl,
    loginEmail: opzet.data.loginEmail,
    ontvanger: opzet.ontvanger,
    ontbreekt: opzet.ontbreekt,
    templateVersie: DEMO_READY_TEMPLATE_VERSION,
  };
}

/* ---------- Testmail (raakt de journey nooit aan) ---------- */

/**
 * Verstuurt dezelfde demo-mail naar een zelfgekozen adres om hem in een echte
 * inbox te bekijken.
 *
 * Bewust een aparte actie en niet een vlaggetje op `sendDemo`: een testmail mag
 * geen enkele bijwerking hebben. Er wordt niets aan de aanvraag gewijzigd, geen
 * stage gezet, geen tijdlijnregel voor de klant geschreven, geen demo-account
 * aangemaakt en geen partner geïnformeerd. Alleen het auditlogboek registreert
 * dat er getest is — dat is een handeling van een beheerder, geen klantstap.
 *
 * Het testadres komt altijd uit het formulier. Er staat nergens een vast
 * ontvangeradres in de code.
 */
export async function sendDemoTestMail(
  _prev: JourneyActionState,
  formData: FormData,
): Promise<JourneyActionState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  if (!isEmailConfigured()) {
    return {
      status: "error",
      message: "E-mailservice is niet geconfigureerd (RESEND_API_KEY / EMAIL_FROM).",
    };
  }

  const leadId = String(formData.get("leadId") ?? "");
  const naar = String(formData.get("testTo") ?? "").trim().toLowerCase();
  if (!naar) return { status: "error", message: "Vul een testadres in." };

  const lead = await haalLead(leadId);
  if (!lead) return { status: "error", message: "Aanvraag niet gevonden." };

  const opzet = demoMailOpzet(lead, {
    website: String(formData.get("website") ?? ""),
    portaal: String(formData.get("portaal") ?? ""),
    loginEmail: String(formData.get("loginEmail") ?? ""),
  });

  const mail = await sendDemoReady(naar, opzet.data, { test: true });
  if (!mail.ok) return { status: "error", message: mail.error.message };

  await logActivity({
    actorUserId: actor.id,
    action: "DEMO_TEST_MAIL",
    objectType: "lead",
    objectId: leadId,
    newValue: { to: naar, templateVersie: DEMO_READY_TEMPLATE_VERSION },
  });

  return {
    status: "success",
    message: opzet.ontbreekt.length
      ? `Testmail verstuurd naar ${naar} — let op: ${opzet.ontbreekt.join(" en ")} ${opzet.ontbreekt.length === 1 ? "ontbreekt" : "ontbreken"} nog.`
      : `Testmail verstuurd naar ${naar}. De journey is niet gewijzigd.`,
  };
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
  const lead = await haalLead(leadId);
  if (!lead) return { status: "error", message: "Aanvraag niet gevonden." };

  const opzet = demoMailOpzet(lead, {
    website: String(formData.get("website") ?? ""),
    portaal: String(formData.get("portaal") ?? ""),
    loginEmail: String(formData.get("loginEmail") ?? ""),
  });

  // Nooit een halve mail naar een echte klant. Ontbreekt er een link, dan
  // gebeurt er niets en hoort de beheerder precies wat er nog mist.
  if (opzet.ontbreekt.length > 0) {
    return {
      status: "error",
      message: `De mail is niet verstuurd: ${opzet.ontbreekt.join(" en ")} ${opzet.ontbreekt.length === 1 ? "ontbreekt" : "ontbreken"} nog.`,
    };
  }

  const websiteUrl = opzet.data.demoUrl!;
  const portaalUrl = opzet.data.portaalUrl!;
  const loginEmail = opzet.ontvanger;
  const opnieuw = Boolean(lead.demoSentAt);

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
    // Klantrol erbij — een bestaand account (bijv. van een partner) houdt
    // gewoon alles wat het al had.
    await grantRole(customerId, "CUSTOMER", actor.id);
    await db
      .update(schema.leads)
      .set({ demoCustomerUserId: customerId })
      .where(eq(schema.leads.id, leadId));
  }

  const mail = await sendDemoReady(loginEmail, opzet.data);
  if (!mail.ok) {
    return { status: "error", message: mail.error.message };
  }

  const verstuurdOp = new Date();
  await db
    .update(schema.leads)
    .set({
      demoDomain: websiteUrl,
      demoPortalUrl: portaalUrl,
      demoLoginEmail: loginEmail,
      demoSentAt: verstuurdOp,
      status: "demo verstuurd",
    })
    .where(eq(schema.leads.id, leadId));

  // setStage gaat alleen vooruit: bij opnieuw versturen zakt een aanvraag die
  // al verder is (bijv. "Klant wil doorgaan") niet terug naar "Demo verstuurd".
  await setStage(leadId, "demo-verstuurd");

  await logJourneyEvent(
    leadId,
    "email_sent",
    opnieuw
      ? `Demo-mail opnieuw verstuurd naar ${loginEmail}`
      : `Demo-mail verstuurd naar ${loginEmail}`,
    {
      actor: "admin",
      ontvanger: loginEmail,
      verstuurdOp: verstuurdOp.toISOString(),
      templateVersie: DEMO_READY_TEMPLATE_VERSION,
      opnieuw,
      demoUrl: websiteUrl,
      portaalUrl,
      mailId: mail.id,
    },
  );
  await logActivity({
    actorUserId: actor.id,
    action: opnieuw ? "DEMO_RESENT" : "DEMO_SENT",
    objectType: "lead",
    objectId: leadId,
    newValue: { to: loginEmail, templateVersie: DEMO_READY_TEMPLATE_VERSION },
  });

  // Partner automatisch informeren — alléén bij een partner-/affiliate-aanvraag.
  // Idempotent op basis van de timeline: de partner wordt hooguit één keer per
  // lead gemaild, maar wél alsnog bij een re-send als het de vorige keer niet
  // is gelukt (of vóór deze feature bestond). De partner krijgt uitsluitend de
  // publieke voorbeeldwebsite te zien — nooit de portaal-/loginlink.
  const partnerNotifyFailed =
    (await notifyPartner(leadId, "demo-verstuurd", { publicDemoUrl: websiteUrl })) ===
    "failed";

  revalidatePath(`/admin/leads/${leadId}`);
  return {
    status: "success",
    message: partnerNotifyFailed
      ? "Demo verstuurd — maar de partner kon niet automatisch worden gemaild. Probeer 'opnieuw versturen' of check de logs."
      : opnieuw
        ? `Demo opnieuw verstuurd naar ${loginEmail}.`
        : `Demo verstuurd naar ${loginEmail} en journey bijgewerkt.`,
  };
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
