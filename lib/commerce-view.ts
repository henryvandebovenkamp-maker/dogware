import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCommerceForLead } from "@/lib/commerce";
import { isMollieConfigured } from "@/lib/mollie";
import {
  computeOneOff,
  computeOutstanding,
  euroFromCents,
  type CommercialConfig,
} from "@/lib/money";
import type { PanelData } from "@/components/commerce/admin-panel";

function toConfig(c: typeof schema.commerce.$inferSelect): CommercialConfig {
  return {
    projectCents: c.projectCents, setupCents: c.setupCents,
    discountType: c.discountType, discountValue: c.discountValue,
    vatPercent: c.vatPercent, depositPercent: c.depositPercent,
    monthlyCents: c.monthlyCents, freeMonths: c.freeMonths,
    introDiscountPercent: c.introDiscountPercent, introDiscountMonths: c.introDiscountMonths,
  };
}

const euroInput = (cents: number) => (cents / 100).toFixed(2);

async function paidTotal(commerceId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.payments.amountCents}),0)::int` })
    .from(schema.payments)
    .where(and(eq(schema.payments.commerceId, commerceId), eq(schema.payments.status, "PAID")));
  return row?.total ?? 0;
}

/** Bouwt alle server-berekende paneldata voor de admin-detailpagina. */
export async function buildPanelData(leadId: string): Promise<PanelData> {
  const c = await getCommerceForLead(leadId);
  const cfg: CommercialConfig = c
    ? toConfig(c)
    : { projectCents: 0, setupCents: 0, discountType: "none", discountValue: 0, vatPercent: 21, depositPercent: 50, monthlyCents: 0, freeMonths: 0, introDiscountPercent: 0, introDiscountMonths: 0 };
  const one = computeOneOff(cfg);
  const paid = c ? await paidTotal(c.id) : 0;
  const outstanding = computeOutstanding(cfg, paid);

  return {
    leadId,
    status: c?.status ?? "DRAFT",
    config: {
      project: euroInput(cfg.projectCents),
      setup: euroInput(cfg.setupCents),
      discountType: cfg.discountType,
      discountValue: cfg.discountType === "percent" ? String(cfg.discountValue) : euroInput(cfg.discountValue),
      vat: String(cfg.vatPercent),
      depositPercent: String(cfg.depositPercent),
      monthly: euroInput(cfg.monthlyCents),
      freeMonths: String(cfg.freeMonths),
      introPercent: String(cfg.introDiscountPercent),
      introMonths: String(cfg.introDiscountMonths),
      startRule: c?.subscriptionStartRule ?? "na-oplevering",
      opmerkingen: c?.opmerkingen ?? "",
    },
    computed: {
      subtotal: euroFromCents(one.subtotalCents),
      discount: euroFromCents(one.discountCents),
      net: euroFromCents(one.netExVatCents),
      vat: euroFromCents(one.vatCents),
      total: euroFromCents(one.totalInclVatCents),
      deposit: euroFromCents(one.depositCents),
      final: euroFromCents(one.finalCents),
      paid: euroFromCents(paid),
      outstanding: euroFromCents(outstanding),
    },
    accepted: Boolean(c?.acceptedAt),
    depositPaid: c?.status === "DEPOSIT_PAID" || c?.status === "BUILDING" || c?.status === "DELIVERY_READY" || c?.status === "FINAL_PAYMENT_PENDING" || c?.status === "FULLY_PAID",
    mollieReady: isMollieConfigured(),
  };
}
