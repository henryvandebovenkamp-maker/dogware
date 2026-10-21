"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-auth";
import { getFinanceActor } from "@/lib/finance-auth";
import {
  bereidUitbetalingVoor,
  controleerCommissie,
  keurUitbetalingGoed,
  mailPartner,
  markeerUitbetaald,
  trekVoorbereidingIn,
} from "@/lib/partner-commissies";

/**
 * Beheeracties rond partnercommissies.
 *
 * Elke action controleert zelf de actor — actions zijn ook via een directe
 * POST bereikbaar, de layout van /admin beschermt ze niet.
 *
 * - Controleren, voorbereiden en intrekken: elke beheerder (SUPER_ADMIN).
 * - Goedkeuren en als uitbetaald markeren: uitsluitend een beheerder met de
 *   financiële bevoegdheid (FINANCE_APPROVER, zie lib/finance-auth.ts).
 */

export type CommissieActieState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const GEEN_TOEGANG: CommissieActieState = { status: "error", message: "Geen toegang." };
const GEEN_FINANCIEEL: CommissieActieState = {
  status: "error",
  message: "Alleen een financieel bevoegde beheerder mag dit doen.",
};

function uit(r: { ok: boolean; melding: string }): CommissieActieState {
  return { status: r.ok ? "success" : "error", message: r.melding };
}

/** De partner bij een commissie, voor revalidatie van de juiste pagina. */
async function partnerVan(commissieId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [rij] = await db
    .select({ partnerId: schema.partnerCommissions.partnerId })
    .from(schema.partnerCommissions)
    .where(eq(schema.partnerCommissions.id, commissieId))
    .limit(1);
  return rij?.partnerId ?? null;
}

async function ververs(partnerId: string | null, leadId?: string) {
  if (partnerId) revalidatePath(`/admin/partners/${partnerId}`);
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/partner");
}

export async function controleerCommissieActie(
  _prev: CommissieActieState,
  formData: FormData,
): Promise<CommissieActieState> {
  const actor = await getAdminActor();
  if (!actor) return GEEN_TOEGANG;
  const leadId = String(formData.get("leadId") ?? "");
  const r = await controleerCommissie(leadId, actor.id);
  const db = getDb();
  const [lead] = db
    ? await db
        .select({ partnerId: schema.leads.affiliatePartnerId })
        .from(schema.leads)
        .where(eq(schema.leads.id, leadId))
        .limit(1)
    : [];
  await ververs(lead?.partnerId ?? null, leadId);
  return uit(r);
}

export async function bereidUitbetalingVoorActie(
  _prev: CommissieActieState,
  formData: FormData,
): Promise<CommissieActieState> {
  const actor = await getAdminActor();
  if (!actor) return GEEN_TOEGANG;
  const commissieId = String(formData.get("commissieId") ?? "");
  const r = await bereidUitbetalingVoor(commissieId, actor.id, {
    rekeninghouder: String(formData.get("rekeninghouder") ?? ""),
    iban: String(formData.get("iban") ?? ""),
  });
  await ververs(await partnerVan(commissieId));
  return uit(r);
}

export async function keurUitbetalingGoedActie(
  _prev: CommissieActieState,
  formData: FormData,
): Promise<CommissieActieState> {
  const actor = await getFinanceActor();
  if (!actor) return GEEN_FINANCIEEL;
  const commissieId = String(formData.get("commissieId") ?? "");
  const r = await keurUitbetalingGoed(commissieId, actor.id);
  await ververs(await partnerVan(commissieId));
  return uit(r);
}

export async function markeerUitbetaaldActie(
  _prev: CommissieActieState,
  formData: FormData,
): Promise<CommissieActieState> {
  const actor = await getFinanceActor();
  if (!actor) return GEEN_FINANCIEEL;
  // Expliciete bevestiging: dit is de stap die de partner een betaalbevestiging stuurt.
  if (String(formData.get("bevestigd") ?? "") !== "1") {
    return { status: "error", message: "Bevestig dat de overschrijving daadwerkelijk is uitgevoerd." };
  }
  const commissieId = String(formData.get("commissieId") ?? "");
  const r = await markeerUitbetaald(commissieId, actor.id, {
    datum: String(formData.get("datum") ?? ""),
    referentie: String(formData.get("referentie") ?? ""),
    bedrag: String(formData.get("bedrag") ?? ""),
  });
  await ververs(await partnerVan(commissieId));
  return uit(r);
}

export async function trekVoorbereidingInActie(
  _prev: CommissieActieState,
  formData: FormData,
): Promise<CommissieActieState> {
  const actor = await getAdminActor();
  if (!actor) return GEEN_TOEGANG;
  const commissieId = String(formData.get("commissieId") ?? "");
  const r = await trekVoorbereidingIn(commissieId, actor.id, String(formData.get("reden") ?? ""));
  await ververs(await partnerVan(commissieId));
  return uit(r);
}

/** Een eerder mislukt commissiebericht opnieuw versturen (nooit een tweede keer na succes). */
export async function verstuurCommissieMailOpnieuw(
  _prev: CommissieActieState,
  formData: FormData,
): Promise<CommissieActieState> {
  const actor = await getAdminActor();
  if (!actor) return GEEN_TOEGANG;
  const commissieId = String(formData.get("commissieId") ?? "");
  const moment = String(formData.get("moment") ?? "") === "uitbetaald" ? "uitbetaald" : "uitbetaalbaar";
  const r = await mailPartner(commissieId, moment);
  await ververs(await partnerVan(commissieId));
  return uit(r);
}
