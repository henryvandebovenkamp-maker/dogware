import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Commerce, CommerceStatus, JourneyStage, Lead, Payment } from "@/lib/db/schema";
import { logJourneyEvent, setStage } from "@/lib/journey";
import {
  createMollieSubscription,
  ensureMollieCustomer,
  findValidMandate,
  getMolliePayment,
  isMollieConfigured,
  mapMollieStatus,
} from "@/lib/mollie";
import { euroFromCents, firstChargeDate } from "@/lib/money";
import { registerInvoiceForPayment } from "@/lib/documents";
import { sendCommerceMail } from "@/lib/email/send";
import { portalUrl } from "@/lib/portal-access";

/**
 * Verwerkingslaag voor de commerciële journey.
 *
 * De webhook is de enige bron van waarheid over betalingen: de terugkeer van
 * de klant uit de Mollie-checkout zegt niets over of er geld is ontvangen.
 * Alles hier is idempotent — Mollie stuurt webhooks meerdere keren, en dat
 * hoort geen tweede factuur, tweede mail of tweede statusstap op te leveren.
 */

export async function getCommerceForLead(leadId: string): Promise<Commerce | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.leadId, leadId))
    .limit(1);
  return row ?? null;
}

export async function setCommerceStatus(commerceId: string, status: CommerceStatus) {
  const db = getDb();
  if (!db) return;
  await db
    .update(schema.commerce)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.commerce.id, commerceId));
}

