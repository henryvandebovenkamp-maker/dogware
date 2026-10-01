import "server-only";
import { and, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type {
  Commerce,
  CommerceStatus,
  JourneyStage,
  Lead,
  Payment,
  PaymentInstallment,
} from "@/lib/db/schema";
import { logEmail, logJourneyEvent, setStage } from "@/lib/journey";
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
import { isUniekeSchending } from "@/lib/db-errors";
import {
  markInstallmentPaid,
  scheduleForAgreement,
  scheduleForCommerce,
} from "@/lib/payment-schedule";
import { datumLang } from "@/lib/payment-plan";
import { COMMERCE_SUBJECTS, sendCommerceMail } from "@/lib/email/send";
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
        inArray(schema.payments.type, ["DEPOSIT", "FINAL_PAYMENT", "INSTALLMENT", "MANUAL_CORRECTION"]),
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

  const [bestaand] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.molliePaymentId, molliePaymentId))
    .limit(1);

  const mollie = await getMolliePayment(molliePaymentId);
  if (!mollie) return;

  /*
   * Een incasso die Mollie zélf aanmaakt uit het maandabonnement kennen wij
   * nog niet: die betaling is nooit door onze code gestart, dus hij staat niet
   * in `payments`. Zonder onderstaande stap negeerden we die webhook stil, en
   * kreeg de klant nooit een maandfactuur. Dit is de plek waar zo'n incasso
   * alsnog in de administratie landt.
   */
  const payment = bestaand ?? (await adoptSubscriptionPayment(molliePaymentId, mollie));
  if (!payment) return; // onbekende payment die niet van ons is — negeren

  const nieuweStatus = mapMollieStatus(mollie.status);

  // Al volledig afgehandeld? Dan is er niets meer te doen.
  if (payment.processedAt && payment.status === "PAID") return;

  /*
   * Bedragcontrole. Het bedrag is door ons server-side bepaald bij het
   * aanmaken; wat Mollie als betaald meldt, hoort daar exact aan gelijk te
   * zijn. Wijkt het af, dan verwerken we de betaling NIET als voldaan — geen
   * factuur, geen termijn op betaald, geen mail — maar maken we het zichtbaar
   * voor de beheerder. Zonder betaalgegevens in het logboek.
   */
  const mollieCenten = mollieBedragInCenten(
    (mollie as unknown as { amount?: { value?: string } }).amount?.value,
  );
  if (bestaand && nieuweStatus === "PAID" && mollieCenten !== payment.amountCents) {
    const reden = `Bedrag wijkt af: Mollie meldt ${mollieCenten === null ? "onbekend" : euroFromCents(mollieCenten)}, verwacht ${euroFromCents(payment.amountCents)}.`;
    if (payment.failureReason !== reden) {
      await db
        .update(schema.payments)
        .set({ failureReason: reden })
        .where(eq(schema.payments.id, payment.id));
      console.error(
        JSON.stringify({
          evt: "mollie.amount_mismatch",
          at: new Date().toISOString(),
          paymentId: payment.id,
          type: payment.type,
        }),
      );
      const ctx = await loadContext(payment.commerceId);
      if (ctx) {
        await logJourneyEvent(
          ctx.lead.id,
          "payment_amount_mismatch",
          `Betaling niet verwerkt — ${reden} Controleer dit in Mollie.`,
          { actor: "systeem", internal: true, paymentId: payment.id, molliePaymentId },
        );
      }
    }
    return;
  }

  const velden = {
    paidAt: nieuweStatus === "PAID" ? (payment.paidAt ?? new Date()) : payment.paidAt,
    /*
     * De betaalmethode staat pas ná betaling vast — bij het aanmaken kiest
     * de klant nog niets. Hem hier vastleggen is de enige manier waarop de
     * factuur straks de waarheid kan vertellen in plaats van "iDEAL" aan te
     * nemen.
     */
    method:
      (mollie as unknown as { method?: string | null }).method ?? payment.method,
    mollieCustomerId:
      (mollie as unknown as { customerId?: string }).customerId ?? payment.mollieCustomerId,
    mollieMandateId:
      (mollie as unknown as { mandateId?: string }).mandateId ?? payment.mollieMandateId,
    failureReason:
      nieuweStatus === "PAID"
        ? null
        : ((mollie as unknown as { details?: { failureReason?: string } }).details
            ?.failureReason ?? null),
  };

  /*
   * De statusovergang is atomair: alleen de webhook die de status écht
   * verandert krijgt een rij terug. Mollie stuurt dezelfde webhook gerust
   * meerdere keren (en soms tegelijk); de gevolgen van een overgang — een
   * tijdlijnregel, een mail over een mislukte betaling — horen er maar één
   * keer te zijn.
   */
  const [gewijzigd] = await db
    .update(schema.payments)
    .set({ status: nieuweStatus, ...velden })
    .where(and(eq(schema.payments.id, payment.id), ne(schema.payments.status, nieuweStatus)))
    .returning({ id: schema.payments.id });
  if (!gewijzigd) {
    await db.update(schema.payments).set(velden).where(eq(schema.payments.id, payment.id));
  }

  if (nieuweStatus !== "PAID") {
    if (!gewijzigd) return;
    if (["FAILED", "EXPIRED", "CANCELED"].includes(nieuweStatus)) {
      await onPaymentNotPaid(payment, nieuweStatus);
    } else if (nieuweStatus === "PENDING" && payment.type !== "SUBSCRIPTION") {
      const ctx = await loadContext(payment.commerceId);
      if (ctx) {
        await logJourneyEvent(
          ctx.lead.id,
          "payment_pending",
          `Betaling in behandeling bij de bank (${euroFromCents(payment.amountCents)})`,
          { actor: "systeem", internal: true, type: payment.type, molliePaymentId },
        );
      }
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

/**
 * Neemt een door Mollie zelf aangemaakte abonnementsincasso op in de eigen
 * administratie.
 *
 * De koppeling loopt via de Mollie-customer: die staat op de commerce-rij en
 * is de enige betrouwbare band tussen een recurring payment en ons dossier.
 * Een betaling zonder abonnement of zonder bekende customer laten we met rust
 * — dan is het niet van ons, en dan verzinnen we er beslist geen dossier bij.
 *
 * De periode ("2026-09") komt uit de betaaldatum. De bestaande unieke index op
 * (commerce, type, periode) zorgt dat één maand maar één keer geïncasseerd kan
 * worden; een nieuwe poging in dezelfde maand neemt de bestaande, nog niet
 * betaalde rij over in plaats van er een tweede naast te zetten.
 */
async function adoptSubscriptionPayment(
  molliePaymentId: string,
  mollie: NonNullable<Awaited<ReturnType<typeof getMolliePayment>>>,
): Promise<Payment | null> {
  const db = getDb();
  if (!db) return null;

  const ruw = mollie as unknown as {
    subscriptionId?: string | null;
    customerId?: string | null;
    mandateId?: string | null;
    method?: string | null;
    amount?: { value?: string };
    paidAt?: string | null;
    createdAt?: string | null;
  };
  if (!ruw.subscriptionId || !ruw.customerId) return null;

  const [commerce] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.mollieCustomerId, ruw.customerId))
    .limit(1);
  if (!commerce) return null;

  // Bedrag uit Mollie in centen, zonder ooit via een float te gaan.
  const amountCents = mollieBedragInCenten(ruw.amount?.value) ?? 0;
  if (amountCents <= 0) return null;

  const moment = new Date(ruw.paidAt ?? ruw.createdAt ?? Date.now());
  const periode = `${moment.getUTCFullYear()}-${String(moment.getUTCMonth() + 1).padStart(2, "0")}`;

  try {
    const [nieuw] = await db
      .insert(schema.payments)
      .values({
        commerceId: commerce.id,
        type: "SUBSCRIPTION",
        status: "CREATED",
        amountCents,
        molliePaymentId,
        periode,
        sequenceType: "recurring",
        mollieCustomerId: ruw.customerId,
        mollieMandateId: ruw.mandateId ?? null,
        method: ruw.method ?? null,
        referentie: `DW-ABONNEMENT-${periode}`,
      })
      .returning();
    return nieuw ?? null;
  } catch (err) {
    if (!isUniekeSchending(err)) throw err;
  }

  /*
   * Er bestaat al een rij voor deze maand. Is die al betaald, dan zijn we
   * klaar — dubbel incasseren registreren we niet. Staat hij nog open (een
   * eerdere poging is mislukt), dan hoort déze betaling erbij en nemen we het
   * nieuwe Mollie-id over.
   */
  const [vanDieMaand] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.commerceId, commerce.id),
        eq(schema.payments.type, "SUBSCRIPTION"),
        eq(schema.payments.periode, periode),
      ),
    )
    .limit(1);
  if (!vanDieMaand) return null;
  if (vanDieMaand.status === "PAID" || vanDieMaand.molliePaymentId === molliePaymentId) {
    return vanDieMaand.molliePaymentId === molliePaymentId ? vanDieMaand : null;
  }

  const [overgenomen] = await db
    .update(schema.payments)
    .set({ molliePaymentId, method: ruw.method ?? vanDieMaand.method })
    .where(eq(schema.payments.id, vanDieMaand.id))
    .returning();
  return overgenomen ?? null;
}

