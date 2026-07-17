import "server-only";
import createMollieClient, { type MollieClient } from "@mollie/api-client";
import { branding } from "@/lib/branding";

/**
 * Mollie-servicewrapper. Configuratie via MOLLIE_API_KEY (test_ of live_).
 * Degradeert netjes wanneer de key ontbreekt: isMollieConfigured() is dan
 * false en de commerciële acties tonen een nette melding i.p.v. te crashen.
 *
 * Mollie blijft de bron van waarheid voor de externe betaalstatus; onze
 * database bewaart alleen de gekoppelde interne status.
 */

let client: MollieClient | null = null;

export function isMollieConfigured(): boolean {
  return Boolean(process.env.MOLLIE_API_KEY);
}

/** True in testmodus (test_-key). */
export function isMollieTestMode(): boolean {
  return (process.env.MOLLIE_API_KEY ?? "").startsWith("test_");
}

function getClient(): MollieClient | null {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) return null;
  if (!client) client = createMollieClient({ apiKey: key });
  return client;
}

/** Absolute webhook-URL — altijd het live domein, nooit localhost/preview. */
export function webhookUrl(): string {
  return `${branding.siteUrl}/api/mollie/webhook`;
}

/** Centen → Mollie-bedragobject ("12.34"). */
export function centsToMollie(cents: number): { currency: "EUR"; value: string } {
  return { currency: "EUR", value: (cents / 100).toFixed(2) };
}

export type CreatePaymentResult =
  | { ok: true; molliePaymentId: string; checkoutUrl: string }
  | { ok: false; message: string };

/** Maak een eenmalige iDEAL-betaling aan; bedrag komt server-side binnen. */
export async function createMolliePayment(params: {
  amountCents: number;
  description: string;
  redirectUrl: string;
  metadata: Record<string, string>;
}): Promise<CreatePaymentResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Betalen is nog niet geconfigureerd." };
  try {
    const payment = await c.payments.create({
      amount: centsToMollie(params.amountCents),
      description: params.description,
      redirectUrl: params.redirectUrl,
      webhookUrl: webhookUrl(),
      metadata: params.metadata,
    });
    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) return { ok: false, message: "Geen betaallink ontvangen." };
    return { ok: true, molliePaymentId: payment.id, checkoutUrl };
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "mollie.create_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return { ok: false, message: "Betaling kon niet worden gestart." };
  }
}

/** Haal de actuele status van een payment op bij Mollie (bron van waarheid). */
export async function getMolliePayment(molliePaymentId: string) {
  const c = getClient();
  if (!c) return null;
  try {
    return await c.payments.get(molliePaymentId);
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "mollie.get_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return null;
  }
}

/** Mollie-status → onze interne PaymentStatus. */
export function mapMollieStatus(status: string):
  | "OPEN" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELED" | "REFUNDED" {
  switch (status) {
    case "paid": return "PAID";
    case "pending": return "PENDING";
    case "open": return "OPEN";
    case "failed": return "FAILED";
    case "expired": return "EXPIRED";
    case "canceled": return "CANCELED";
    default: return "OPEN";
  }
}
