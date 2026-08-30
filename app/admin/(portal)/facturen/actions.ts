"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-auth";
import { createCreditNote } from "@/lib/documents";
import { sendInvoiceMail } from "@/lib/invoices";
import { logActivity } from "@/lib/audit";

/**
 * Beheeracties op één factuur.
 *
 * Twee dingen die hier bewust NIET staan:
 *
 *  - een knop om een factuur op "betaald" te zetten. De Mollie-webhook is de
 *    bron van waarheid voor geld; een handmatige override maakt de
 *    administratie onbetrouwbaar zonder dat iemand het ziet.
 *  - een knop om een factuur te verwijderen. Corrigeren doe je met een
 *    creditnota, zodat de reeks nummers heel blijft.
 *
 * Beide acties controleren de beheerdersrol zélf: een server action is ook via
 * een directe POST bereikbaar, dus de layout-guard is hier niet genoeg.
 */

export type FactuurState = { status: "idle" | "ok" | "fout"; message?: string };

export async function verstuurFactuur(
  _prev: FactuurState,
  formData: FormData,
): Promise<FactuurState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "fout", message: "Geen toegang." };

  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return { status: "fout", message: "Onbekende factuur." };

  const resultaat = await sendInvoiceMail(documentId, actor.id);
  if (!resultaat.ok) return { status: "fout", message: resultaat.message };

  revalidatePath("/admin/facturen");
  return { status: "ok", message: `Verstuurd naar ${resultaat.ontvanger}.` };
}

/**
 * Dezelfde factuur naar een zelfgekozen adres — jezelf, je boekhouder.
 *
 * Apart van `verstuurFactuur` en niet als extra vinkje daarop: "de klant zijn
 * factuur sturen" en "een kopie naar mezelf sturen" zijn verschillende
 * handelingen met verschillende gevolgen, en die horen niet achter één knop te
 * zitten waar je je in kunt vergissen.
 */
export async function verstuurFactuurKopie(
  _prev: FactuurState,
  formData: FormData,
): Promise<FactuurState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "fout", message: "Geen toegang." };

  const documentId = String(formData.get("documentId") ?? "");
  const naar = String(formData.get("naar") ?? "").trim();
  const publiekeLink = formData.get("publiekeLink") === "on";
  if (!documentId) return { status: "fout", message: "Onbekende factuur." };
  if (!naar) return { status: "fout", message: "Vul een e-mailadres in." };

  const resultaat = await sendInvoiceMail(documentId, actor.id, { naar, publiekeLink });
  if (!resultaat.ok) return { status: "fout", message: resultaat.message };

  revalidatePath("/admin/facturen");
  return {
    status: "ok",
    message: `Kopie verstuurd naar ${resultaat.ontvanger}.`,
  };
}

export async function crediteerFactuur(
  _prev: FactuurState,
  formData: FormData,
): Promise<FactuurState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "fout", message: "Geen toegang." };

  const documentId = String(formData.get("documentId") ?? "");
  const reden = String(formData.get("reden") ?? "").trim();
  if (!documentId) return { status: "fout", message: "Onbekende factuur." };
  if (reden.length < 5) {
    return {
      status: "fout",
      message: "Vul een reden in — die komt in het auditlogboek en op de tijdlijn te staan.",
    };
  }

  const db = getDb();
  const [origineel] = db
    ? await db
        .select({ nummer: schema.documents.nummer })
        .from(schema.documents)
        .where(eq(schema.documents.id, documentId))
        .limit(1)
    : [];

  const resultaat = await createCreditNote(documentId, reden);
  if (!resultaat.ok) return { status: "fout", message: resultaat.message };

  await logActivity({
    actorUserId: actor.id,
    action: "invoice.credited",
    objectType: "document",
    objectId: documentId,
    oldValue: { nummer: origineel?.nummer ?? null },
    newValue: { creditnota: resultaat.nota.nummer },
    reason: reden,
  });

  revalidatePath("/admin/facturen");
  revalidatePath(`/admin/facturen/${encodeURIComponent(resultaat.nota.nummer)}`);
  return { status: "ok", message: `Creditnota ${resultaat.nota.nummer} aangemaakt.` };
}