/**
 * Een Mollie-bedrag ("504.17") in hele centen, zonder ooit via een float te
 * gaan. Null bij alles wat geen bedrag is.
 */
export function mollieBedragInCenten(waarde: string | null | undefined): number | null {
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(String(waarde ?? "").trim());
  if (!m) return null;
  const centen = Number(m[2]) * 100 + Number(`${m[3] ?? ""}00`.slice(0, 2));
  return m[1] ? -centen : centen;
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
  const factuur = await registerInvoiceForPayment(payment, {
    leadId: lead.id,
    commerceId: commerce.id,
    vatPercent: commerce.vatPercent,
    bedrijfsnaam: lead.bedrijfsnaam,
  });

  /*
   * Hoort deze betaling bij een termijn uit het betaalschema, dan gaat die
   * termijn nu op betaald, met de factuur eraan. Historische betalingen
   * (zonder schema) slaan dit over en lopen precies zoals altijd.
   */
  const termijn = payment.installmentId
    ? await markInstallmentPaid(payment, factuur?.id ?? null)
    : null;
  // Een tweede betaling voor een al betaalde termijn: gemeld, verder niets.
  if (termijn && !termijn.eersteKeer) return;
  const plan = termijn?.termijn.plan ?? null;
  const schemaPlan = plan && plan !== "50-50" ? plan : null;

  const link = commerce.portalToken ? portalUrl(commerce.portalToken) : undefined;

  if (payment.type === "INSTALLMENT") {
    await onInstallmentPaid(payment, termijn?.termijn ?? null, { commerce, lead }, link);
    return;
  }

  if (payment.type === "DEPOSIT" && schemaPlan && termijn) {
    /*
     * Eerste betaling van "in één keer" of "in termijnen". Zelfde gevolgen als
     * de aanbetaling bij 50/50 — de bouw start — met de woorden van de
     * gekozen regeling.
     */
    const t = termijn.termijn;
    const wat =
      schemaPlan === "volledig" ? "Betaling" : `Termijn ${t.volgnummer} van ${t.aantal}`;
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
      `${wat} ontvangen (${euroFromCents(payment.amountCents)})`,
      { actor: "systeem", molliePaymentId: payment.molliePaymentId, installmentId: t.id },
    );
    await setStage(lead.id, "gestart", { reden: `${wat.toLowerCase()} betaald` });
    await logJourneyEvent(lead.id, "build_started", "Bouwfase gestart", { actor: "systeem" });
    await ensureBuildTasks(lead.id);
    const rest = await restantZin(t.agreementId);
    await mailAndLog(
      lead,
      "deposit-received",
      {
        amount: euroFromCents(payment.amountCents),
        regeling: schemaPlan === "volledig" ? "betaling" : `termijn ${t.volgnummer} van ${t.aantal}`,
        extra: rest ?? undefined,
      },
      link,
    );
    await naSchemaBetaling(commerce.id, t.agreementId);
    return;
  }

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

