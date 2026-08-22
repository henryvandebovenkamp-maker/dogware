import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { logJourneyEvent } from "@/lib/journey";
import { sendPartnerDemoSent, sendPartnerMilestone } from "@/lib/email/send";
import type { PartnerMilestone } from "@/lib/email/templates/partner-milestone";

/**
 * De partner op de hoogte houden van een aanvraag die hij heeft aangebracht.
 *
 * Waarom dit één module is en geen losse aanroepen: elk moment kent dezelfde
 * drie regels, en die moeten op elk moment gelden.
 *
 * 1. Alleen bij een partner-/affiliate-aanvraag — een organische lead heeft
 *    geen partner om te informeren.
 * 2. Hooguit één mail per moment per aanvraag. De tijdlijn is de bron: staat
 *    er al een `partner_notified` voor dit moment, dan gebeurt er niets. Wel
 *    alsnog een poging als het de vorige keer misging.
 * 3. Nooit hard falen. De klant is op al deze momenten al gemaild; een partner
 *    die geen berichtje krijgt mag nooit de klantflow blokkeren. Fouten worden
 *    gelogd, niet gegooid.
 *
 * De tijdlijnregel is intern (`internal: true`): het e-mailadres van de
 * partner heeft niets te zoeken in het portaal van de klant.
 */
export type PartnerNotifyMoment = "demo-verstuurd" | PartnerMilestone;

export type PartnerNotifyResult =
  /** Mail is zojuist verstuurd. */
  | "sent"
  /** Deze partner is voor dit moment al eerder geïnformeerd. */
  | "skipped"
  /** Geen e-mailadres bekend of het versturen mislukte — gelogd. */
  | "failed"
  /** Geen partner aan deze aanvraag gekoppeld; er valt niets te melden. */
  | "geen-partner";

const MOMENT_LABEL: Record<PartnerNotifyMoment, string> = {
  "demo-verstuurd": "demo verstuurd",
  "voorstel-verstuurd": "voorstel verstuurd",
  "voorstel-akkoord": "voorstel geaccepteerd",
  "overeenkomst-getekend": "overeenkomst getekend",
};

export async function notifyPartner(
  leadId: string,
  moment: PartnerNotifyMoment,
  opts: { publicDemoUrl?: string } = {},
): Promise<PartnerNotifyResult> {
  const db = getDb();
  if (!db) return "failed";

  try {
    const [lead] = await db
      .select({
        partnerId: schema.leads.affiliatePartnerId,
        bedrijfsnaam: schema.leads.bedrijfsnaam,
      })
      .from(schema.leads)
      .where(eq(schema.leads.id, leadId))
      .limit(1);
    if (!lead?.partnerId) return "geen-partner";

    /*
     * Al gemeld? De oudste regels (van vóór dit systeem) hebben geen `moment`
     * in hun meta; die gingen altijd over de demo. Zonder die aanname zou
     * iedere bestaande partner alsnog een dubbele demomail krijgen.
     */
    const eerder = await db
      .select({ meta: schema.journeyEvents.meta })
      .from(schema.journeyEvents)
      .where(
        and(
          eq(schema.journeyEvents.leadId, leadId),
          eq(schema.journeyEvents.kind, "partner_notified"),
        ),
      );
    const alGemeld = eerder.some(
      (e) => (e.meta?.moment ?? "demo-verstuurd") === moment,
    );
    if (alGemeld) return "skipped";

    const [partner] = await db
      .select({
        voornaam: schema.partners.voornaam,
        naam: schema.users.naam,
        email: schema.users.email,
      })
      .from(schema.partners)
      .leftJoin(schema.users, eq(schema.users.id, schema.partners.userId))
      .where(eq(schema.partners.id, lead.partnerId))
      .limit(1);

    if (!partner?.email) {
      console.error(
        JSON.stringify({
          evt: "partner_notify.no_email",
          leadId,
          partnerId: lead.partnerId,
          moment,
        }),
      );
      return "failed";
    }

    const firstName =
      partner.voornaam?.trim() || partner.naam?.trim().split(/\s+/)[0] || "partner";
    const bedrijf = lead.bedrijfsnaam?.trim() || undefined;

    const mail =
      moment === "demo-verstuurd"
        ? await sendPartnerDemoSent(
            partner.email,
            firstName,
            opts.publicDemoUrl,
            bedrijf,
          )
        : await sendPartnerMilestone(partner.email, firstName, moment, bedrijf);

    if (!mail.ok) {
      console.error(
        JSON.stringify({
          evt: "partner_notify.mail_failed",
          leadId,
          partnerId: lead.partnerId,
          moment,
          error: mail.error.message,
        }),
      );
      return "failed";
    }

    await logJourneyEvent(
      leadId,
      "partner_notified",
      `Partner geïnformeerd (${MOMENT_LABEL[moment]}): ${partner.email}`,
      { partnerId: lead.partnerId, moment, internal: true },
    );
    return "sent";
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "partner_notify.exception",
        leadId,
        moment,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return "failed";
  }
}
