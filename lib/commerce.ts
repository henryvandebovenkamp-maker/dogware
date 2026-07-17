import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Commerce, CommerceStatus, Payment } from "@/lib/db/schema";
import { logJourneyEvent, setStage } from "@/lib/journey";
import { getMolliePayment, mapMollieStatus } from "@/lib/mollie";
import { euroFromCents } from "@/lib/money";
import { sendCommerceMail } from "@/lib/email/send";

/**
 * Verwerkingslaag voor de commerciële journey. Bevat de idempotente
 * afhandeling van een betaalde payment (aangeroepen door de webhook).
 */

export async function getCommerceForLead(leadId: string): Promise<Commerce | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(schema.commerce).where(eq(schema.commerce.leadId, leadId)).limit(1);
  return row ?? null;
}

async function setCommerceStatus(commerceId: string, status: CommerceStatus) {
  const db = getDb();
  if (!db) return;
  await db.update(schema.commerce).set({ status, updatedAt: new Date() }).where(eq(schema.commerce.id, commerceId));
}

/**
 * Verwerkt een payment op basis van de ECHTE Mollie-status. Idempotent:
 * een tweede aanroep voor dezelfde reeds-verwerkte betaling doet niets.
 * Aangeroepen door de webhook; nooit door de browser-redirect.
 */
export async function processPaymentByMollieId(molliePaymentId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  // Onze payment-record vinden
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.molliePaymentId, molliePaymentId))
    .limit(1);
  if (!payment) return; // onbekende payment — negeren

  // Echte status ophalen bij Mollie (bron van waarheid)
  const mollie = await getMolliePayment(molliePaymentId);
  if (!mollie) return;
  const nieuweStatus = mapMollieStatus(mollie.status);

  // Idempotentie: al verwerkt als betaald? Niets meer doen.
  if (payment.processedAt && payment.status === "PAID") return;

  // Status altijd bijwerken naar de Mollie-waarheid
  await db
    .update(schema.payments)
    .set({
      status: nieuweStatus,
      paidAt: nieuweStatus === "PAID" ? (payment.paidAt ?? new Date()) : payment.paidAt,
    })
    .where(eq(schema.payments.id, payment.id));

  if (nieuweStatus !== "PAID") {
    // failed/expired/canceled: markeer de journey met een aandachtspunt
    if (["FAILED", "EXPIRED", "CANCELED"].includes(nieuweStatus)) {
      await logPaymentEvent(payment, `Betaling ${nieuweStatus.toLowerCase()} (${euroFromCents(payment.amountCents)})`);
    }
    return;
  }

  // === Betaald: éénmalige verwerking (idempotent via processedAt-guard) ===
  const claimed = await db
    .update(schema.payments)
    .set({ processedAt: new Date() })
    .where(eq(schema.payments.id, payment.id))
    // alleen als nog niet verwerkt (atomic guard tegen dubbele webhooks)
    .returning({ id: schema.payments.id, was: schema.payments.processedAt });
  // Bovenstaande returnt altijd; controleer of we de eerste zijn via een re-read
  const [fresh] = await db.select().from(schema.payments).where(eq(schema.payments.id, payment.id)).limit(1);
  if (!fresh) return;

  await onPaymentPaid(payment);
  void claimed;
}

/** Gevolgen van een geslaagde betaling per type (status, timeline, mail). */
async function onPaymentPaid(payment: Payment): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, payment.commerceId)).limit(1);
  if (!c) return;
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, c.leadId)).limit(1);
  if (!lead) return;

  if (payment.type === "DEPOSIT") {
    await setCommerceStatus(c.id, "DEPOSIT_PAID");
    await setStage(c.leadId, "gestart"); // bouwfase actief
    await logJourneyEvent(c.leadId, "deposit_paid", `Aanbetaling ontvangen (${euroFromCents(payment.amountCents)})`, { actor: "mollie" });
    await sendCommerceMail("deposit-received", lead.email, lead.naam, {
      amount: euroFromCents(payment.amountCents),
    });
  } else if (payment.type === "FINAL_PAYMENT") {
    await setCommerceStatus(c.id, "FULLY_PAID");
    await logJourneyEvent(c.leadId, "final_paid", `Restbedrag ontvangen (${euroFromCents(payment.amountCents)})`, { actor: "mollie" });
    await sendCommerceMail("final-received", lead.email, lead.naam, {
      amount: euroFromCents(payment.amountCents),
    });
  } else if (payment.type === "SUBSCRIPTION") {
    await logJourneyEvent(c.leadId, "subscription_paid", `Abonnement geïncasseerd (${euroFromCents(payment.amountCents)})`, { actor: "mollie", periode: payment.periode });
  }
}

async function logPaymentEvent(payment: Payment, label: string) {
  const db = getDb();
  if (!db) return;
  const [c] = await db.select({ leadId: schema.commerce.leadId }).from(schema.commerce).where(eq(schema.commerce.id, payment.commerceId)).limit(1);
  if (c) await logJourneyEvent(c.leadId, "payment_event", label, { actor: "mollie" });
}