/**
 * Termijn 2 t/m n van een termijnregeling is betaald. De factuur staat er al
 * (hierboven), de termijn staat op betaald; hier volgen tijdlijn en mail, en
 * — als dit de laatste was — de afronding.
 */
async function onInstallmentPaid(
  payment: Payment,
  termijn: PaymentInstallment | null,
  ctx: { commerce: Commerce; lead: Lead },
  link: string | undefined,
): Promise<void> {
  const { commerce, lead } = ctx;
  const wat = termijn ? `Termijn ${termijn.volgnummer} van ${termijn.aantal}` : "Termijn";
  await logJourneyEvent(
    lead.id,
    "installment_paid",
    `${wat} ontvangen (${euroFromCents(payment.amountCents)})`,
    { actor: "systeem", molliePaymentId: payment.molliePaymentId, installmentId: termijn?.id },
  );

  const rijen = termijn ? await scheduleForAgreement(termijn.agreementId) : [];
  const alles = rijen.length > 0 && rijen.every((r) => r.status === "BETAALD");
  if (alles) {
    await mailAndLog(
      lead,
      "installments-complete",
      {
        amount: euroFromCents(payment.amountCents),
        extra:
          commerce.monthlyCents > 0
            ? `Je maandelijkse DogWare-abonnement van ${euroFromCents(commerce.monthlyCents)} excl. btw staat daar los van en loopt gewoon door zoals afgesproken.`
            : "Er staat nu niets meer voor je open.",
      },
      link,
    );
  } else {
    await mailAndLog(
      lead,
      "installment-received",
      {
        amount: euroFromCents(payment.amountCents),
        extra: wat.toLowerCase(),
        regeling: termijn ? ((await restantZin(termijn.agreementId)) ?? undefined) : undefined,
      },
      link,
    );
  }
  if (termijn) await naSchemaBetaling(commerce.id, termijn.agreementId);
}

