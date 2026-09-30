"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/schema";
import { getAdminActor } from "@/lib/admin-auth";
import { bouwprompt } from "@/lib/bouwprompt";
import { logJourneyEvent } from "@/lib/journey";
import { EVENT_HANDMATIG_AFGEVALLEN, EVENT_HEROPEND } from "@/lib/demo-afronding-tekst";

export type UpdateLeadState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** Werk status en interne notities van een lead bij. */
export async function updateLead(
  _prev: UpdateLeadState,
  formData: FormData,
): Promise<UpdateLeadState> {
  // Server actions zijn ook via directe POST bereikbaar — dus ook hier de check.
  const actor = await getAdminActor();
  if (!actor) {
    return { status: "error", message: "Geen toegang." };
  }

  const db = getDb();
  if (!db) {
    return { status: "error", message: "Database niet geconfigureerd." };
  }

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  const notities = String(formData.get("notities") ?? "").slice(0, 10000);

  if (!id || !LEAD_STATUSES.includes(status)) {
    return { status: "error", message: "Ongeldige invoer." };
  }

  let vorige: LeadStatus | null = null;
  try {
    const [huidig] = await db
      .select({ status: schema.leads.status })
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    vorige = huidig?.status ?? null;
    await db
      .update(schema.leads)
      .set({ status, notities: notities || null })
      .where(eq(schema.leads.id, id));
  } catch {
    return { status: "error", message: "Opslaan mislukt. Probeer opnieuw." };
  }

  /*
   * Van of naar "afgevallen" met de hand: op de tijdlijn, zodat later
   * ondubbelzinnig blijft waarom een aanvraag afgevallen is. Een handmatig
   * afgevallen aanvraag is géén afgeronde demo, en een handmatig
   * teruggezette aanvraag is heropend (zie demoAfgerondOp).
   */
  if (vorige && vorige !== status && (vorige === "afgevallen" || status === "afgevallen")) {
    await logJourneyEvent(
      id,
      status === "afgevallen" ? EVENT_HANDMATIG_AFGEVALLEN : EVENT_HEROPEND,
      status === "afgevallen" ? "Aanvraag met de hand op afgevallen gezet" : "Aanvraag heropend (status met de hand aangepast)",
      { actor: "admin", internal: true, door: actor.id, vorigeStatus: vorige, status },
    );
  }

  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
  return { status: "success", message: "Opgeslagen." };
}

/**
 * De bouwprompt voor deze aanvraag, op het moment dat je erom vraagt.
 *
 * Bewust een action en geen prop op de pagina. Ten eerste is de prompt lang;
 * die bij elke paginaweergave meesturen is zonde voor iets waar je zelden op
 * klikt. Ten tweede — en dat is de echte reden — leest hij zo de aanvraag
 * opnieuw. Pas je vanmiddag de plaats aan of voeg je een dienst toe, dan zegt
 * de prompt dat vanmiddag ook. Er wordt niets opgeslagen en niets bevroren.
 */
export async function haalBouwprompt(
  leadId: string,
): Promise<{ ok: true; prompt: string } | { ok: false; message: string }> {
  const actor = await getAdminActor();
  if (!actor) return { ok: false, message: "Geen toegang." };

  const db = getDb();
  if (!db) return { ok: false, message: "Database niet geconfigureerd." };

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);

  if (!lead) return { ok: false, message: "Aanvraag niet gevonden." };

  return { ok: true, prompt: bouwprompt(lead) };
}
