"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CommerceStatus } from "@/lib/db/schema";
import { getAdminActor } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth/session";
import { branding } from "@/lib/branding";
import { logJourneyEvent, setStage } from "@/lib/journey";
import { getCommerceForLead } from "@/lib/commerce";
import { createMolliePayment, isMollieConfigured } from "@/lib/mollie";
import {
  computeOneOff,
  computeOutstanding,
  type CommercialConfig,
} from "@/lib/money";
import { sendCommerceMail } from "@/lib/email/send";

export type CommerceState = { status: "idle" | "success" | "error"; message?: string; checkoutUrl?: string };

function toConfig(c: typeof schema.commerce.$inferSelect): CommercialConfig {
  return {
    projectCents: c.projectCents,
    setupCents: c.setupCents,
    discountType: c.discountType,
    discountValue: c.discountValue,
    vatPercent: c.vatPercent,
    depositPercent: c.depositPercent,
    monthlyCents: c.monthlyCents,
    freeMonths: c.freeMonths,
    introDiscountPercent: c.introDiscountPercent,
    introDiscountMonths: c.introDiscountMonths,
  };
}

async function ensureCommerce(leadId: string) {
  const db = getDb();
  if (!db) return null;
  const existing = await getCommerceForLead(leadId);
  if (existing) return existing;
  const [created] = await db.insert(schema.commerce).values({ leadId }).returning();
  return created;
}

/* ---------- Admin: afspraak opslaan ---------- */

const euroToCents = (v: FormDataEntryValue | null) =>
  Math.max(0, Math.round(Number(String(v ?? "0").replace(",", ".")) * 100)) || 0;
const intVal = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(v ?? 0))) || 0;

export async function saveCommerceConfig(_prev: CommerceState, formData: FormData): Promise<CommerceState> {
  if (!(await getAdminActor())) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };
  const leadId = String(formData.get("leadId") ?? "");
  const c = await ensureCommerce(leadId);
  if (!c) return { status: "error", message: "Aanvraag niet gevonden." };

  const dt = String(formData.get("discountType") ?? "none");
  await db
    .update(schema.commerce)
    .set({
      projectCents: euroToCents(formData.get("project")),
      setupCents: euroToCents(formData.get("setup")),
      discountType: dt === "amount" || dt === "percent" ? dt : "none",
      discountValue: dt === "percent" ? intVal(formData.get("discountValue")) : euroToCents(formData.get("discountValue")),
      vatPercent: intVal(formData.get("vat")) || 21,
      depositPercent: intVal(formData.get("depositPercent")) || 50,
      monthlyCents: euroToCents(formData.get("monthly")),
      freeMonths: intVal(formData.get("freeMonths")),
      introDiscountPercent: intVal(formData.get("introPercent")),
      introDiscountMonths: intVal(formData.get("introMonths")),
      subscriptionStartRule: normalizeStartRule(String(formData.get("startRule") ?? "")),
      opmerkingen: String(formData.get("opmerkingen") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.commerce.id, c.id));

  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success", message: "Afspraak opgeslagen." };
}

/* ---------- Admin: voorstel versturen ---------- */

export async function sendProposal(_prev: CommerceState, formData: FormData): Promise<CommerceState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };
  const leadId = String(formData.get("leadId") ?? "");
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  const c = await getCommerceForLead(leadId);
  if (!lead || !c) return { status: "error", message: "Aanvraag niet gevonden." };

  await db
    .update(schema.commerce)
    .set({ status: "PROPOSAL_SENT", proposalVersion: c.proposalVersion + 1, proposalSentAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.commerce.id, c.id));
  await setStage(leadId, "offerte");
  await logJourneyEvent(leadId, "proposal_sent", "Voorstel verstuurd", { actor: "admin" });
  const mail = await sendCommerceMail("proposal-sent", lead.email, lead.naam);
  await logJourneyEvent(leadId, "email_sent", mail.ok ? "Voorstelmail verzonden" : "Voorstelmail mislukt");

  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success", message: mail.ok ? "Voorstel verstuurd." : `Opgeslagen, maar mail mislukte: ${mail.error.message}` };
}

/* ---------- Admin: oplevering gereedmelden ---------- */