/** "Nog te betalen: … De volgende termijn van … staat gepland op …" */
async function restantZin(agreementId: string): Promise<string | null> {
  const rijen = await scheduleForAgreement(agreementId);
  const open = rijen.filter((r) => r.status === "GEPLAND");
  if (open.length === 0 || rijen[0]?.plan !== "termijnen") return null;
  const volgende = open[0];
  const openEx = open.reduce((s, r) => s + r.amountExVatCents, 0);
  return `Nog te betalen: ${euroFromCents(openEx)} excl. btw in ${open.length === 1 ? "1 termijn" : `${open.length} termijnen`}. De volgende termijn van ${euroFromCents(volgende.amountInclVatCents)} incl. btw staat gepland op ${volgende.dueAt ? datumLang(volgende.dueAt) : "de opleverdatum"}.`;
}

/**
 * Na elke betaling onder een regeling zonder slotbetaling ("in één keer",
 * "in termijnen"): is alles binnen, en is het tijd voor het abonnement?
 *
 * Bij 50/50 gebeurt dit bij de tweede termijn (ongewijzigd). Bij de andere
 * regelingen is er geen tweede termijn die dat moment markeert; daarom hier,
 * en bij het klaarzetten van de oplevering (zie `abonnementNaOplevering`).
 */
async function naSchemaBetaling(commerceId: string, agreementId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const rijen = await scheduleForAgreement(agreementId);
  if (rijen.length === 0 || rijen[0].plan === "50-50") return;
  const alles = rijen.every((r) => r.status === "BETAALD");
  const ctx = await loadContext(commerceId);
  if (!ctx) return;

  if (alles) {
    // Status alleen vooruit: een klant die al actief is, wordt niet teruggezet.
    const [bijgewerkt] = await db
      .update(schema.commerce)
      .set({ status: "FULLY_PAID", updatedAt: new Date() })
      .where(
        and(
          eq(schema.commerce.id, commerceId),
          notInArray(schema.commerce.status, ["FULLY_PAID", "SUBSCRIPTION_SCHEDULED", "ACTIVE_CUSTOMER"]),
        ),
      )
      .returning({ id: schema.commerce.id });
    if (bijgewerkt && rijen.length > 1) {
      await logJourneyEvent(
        ctx.lead.id,
        "schedule_completed",
        `Eenmalige investering volledig betaald (${rijen.length} termijnen)`,
        { actor: "systeem", agreementId },
      );
    }
    if (ctx.commerce.deliveryReadyAt) {
      await setStage(ctx.lead.id, "restbetaling", { reden: "alle termijnen betaald" });
    }
  }
  await abonnementNaOplevering(commerceId, alles);
}