/** Totaal van de daadwerkelijk betaalde eenmalige termijnen. */
export async function paidTotal(commerceId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)::int` })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.commerceId, commerceId),
        eq(schema.payments.status, "PAID"),
        inArray(schema.payments.type, ["DEPOSIT", "FINAL_PAYMENT", "MANUAL_CORRECTION"]),
      ),
    );
  return row?.total ?? 0;
}

/**
 * Verwerkt een payment op basis van de ECHTE Mollie-status.
 *
 * Aangeroepen door de webhook; nooit door de browser-redirect. Idempotent op
 * twee niveaus: de statusupdate mag herhaald worden, en de eenmalige gevolgen
 * (factuur, mail, stage) zijn afgeschermd met een atomaire claim.
 */
export async function processPaymentByMollieId(molliePaymentId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.molliePaymentId, molliePaymentId))
    .limit(1);
  if (!payment) return; // onbekende payment — negeren

  const mollie = await getMolliePayment(molliePaymentId);
  if (!mollie) return;
  const nieuweStatus = mapMollieStatus(mollie.status);

  // Al volledig afgehandeld? Dan is er niets meer te doen.
  if (payment.processedAt && payment.status === "PAID") return;

  await db
    .update(schema.payments)
    .set({
      status: nieuweStatus,
      paidAt: nieuweStatus === "PAID" ? (payment.paidAt ?? new Date()) : payment.paidAt,
      mollieCustomerId:
        (mollie as unknown as { customerId?: string }).customerId ?? payment.mollieCustomerId,
      mollieMandateId:
        (mollie as unknown as { mandateId?: string }).mandateId ?? payment.mollieMandateId,
      failureReason:
        nieuweStatus === "PAID"
          ? null
          : ((mollie as unknown as { details?: { failureReason?: string } }).details
              ?.failureReason ?? null),
    })
    .where(eq(schema.payments.id, payment.id));

  if (nieuweStatus !== "PAID") {
    if (["FAILED", "EXPIRED", "CANCELED"].includes(nieuweStatus)) {
      await onPaymentNotPaid(payment, nieuweStatus);
    }
    return;
  }

  /*
   * Atomaire claim. `WHERE processed_at IS NULL` maakt dat exact één
   * gelijktijdige webhook een rij terugkrijgt; de andere krijgt er nul en
   * stopt. Dit is de plek die dubbele facturen en dubbele mails voorkomt.
   */
  const geclaimd = await db
    .update(schema.payments)
    .set({ processedAt: new Date() })
    .where(and(eq(schema.payments.id, payment.id), isNull(schema.payments.processedAt)))
    .returning({ id: schema.payments.id });
  if (geclaimd.length === 0) return; // een andere webhook was ons voor

  const [vers] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, payment.id))
    .limit(1);
  await onPaymentPaid(vers ?? payment);
}

/* ------------------------------------------------------------- betaald ---- */

async function loadContext(
  commerceId: string,
): Promise<{ commerce: Commerce; lead: Lead } | null> {
  const db = getDb();
  if (!db) return null;
  const [commerce] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.id, commerceId))
    .limit(1);
  if (!commerce) return null;
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, commerce.leadId))
    .limit(1);
  if (!lead) return null;
  return { commerce, lead };
}

/** Gevolgen van een geslaagde betaling: status, tijdlijn, factuur, mail. */
async function onPaymentPaid(payment: Payment): Promise<void> {
  const db = getDb();
  if (!db) return;
  const ctx = await loadContext(payment.commerceId);
  if (!ctx) return;
  const { commerce, lead } = ctx;

  // Factuur registreren vóór de mail: de klant mag nooit een bevestiging
  // krijgen van iets dat administratief niet is vastgelegd.
  await registerInvoiceForPayment(payment, {
    leadId: lead.id,
    commerceId: commerce.id,
    vatPercent: commerce.vatPercent,
    bedrijfsnaam: lead.bedrijfsnaam,
  });

  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;

  if (payment.type === "DEPOSIT") {
    await db
      .update(schema.commerce)
      .set({
        status: "BUILDING",
        buildStartedAt: commerce.buildStartedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.commerce.id, commerce.id));
    await logJourneyEvent(
      lead.id,
      "deposit_paid",
      `Eerste termijn ontvangen (${euroFromCents(payment.amountCents)})`,
      { actor: "systeem", molliePaymentId: payment.molliePaymentId },
    );
    await setStage(lead.id, "gestart", { reden: "eerste termijn betaald" });
    await logJourneyEvent(lead.id, "build_started", "Bouwfase gestart", { actor: "systeem" });
    await ensureBuildTasks(lead.id);
    await mailAndLog(lead, "deposit-received", { amount: euroFromCents(payment.amountCents) }, link);
    return;
  }

  if (payment.type === "FINAL_PAYMENT") {
    await db
      .update(schema.commerce)
      .set({ status: "FULLY_PAID", updatedAt: new Date() })
      .where(eq(schema.commerce.id, commerce.id));
    await logJourneyEvent(
      lead.id,
      "final_paid",
      `Tweede termijn ontvangen (${euroFromCents(payment.amountCents)})`,
      { actor: "systeem", molliePaymentId: payment.molliePaymentId },
    );
    await setStage(lead.id, "restbetaling", { reden: "tweede termijn betaald" });
    await mailAndLog(lead, "final-received", { amount: euroFromCents(payment.amountCents) }, link);

    // De tweede termijn is ook het moment waarop het mandaat gevestigd wordt.
    await activateMandateAndSubscription(commerce.id);
    return;
  }

  if (payment.type === "SUBSCRIPTION") {
    await logJourneyEvent(
      lead.id,
      "subscription_paid",
      `Abonnement geïncasseerd (${euroFromCents(payment.amountCents)})${payment.periode ? ` — ${payment.periode}` : ""}`,
      { actor: "systeem", periode: payment.periode },
    );
  }
}

async function onPaymentNotPaid(payment: Payment, status: string): Promise<void> {
  const ctx = await loadContext(payment.commerceId);
  if (!ctx) return;
  const labels: Record<string, string> = {
    FAILED: "mislukt",
    EXPIRED: "verlopen",
    CANCELED: "geannuleerd",
  };
  await logJourneyEvent(
    ctx.lead.id,
    "payment_failed",
    `Betaling ${labels[status] ?? status.toLowerCase()} (${euroFromCents(payment.amountCents)})`,
    { actor: "systeem", type: payment.type, molliePaymentId: payment.molliePaymentId },
  );
  // Bewust géén nieuwe status: een mislukte poging zet de journey niet terug.
  // De klant kan het gewoon opnieuw proberen; de CTA blijft staan.
  if (payment.type === "SUBSCRIPTION") {
    await mailAndLog(ctx.lead, "charge-failed", {});
  }
}

/* --------------------------------------------- mandaat en abonnement ------ */

/**
 * Activeert het SEPA-mandaat en zet het abonnement klaar.
 *
 * Onderscheid dat de hele flow draagt: de klant gaf bij het tekenen van de
 * overeenkomst INHOUDELIJK akkoord op het maandbedrag; hier gebeurt de
 * TECHNISCHE activatie. Idempotent en veilig bij herhaling: een bestaand
 * mandaat wordt hergebruikt, een bestaand abonnement niet gedupliceerd, en de
 * eerste incassodatum ligt nooit vóór het afgesproken startmoment.
 */
export async function activateMandateAndSubscription(commerceId: string): Promise<void> {
  const db = getDb();
  if (!db || !isMollieConfigured()) return;
  const ctx = await loadContext(commerceId);
  if (!ctx) return;
  const { commerce, lead } = ctx;

  // Geen abonnement afgesproken? Dan is er niets te incasseren.
  if (commerce.monthlyCents <= 0) {
    await afterSubscriptionSettled(commerce.id, lead.id);
    return;
  }

  const customerId = await ensureMollieCustomer({
    existingId: commerce.mollieCustomerId,
    name: lead.bedrijfsnaam || lead.naam,
    email: lead.email,
  });
  if (!customerId) return;
  if (customerId !== commerce.mollieCustomerId) {
    await db
      .update(schema.commerce)
      .set({ mollieCustomerId: customerId, updatedAt: new Date() })
      .where(eq(schema.commerce.id, commerce.id));
  }

  const mandate = await findValidMandate(customerId);
  if (!mandate) {
    await logJourneyEvent(
      lead.id,
      "mandate_missing",
      "Nog geen geldig incassomandaat — de klant heeft met een methode zonder machtiging betaald.",
      { actor: "systeem", internal: true },
    );
    await setStage(lead.id, "mandaat", { reden: "mandaat nog niet actief" });
    return;
  }

  if (commerce.mollieMandateId !== mandate.id || !commerce.mandateActivatedAt) {
    await db
      .update(schema.commerce)
      .set({
        mollieMandateId: mandate.id,
        mandateStatus: mandate.status,
        mandateActivatedAt: commerce.mandateActivatedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.commerce.id, commerce.id));
    await logJourneyEvent(lead.id, "mandate_active", "Incassomandaat actief", {
      actor: "systeem",
      mandateId: mandate.id,
    });
  }

  // Eerste incassodatum: nooit eerder dan het afgesproken startmoment, en
  // altijd ná de eventuele gratis maanden.
  const basis = commerce.deliveryReadyAt ?? new Date();
  const start = firstChargeDate(
    commerce.subscriptionStartRule,
    basis,
    commerce.subscriptionStartAt ?? undefined,
  );
  start.setMonth(start.getMonth() + Math.max(0, commerce.freeMonths));
  const morgen = new Date();
  morgen.setDate(morgen.getDate() + 1);
  const eerste = start.getTime() < morgen.getTime() ? morgen : start;
  const startDate = `${eerste.getFullYear()}-${String(eerste.getMonth() + 1).padStart(2, "0")}-${String(eerste.getDate()).padStart(2, "0")}`;

  if (!commerce.mollieSubscriptionId) {
    const maandInclBtw = Math.round(
      commerce.monthlyCents * (1 + Math.max(0, commerce.vatPercent) / 100),
    );
    const sub = await createMollieSubscription({
      mollieCustomerId: customerId,
      amountCents: maandInclBtw,
      description: `DogWare abonnement — ${lead.bedrijfsnaam}`,
      startDate,
      metadata: { leadId: lead.id, commerceId: commerce.id, type: "SUBSCRIPTION" },
    });
    if (!sub.ok) {
      /*
       * Het mandaat staat wél, het abonnement niet. Dat is de gevaarlijkste
       * tussenstand die er is: alles lijkt rond, maar er wordt nooit
       * geïncasseerd. Daarom laten we het zichtbaar achter op de tijdlijn en
       * blijft de journey op `mandaat` staan, zodat "website live zetten" de
       * ontbrekende incasso opmerkt.
       */
      await logJourneyEvent(
        lead.id,
        "subscription_failed",
        `Abonnement kon niet worden ingepland: ${sub.message} Het mandaat is wél actief — opnieuw proberen vanuit de aanvraag.`,
        { actor: "systeem", internal: true },
      );
      await setStage(lead.id, "mandaat", { reden: "abonnement nog niet ingepland" });
      return;
    }
    await db
      .update(schema.commerce)
      .set({
        mollieSubscriptionId: sub.subscriptionId,
        subscriptionActivatedAt: new Date(),
        status: "SUBSCRIPTION_SCHEDULED",
        subscriptionStartAt: eerste,
        updatedAt: new Date(),
      })
      .where(eq(schema.commerce.id, commerce.id));
    await logJourneyEvent(
      lead.id,
      "subscription_scheduled",
      `Maandabonnement ingepland — eerste incasso ${eerste.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`,
      { actor: "systeem", subscriptionId: sub.subscriptionId },
    );
    await mailAndLog(
      lead,
      "subscription-started",
      {
        extra: `De eerste incasso van ${euroFromCents(maandInclBtw)} staat gepland op ${eerste.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}.`,
      },
      commerce.portalToken ? portalUrl(commerce.portalToken) : undefined,
    );
  }

  await afterSubscriptionSettled(commerce.id, lead.id);
}

/** Alles rond? Dan mag de journey naar "mandaat geregeld". */
async function afterSubscriptionSettled(commerceId: string, leadId: string): Promise<void> {
  await setStage(leadId, "mandaat", { reden: "incasso geregeld" });
  void commerceId;
}

/* ------------------------------------------------------------- helpers ---- */

/** Standaardtaken voor de bouwfase. Idempotent: bestaat er al een, dan niets. */
async function ensureBuildTasks(leadId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const bestaand = await db
    .select({ id: schema.journeyTasks.id })
    .from(schema.journeyTasks)
    .where(
      and(
        eq(schema.journeyTasks.leadId, leadId),
        eq(schema.journeyTasks.label, BUILD_TASKS[0]),
      ),
    )
    .limit(1);
  if (bestaand.length > 0) return;
  await db
    .insert(schema.journeyTasks)
    .values(BUILD_TASKS.map((label) => ({ leadId, label })));
}

const BUILD_TASKS = [
  "Project inrichten en repository aanmaken",
  "Huisstijl en content verzamelen",
  "Eerste concept bouwen",
  "Concept voorleggen aan de klant",
  "Feedback verwerken",
  "Oplevering klaarzetten",
];

/** Verstuurt een mail en legt het resultaat vast op de tijdlijn. */
export async function mailAndLog(
  lead: Lead,
  type: Parameters<typeof sendCommerceMail>[0],
  vars: { amount?: string; extra?: string } = {},
  ctaUrl?: string,
): Promise<boolean> {
  const mail = await sendCommerceMail(type, lead.email, lead.naam, vars, ctaUrl);
  await logJourneyEvent(
    lead.id,
    mail.ok ? "email_sent" : "email_failed",
    mail.ok
      ? `E-mail verstuurd naar ${lead.email} (${type})`
      : `E-mail mislukt (${type}): ${mail.error.message}`,
    { actor: "systeem", mailType: type, internal: !mail.ok },
  );
  return mail.ok;
}

/** Zet de journey naar een stage én de commerce-status in één handeling. */
export async function advance(
  leadId: string,
  commerceId: string,
  stage: JourneyStage,
  status: CommerceStatus,
  reden?: string,
): Promise<void> {
  await setCommerceStatus(commerceId, status);
  await setStage(leadId, stage, { reden });
}
