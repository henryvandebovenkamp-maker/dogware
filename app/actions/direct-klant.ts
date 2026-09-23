"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-auth";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent } from "@/lib/journey";
import { createOrGetDraft, ensureCommerce } from "@/lib/proposals";
import { leesDirecteKlant, type DirecteKlantVelden } from "@/lib/direct-klant";

export type DirecteKlantState = {
  status: "idle" | "error";
  message?: string;
  /** Veldfouten, zodat het formulier per veld kan aanwijzen wat er mist. */
  velden?: Partial<Record<keyof DirecteKlantVelden, string>>;
  /** Bestaat dit e-mailadres al? Dan wijzen we naar dat dossier. */
  bestaandeLeadId?: string;
  /** Wat er ingevuld was, zodat een fout niets wist. */
  waarden?: DirecteKlantVelden;
};

/**
 * Nieuwe klant toevoegen — de tweede instroomroute.
 *
 * Voor klanten met wie al gesproken is en die geen voorbeeldwebsite nodig
 * hebben. Dit maakt geen tweede klantrecord: het is dezelfde `leads`-rij als
 * elke aanvraag, met dezelfde commerce-rij, hetzelfde voorstelmodel en straks
 * dezelfde overeenkomst, betalingen en partnerkoppeling. Alleen de route is
 * "direct".
 *
 * Na opslaan gaat de beheerder meteen naar de opdrachtbevestiging — niet naar
 * een lege detailpagina.
 */
export async function createDirectCustomer(
  _prev: DirecteKlantState,
  formData: FormData,
): Promise<DirecteKlantState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };

  const gelezen = leesDirecteKlant(formData);
  if (!gelezen.ok) {
    return {
      status: "error",
      message: "Vul de ontbrekende gegevens aan.",
      velden: gelezen.fouten,
      waarden: gelezen.waarden,
    };
  }
  const k = gelezen.waarden;

  /*
   * Staat deze persoon er al in, dan hoort de opdracht bij dát dossier — met
   * de eventuele partnerkoppeling die daar al op zit. Een tweede rij zou de
   * attributie en de historie splitsen. Dit vangt ook een dubbele klik af.
   */
  const [bestaand] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(sql`lower(${schema.leads.email}) = ${k.email}`)
    .limit(1);
  if (bestaand) {
    return {
      status: "error",
      message: "Er bestaat al een dossier met dit e-mailadres. Open dat dossier om de opdracht vast te leggen.",
      bestaandeLeadId: bestaand.id,
      waarden: k,
    };
  }

  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: k.bedrijfsnaam,
      naam: k.naam,
      email: k.email,
      telefoon: k.telefoon,
      plaats: k.plaats,
      website: k.website || null,
      heeftWebsite: k.website ? "ja" : null,
      source: "handmatig",
      journeyVariant: "direct",
      // Commercieel meteen bij de opdracht: er is niets te demonstreren.
      stage: "offerte",
      status: "contact gehad",
    })
    .returning();
  if (!lead) return { status: "error", message: "Opslaan lukte niet.", waarden: k };

  // Beheerderstaal — hoort niet in de tijdlijn die de klant ziet.
  await logJourneyEvent(lead.id, "direct_customer_created", "Directe klant handmatig toegevoegd", {
    actor: "admin",
    internal: true,
  });

  const commerce = await ensureCommerce(lead.id);
  const concept = commerce ? await createOrGetDraft(commerce, lead, actor.id) : null;
  if (concept) {
    await logJourneyEvent(
      lead.id,
      "proposal_created",
      `Opdrachtbevestiging concept aangemaakt (versie ${concept.version})`,
      { actor: "admin" },
    );
  }

  await logActivity({
    actorUserId: actor.id,
    action: "DIRECT_CUSTOMER_CREATED",
    objectType: "lead",
    objectId: lead.id,
    newValue: { bedrijfsnaam: lead.bedrijfsnaam, email: lead.email, journeyVariant: "direct" },
  });

  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${lead.id}/voorstel`);
}
