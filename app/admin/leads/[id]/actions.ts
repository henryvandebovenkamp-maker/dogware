"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/schema";
import { isAdminAllowed } from "@/lib/admin-auth";

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
  const token = String(formData.get("token") ?? "") || undefined;
  if (!isAdminAllowed(token)) {
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

  try {
    await db
      .update(schema.leads)
      .set({ status, notities: notities || null })
      .where(eq(schema.leads.id, id));
  } catch {
    return { status: "error", message: "Opslaan mislukt. Probeer opnieuw." };
  }

  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
  return { status: "success", message: "Opgeslagen." };
}
