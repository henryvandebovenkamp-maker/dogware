"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { getAdminActor } from "@/lib/admin-auth";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent, setStage } from "@/lib/journey";
import { sendDemoReady, sendPartnerDemoSent } from "@/lib/email/send";

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
  const portaal =
    String(formData.get("portaal") ?? "").trim() || lead.demoPortalUrl || "";
  if (!portaal) {
    return {
      status: "error",
      message: "Vul eerst de demoportaal-URL in (dat is de inloglink).",
    };
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

  // Links normaliseren; de klant logt op het demoportaal in met het bekende
  // e-mailadres (passwordless — geen vooraf gegenereerde magic-link nodig).
  const websiteUrl = website.startsWith("http") ? website : `https://${website}`;
  const portaalUrl = portaal.startsWith("http") ? portaal : `https://${portaal}`;

  // Uitsluitend gegevens uit de aanvraag — nooit aannames.
  const firstName = lead.naam.trim().split(/\s+/)[0] || lead.naam.trim();
  const modules = [...(lead.diensten ?? []), ...(lead.functies ?? [])];

  const mail = await sendDemoReady(
    loginEmail,
    firstName,
    portaalUrl,
    websiteUrl,
    modules,
    lead.bedrijfsnaam?.trim() || undefined,
  );
  if (!mail.ok) {
    return { status: "error", message: mail.error.message };
  }

  await db
    .update(schema.leads)
    .set({
      demoDomain: website,
      demoPortalUrl: portaal,
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

  // Partner automatisch informeren — alléén bij een partner-/affiliate-aanvraag.
  // Idempotent op basis van de timeline: de partner wordt hooguit één keer per
  // lead gemaild, maar wél alsnog bij een re-send als het de vorige keer niet
  // is gelukt (of vóór deze feature bestond). De partner krijgt uitsluitend de
  // publieke voorbeeldwebsite te zien — nooit de portaal-/loginlink.
  let partnerNotifyFailed = false;
  if (lead.affiliatePartnerId) {
    const result = await notifyPartnerDemoSent(db, {
      leadId,
      partnerId: lead.affiliatePartnerId,
      publicDemoUrl: websiteUrl,
      klantBedrijfsnaam: lead.bedrijfsnaam?.trim() || undefined,
    });
    partnerNotifyFailed = result === "failed";
  }

  revalidatePath(`/admin/leads/${leadId}`);
  return {
    status: "success",
    message: partnerNotifyFailed
      ? "Demo verstuurd — maar de partner kon niet automatisch worden gemaild. Probeer 'opnieuw versturen' of check de logs."
      : "Demo verstuurd en journey bijgewerkt.",
  };
}

/**
 * Stuurt de partner een persoonlijk "de demo is verstuurd"-berichtje en legt
 * dit vast in de timeline. Faalt nooit hard (throwt niet): de klant is al
 * gemaild. Idempotent: al eerder gestuurd → "skipped".
 *
 * @returns "sent" (nu verstuurd), "skipped" (al eerder gebeurd) of "failed"
 *          (geen e-mail bekend of verzenden mislukt — wordt gelogd).
 */
async function notifyPartnerDemoSent(
  db: NonNullable<ReturnType<typeof getDb>>,
  {
    leadId,
    partnerId,
    publicDemoUrl,
    klantBedrijfsnaam,
  }: {
    leadId: string;
    partnerId: string;
    publicDemoUrl: string;
    klantBedrijfsnaam?: string;
  },
): Promise<"sent" | "skipped" | "failed"> {
  try {
    // Al eerder geïnformeerd? Dan niets doen (voorkomt dubbele berichten).
    const [existing] = await db
      .select({ id: schema.journeyEvents.id })
      .from(schema.journeyEvents)
      .where(
        and(
          eq(schema.journeyEvents.leadId, leadId),
          eq(schema.journeyEvents.kind, "partner_notified"),
        ),
      )
      .limit(1);
    if (existing) return "skipped";

    const [partner] = await db
      .select({
        voornaam: schema.partners.voornaam,
        naam: schema.users.naam,
        email: schema.users.email,
      })
      .from(schema.partners)
      .leftJoin(schema.users, eq(schema.users.id, schema.partners.userId))
      .where(eq(schema.partners.id, partnerId))
      .limit(1);

    if (!partner?.email) {
      console.error(
        JSON.stringify({ evt: "partner_notify.no_email", leadId, partnerId }),
      );
      return "failed";
    }

    const firstName =
      partner.voornaam?.trim() ||
      partner.naam?.trim().split(/\s+/)[0] ||
      "partner";

    const mail = await sendPartnerDemoSent(
      partner.email,
      firstName,
      publicDemoUrl,
      klantBedrijfsnaam,
    );
    if (!mail.ok) {
      console.error(
        JSON.stringify({
          evt: "partner_notify.mail_failed",
          leadId,
          partnerId,
          error: mail.error.message,
        }),
      );
      return "failed";
    }

    await logJourneyEvent(
      leadId,
      "partner_notified",
      `Partner automatisch geïnformeerd: ${partner.email}`,
      { partnerId },
    );
    return "sent";
  } catch (err) {
    // Bewust nooit throwen: de klant is al gemaild. Wel loggen zodat het
    // zichtbaar is en niet stil verdwijnt.
    console.error(
      JSON.stringify({
        evt: "partner_notify.exception",
        leadId,
        partnerId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return "failed";
  }
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
