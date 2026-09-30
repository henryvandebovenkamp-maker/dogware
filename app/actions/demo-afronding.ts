"use server";

import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/admin-auth";
import { heropenAanvraag, verstuurDemoAfsluiting } from "@/lib/demo-afronding";

export type AfrondState = { status: "idle" | "success" | "error"; message?: string; proef?: boolean };

/** Stap 2 van "Demo afronden": de afsluitmail versturen, of eerst als proef naar Henry. */
export async function verstuurAfsluitmail(_prev: AfrondState, formData: FormData): Promise<AfrondState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const leadId = String(formData.get("leadId") ?? "");
  const proef = formData.get("proef") === "1";
  const res = await verstuurDemoAfsluiting({
    leadId,
    documentId: String(formData.get("documentId") ?? ""),
    actorId: actor.id,
    onderwerp: String(formData.get("onderwerp") ?? ""),
    tekst: String(formData.get("tekst") ?? ""),
    proef,
  });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  if (!res.ok) return { status: "error", message: res.reden, proef };
  return {
    status: "success",
    proef,
    message: proef ? `Proef verstuurd naar ${res.naar}.` : `Afsluitmail verstuurd naar ${res.naar}. De demo is afgerond.`,
  };
}

/** Een afgeronde aanvraag weer openen. */
export async function heropen(_prev: AfrondState, formData: FormData): Promise<AfrondState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const leadId = String(formData.get("leadId") ?? "");
  const res = await heropenAanvraag({ leadId, actorId: actor.id });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  return res.ok ? { status: "success", message: "Aanvraag heropend." } : { status: "error", message: res.reden };
}
