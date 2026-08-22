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
  | { ok: true; molliePaymentId: string; checkoutUrl: string; usedSequence: SequenceType }
  | { ok: false; message: string };

/**
 * "oneoff"    — losse betaling, geen mandaat.
 * "first"     — losse betaling die tevens een doorlopend SEPA-mandaat vestigt.
 * "recurring" — incasso op een bestaand mandaat (zonder checkout).
 */
export type SequenceType = "oneoff" | "first" | "recurring";

/**
 * Maak een betaling aan; het bedrag komt uitsluitend server-side binnen.
 *
 * Bij `sequenceType: "first"` wordt de betaling aan een Mollie-customer
 * gekoppeld zodat er een mandaat ontstaat voor de latere maandincasso. Lukt
 * dat niet (bijvoorbeeld omdat de klant een betaalmethode zonder mandaat
 * kiest), dan valt de betaling automatisch terug op een losse betaling — de
 * klant kan dan gewoon betalen en het mandaat regelen we apart. Beter dan een
 * mislukte checkout.
 */
export async function createMolliePayment(params: {
  amountCents: number;
  description: string;
  redirectUrl: string;
  metadata: Record<string, string>;
  /** Onze eigen referentie; verschijnt op het Mollie-dashboard. */
  reference?: string;
  sequenceType?: SequenceType;
  mollieCustomerId?: string | null;
}): Promise<CreatePaymentResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Betalen is nog niet geconfigureerd." };

  const base = {
    amount: centsToMollie(params.amountCents),
    description: params.description,
    redirectUrl: params.redirectUrl,
    webhookUrl: webhookUrl(),
    metadata: params.metadata,
  };

  const wilMandaat = params.sequenceType === "first" && Boolean(params.mollieCustomerId);

  const pogingen: { payload: Record<string, unknown>; sequence: SequenceType }[] = wilMandaat
    ? [
        {
          payload: { ...base, customerId: params.mollieCustomerId, sequenceType: "first" },
          sequence: "first",
        },
        { payload: base, sequence: "oneoff" },
      ]
    : [{ payload: base, sequence: "oneoff" }];

  let laatsteFout = "Betaling kon niet worden gestart.";
  for (const poging of pogingen) {
    try {
      // De typings van de client dekken sequenceType/customerId op deze plek
      // niet af; de API doet dat wel.
      const payment = await c.payments.create(
        poging.payload as unknown as Parameters<typeof c.payments.create>[0],
      );
      const checkoutUrl = payment.getCheckoutUrl();
      if (!checkoutUrl) {
        laatsteFout = "Geen betaallink ontvangen.";
        continue;
      }
      return {
        ok: true,
        molliePaymentId: payment.id,
        checkoutUrl,
        usedSequence: poging.sequence,
      };
    } catch (err) {
      laatsteFout = "Betaling kon niet worden gestart.";
      console.error(
        JSON.stringify({
          evt: "mollie.create_error",
          at: new Date().toISOString(),
          sequence: poging.sequence,
          error: err instanceof Error ? err.message : "onbekend",
        }),
      );
    }
  }
  return { ok: false, message: laatsteFout };
}

/* ---------------------------------------------------------------------------
 * Customers en mandaten — de basis onder de automatische maandincasso.
 * ------------------------------------------------------------------------- */

/**
 * Geeft de bestaande Mollie-customer terug of maakt er één aan.
 *
 * `existingId` is altijd leidend: bestaat die al, dan maken we er beslist geen
 * tweede bij. Dubbele customers betekenen dubbele mandaten en uiteindelijk
 * dubbele incasso.
 */
export async function ensureMollieCustomer(params: {
  existingId?: string | null;
  name: string;
  email: string;
}): Promise<string | null> {
  const c = getClient();
  if (!c) return null;

  if (params.existingId) {
    try {
      const bestaand = await c.customers.get(params.existingId);
      if (bestaand?.id) return bestaand.id;
    } catch {
      // De opgeslagen customer bestaat niet meer bij Mollie (bijv. na een
      // wissel test→live). Dan pas een nieuwe aanmaken.
    }
  }

  try {
    const created = await c.customers.create({
      name: params.name.slice(0, 255),
      email: params.email,
    });
    return created.id;
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "mollie.customer_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return null;
  }
}

/** Het eerste geldige mandaat van een customer, of null. */
export async function findValidMandate(
  mollieCustomerId: string,
): Promise<{ id: string; status: string } | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const page = await c.customerMandates.page({ customerId: mollieCustomerId });
    for (const m of page) {
      if (m.status === "valid") return { id: m.id, status: m.status };
    }
    return null;
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "mollie.mandate_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return null;
  }
}

/** Bestaat er al een lopend abonnement voor deze customer? Voorkomt dubbelen. */
export async function findActiveSubscription(
  mollieCustomerId: string,
): Promise<{ id: string } | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const page = await c.customerSubscriptions.page({ customerId: mollieCustomerId });
    for (const s of page) {
      if (s.status === "active" || s.status === "pending") return { id: s.id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Maakt het maandelijkse abonnement aan. `startDate` bepaalt de eerste
 * incassodatum — nooit vandaag, tenzij dat werkelijk de afgesproken startdag
 * is. Idempotent: bestaat er al een actief abonnement, dan komt dat terug.
 */
export async function createMollieSubscription(params: {
  mollieCustomerId: string;
  amountCents: number;
  description: string;
  /** ISO-datum "YYYY-MM-DD" van de eerste incasso. */
  startDate: string;
  metadata: Record<string, string>;
}): Promise<{ ok: true; subscriptionId: string } | { ok: false; message: string }> {
  const c = getClient();
  if (!c) return { ok: false, message: "Betalen is nog niet geconfigureerd." };

  const bestaand = await findActiveSubscription(params.mollieCustomerId);
  if (bestaand) return { ok: true, subscriptionId: bestaand.id };

  try {
    const sub = await c.customerSubscriptions.create({
      customerId: params.mollieCustomerId,
      amount: centsToMollie(params.amountCents),
      interval: "1 month",
      startDate: params.startDate,
      description: params.description.slice(0, 255),
      webhookUrl: webhookUrl(),
      metadata: params.metadata,
    });
    return { ok: true, subscriptionId: sub.id };
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "mollie.subscription_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return { ok: false, message: "Abonnement kon niet worden aangemaakt." };
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