/**
 * Plant het abonnement in voor een regeling zonder slotbetaling — pas ná
 * oplevering, en bij de regel "na de laatste betaling" pas als alles binnen
 * is. Idempotent: een bestaand abonnement wordt nooit opnieuw aangemaakt.
 */
export async function abonnementNaOplevering(commerceId: string, allesBetaald?: boolean): Promise<void> {
  const ctx = await loadContext(commerceId);
  if (!ctx) return;
  const { commerce } = ctx;
  if (!commerce.deliveryReadyAt || commerce.mollieSubscriptionId) return;
  if (commerce.subscriptionStartRule === "na-laatste-betaling") {
    const alles =
      allesBetaald ??
      (await scheduleForCommerce(commerceId)).every((r) => r.status === "BETAALD");
    if (!alles) return;
  }
  await activateMandateAndSubscription(commerceId);
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
  /*
   * Een echt mislukte termijnbetaling (geweigerd, niet: de klant liet de
   * checkout verlopen) onder "in één keer" of "in termijnen" krijgt een mail
   * met een knop om het opnieuw te proberen. Bij 50/50 verandert er niets.
   */
  if (status === "FAILED" && payment.installmentId) {
    const db = getDb();
    const [t] = db
      ? await db
          .select()
          .from(schema.paymentInstallments)
          .where(eq(schema.paymentInstallments.id, payment.installmentId))
          .limit(1)
      : [];
    if (t && t.plan !== "50-50" && t.status !== "BETAALD") {
      await mailAndLog(
        ctx.lead,
        "installment-failed",
        {
          amount: euroFromCents(payment.amountCents),
          extra: t.plan === "volledig" ? "je betaling" : `termijn ${t.volgnummer} van ${t.aantal}`,
        },
        ctx.commerce.portalToken ? portalUrl(ctx.commerce.portalToken) : undefined,
      );
    }
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

/**
 * Verstuurt een mail en legt het resultaat vast op de tijdlijn.
 *
 * `naar` maakt het mogelijk dezelfde mail naar een ANDER adres te sturen dan
 * dat van de klant — bijvoorbeeld een factuurkopie naar de boekhouder. Dat is
 * bewust één functie en geen tweede verzendpad: het e-maillogboek en de
 * tijdlijn blijven zo de enige plek waar staat wat er de deur uit ging.
 *
 * Zo'n kopie is géén klantcommunicatie. Hij wordt daarom als intern
 * gelogd en als kopie benoemd, zodat de tijdlijn nooit suggereert dat de klant
 * iets heeft ontvangen dat hij niet gekregen heeft.
 */
export async function mailAndLog(
  lead: Lead,
  type: Parameters<typeof sendCommerceMail>[0],
  vars: Parameters<typeof sendCommerceMail>[3] = {},
  ctaUrl?: string,
  opts: { naar?: string } = {},
): Promise<boolean> {
  const ontvanger = opts.naar?.trim() || lead.email;
  const isKopie = ontvanger.toLowerCase() !== lead.email.toLowerCase();

  const mail = await sendCommerceMail(type, ontvanger, lead.naam, vars, ctaUrl);
  await logEmail(lead.id, {
    soort: isKopie ? `${type} (kopie)` : type,
    ontvanger,
    onderwerp: COMMERCE_SUBJECTS[type],
    ok: mail.ok,
    providerId: mail.ok ? mail.id : undefined,
    fout: mail.ok ? undefined : mail.error.message,
  });
  await logJourneyEvent(
    lead.id,
    mail.ok ? "email_sent" : "email_failed",
    mail.ok
      ? `${isKopie ? "Kopie van e-mail" : "E-mail"} verstuurd naar ${ontvanger} (${type})`
      : `E-mail mislukt (${type}) naar ${ontvanger}: ${mail.error.message}`,
    { actor: isKopie ? "admin" : "systeem", mailType: type, internal: isKopie || !mail.ok },
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