export async function markDeliveryReady(_prev: CommerceState, formData: FormData): Promise<CommerceState> {
  const actor = await getAdminActor();
  if (!actor) return { status: "error", message: "Geen toegang." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database niet beschikbaar." };
  const leadId = String(formData.get("leadId") ?? "");
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  const c = await getCommerceForLead(leadId);
  if (!lead || !c) return { status: "error", message: "Niet gevonden." };

  await setCommerceStatusInternal(c.id, "DELIVERY_READY");
  await logJourneyEvent(leadId, "delivery_ready", "Oplevering gereed gemeld", { actor: "admin" });
  const outstanding = computeOutstanding(toConfig(c), await paidTotal(c.id));
  await sendCommerceMail("delivery-ready", lead.email, lead.naam, { amount: euroFromCentsSafe(outstanding) });
  revalidatePath(`/admin/leads/${leadId}`);
  return { status: "success", message: "Oplevering gemeld en klant geïnformeerd." };
}

/* ---------- Klant: akkoord geven ---------- */

export async function acceptProposal(leadId: string): Promise<CommerceState> {
  const db = getDb();
  if (!db) return { status: "error", message: "Tijdelijk niet beschikbaar." };
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Geen toegang." };

  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!lead || lead.demoCustomerUserId !== user.id) return { status: "error", message: "Geen toegang." };
  const c = await getCommerceForLead(leadId);
  if (!c) return { status: "error", message: "Geen voorstel gevonden." };
  if (c.acceptedAt) return { status: "success" }; // al akkoord — idempotent

  const ipHash = createHash("sha256")
    .update((await headers()).get("x-forwarded-for") ?? "onbekend")
    .digest("hex")
    .slice(0, 32);

  await db
    .update(schema.commerce)
    .set({
      status: "DEPOSIT_PENDING",
      acceptedAt: new Date(),
      acceptedIpHash: ipHash,
      acceptedSnapshot: toConfig(c) as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(schema.commerce.id, c.id));
  await setStage(leadId, "akkoord");
  await logJourneyEvent(leadId, "proposal_accepted", "Klant is akkoord gegaan", { actor: "klant" });
  await sendCommerceMail("deposit-ready", lead.email, lead.naam, {
    amount: euroFromCentsSafe(computeOneOff(toConfig(c)).depositCents),
  });
  revalidatePath("/account");
  return { status: "success" };
}

/* ---------- Klant/Admin: betaling starten (server herberekent bedrag) ---------- */

export async function startPayment(leadId: string, kind: "deposit" | "final"): Promise<CommerceState> {
  const db = getDb();
  if (!db) return { status: "error", message: "Tijdelijk niet beschikbaar." };
  if (!isMollieConfigured()) return { status: "error", message: "Betalen is nog niet geconfigureerd." };

  const user = await getCurrentUser();
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!lead) return { status: "error", message: "Niet gevonden." };
  // Autorisatie: de eigen klant óf een admin
  const isOwner = user && lead.demoCustomerUserId === user.id;
  const isAdmin = (await getAdminActor()) !== null;
  if (!isOwner && !isAdmin) return { status: "error", message: "Geen toegang." };

  const c = await getCommerceForLead(leadId);
  if (!c || !c.acceptedAt) return { status: "error", message: "Er is nog geen geaccepteerd voorstel." };

  const config = toConfig(c);
  const type = kind === "deposit" ? "DEPOSIT" : "FINAL_PAYMENT";
  const amountCents = kind === "deposit"
    ? computeOneOff(config).depositCents
    : computeOutstanding(config, await paidTotal(c.id));
  if (amountCents <= 0) return { status: "error", message: "Er staat niets open." };

  // Dubbele betaling voorkomen: bestaat er al een openstaande/betaalde van dit type?
  const bestaand = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.commerceId, c.id), eq(schema.payments.type, type), inArray(schema.payments.status, ["CREATED", "OPEN", "PENDING", "PAID"])))
    .limit(1);
  if (bestaand[0]?.status === "PAID") return { status: "error", message: "Deze termijn is al betaald." };

  const [record] = await db
    .insert(schema.payments)
    .values({ commerceId: c.id, type, amountCents, status: "CREATED" })
    .returning();

  const result = await createMolliePayment({
    amountCents,
    description: `DogWare ${kind === "deposit" ? "eerste termijn" : "laatste termijn"} — ${lead.bedrijfsnaam}`,
    redirectUrl: `${branding.siteUrl}/account?betaling=terug`,
    metadata: { paymentId: record.id, leadId, type },
  });
  if (!result.ok) {
    await db.update(schema.payments).set({ status: "FAILED" }).where(eq(schema.payments.id, record.id));
    return { status: "error", message: result.message };
  }
  await db
    .update(schema.payments)
    .set({ molliePaymentId: result.molliePaymentId, status: "OPEN" })
    .where(eq(schema.payments.id, record.id));
  await setCommerceStatusInternal(c.id, kind === "deposit" ? "DEPOSIT_PENDING" : "FINAL_PAYMENT_PENDING");
  await logJourneyEvent(leadId, "payment_created", `${kind === "deposit" ? "Eerste" : "Laatste"} termijn aangemaakt`, { actor: isAdmin ? "admin" : "klant" });

  return { status: "success", checkoutUrl: result.checkoutUrl };
}

/* ---------- helpers ---------- */

async function paidTotal(commerceId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)::int` })
    .from(schema.payments)
    .where(and(eq(schema.payments.commerceId, commerceId), eq(schema.payments.status, "PAID"), inArray(schema.payments.type, ["DEPOSIT", "FINAL_PAYMENT", "MANUAL_CORRECTION"])));
  return row?.total ?? 0;
}

async function setCommerceStatusInternal(commerceId: string, status: CommerceStatus) {
  const db = getDb();
  if (!db) return;
  await db.update(schema.commerce).set({ status, updatedAt: new Date() }).where(eq(schema.commerce.id, commerceId));
}

const START_RULES = ["na-oplevering", "na-laatste-betaling", "eerste-volgende-maand", "handmatig"] as const;
function normalizeStartRule(v: string): (typeof START_RULES)[number] {
  return (START_RULES as readonly string[]).includes(v) ? (v as (typeof START_RULES)[number]) : "na-oplevering";
}

function euroFromCentsSafe(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}
