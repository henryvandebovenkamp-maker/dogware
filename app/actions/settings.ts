"use server";

import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-auth";
import { logActivity } from "@/lib/audit";
import { clearEmailLogoCache } from "@/lib/site-settings";

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const SINGLETON = "singleton";

/** E-maillogo-override opslaan (Super Admin). URL komt van de UploadThing-upload. */
export async function saveEmailLogo(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  const url = String(formData.get("url") ?? "").trim();
  if (!/^https:\/\/\S+$/i.test(url)) {
    return { status: "error", message: "Geen geldige logo-URL ontvangen." };
  }

  await db
    .insert(schema.siteSettings)
    .values({ id: SINGLETON, emailLogoUrl: url, updatedByUserId: actor.id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.siteSettings.id,
      set: { emailLogoUrl: url, updatedByUserId: actor.id, updatedAt: new Date() },
    });

  clearEmailLogoCache();
  await logActivity({
    actorUserId: actor.id,
    action: "EMAIL_LOGO_CHANGED",
    objectType: "settings",
    objectId: SINGLETON,
    newValue: { emailLogoUrl: url },
  });
  revalidatePath("/admin/instellingen");
  return { status: "success", message: "E-maillogo opgeslagen. Nieuwe mails gebruiken het meteen." };
}

/** Terug naar het standaard e-maillogo (override verwijderen). */
export async function resetEmailLogo(): Promise<SettingsActionState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  await db
    .insert(schema.siteSettings)
    .values({ id: SINGLETON, emailLogoUrl: null, updatedByUserId: actor.id, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.siteSettings.id,
      set: { emailLogoUrl: null, updatedByUserId: actor.id, updatedAt: new Date() },
    });

  clearEmailLogoCache();
  await logActivity({
    actorUserId: actor.id,
    action: "EMAIL_LOGO_RESET",
    objectType: "settings",
    objectId: SINGLETON,
  });
  revalidatePath("/admin/instellingen");
  return { status: "success", message: "Teruggezet naar het standaard e-maillogo." };
}
