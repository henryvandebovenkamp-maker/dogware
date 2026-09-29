import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { PaymentInstallment } from "@/lib/db/schema";
import { mailAndLog } from "@/lib/commerce";
import { euroFromCents } from "@/lib/money";
import { portalUrl } from "@/lib/portal-access";
import { datumLang, termijnStatus } from "@/lib/payment-plan";
import { laatstePogingen } from "@/lib/payment-schedule";

/**
 * De dagelijkse ronde langs de termijnen.
 *
 * Twee mails, elk hooguit één keer per termijn:
 *   - "je volgende termijn staat klaar" zodra het betaalvenster opent;
 *   - één vriendelijke herinnering zodra een termijn te laat is.
 *
 * Alleen voor de termijnregeling, en alleen voor termijn 2 t/m n: de eerste
 * betaling hoort bij het ondertekenen en heeft daar al zijn eigen mail en
 * herinneringsknop. Bij 50/50 verandert er niets.
 *
 * Idempotent op twee niveaus: per klant wordt uitsluitend de eerstvolgende
 * onbetaalde termijn bekeken, en elke mail wordt eerst atomair "geclaimd"
 * (notifiedAt/remindedAt van leeg naar nu). Twee gelijktijdige rondes sturen
 * dus nooit twee keer dezelfde mail. Alles gaat via `mailAndLog`, zodat het
 * in het e-maillogboek en op de tijdlijn staat — en vanuit de aanvraag
 * opnieuw te versturen is.
 */
export async function runTermijnRonde(nu: Date = new Date()): Promise<{
  bekeken: number;
  klaarGemeld: number;
  herinnerd: number;
}> {
  const db = getDb();
  const uitkomst = { bekeken: 0, klaarGemeld: 0, herinnerd: 0 };
  if (!db) return uitkomst;

  const open = await db
    .select()
    .from(schema.paymentInstallments)
    .where(
      and(
        eq(schema.paymentInstallments.plan, "termijnen"),
        eq(schema.paymentInstallments.status, "GEPLAND"),
        isNotNull(schema.paymentInstallments.dueAt),
      ),
    )
    .orderBy(asc(schema.paymentInstallments.agreementId), asc(schema.paymentInstallments.volgnummer));

  // Per overeenkomst alleen de eerstvolgende onbetaalde termijn.
  const eerstvolgende = new Map<string, PaymentInstallment>();
  for (const r of open) if (!eerstvolgende.has(r.agreementId)) eerstvolgende.set(r.agreementId, r);
  const kandidaten = [...eerstvolgende.values()].filter((r) => r.volgnummer > 1);
  const pogingen = await laatstePogingen(kandidaten);

  for (const t of kandidaten) {
    uitkomst.bekeken++;
    const status = termijnStatus(
      { status: t.status, dueAt: t.dueAt, laatstePoging: pogingen.get(t.id)?.status ?? null },
      nu,
    );
    if (status === "gepland") continue;

    const [ctx] = await db
      .select({ lead: schema.leads, commerce: schema.commerce })
      .from(schema.commerce)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.commerce.leadId))
      .where(eq(schema.commerce.id, t.commerceId))
      .limit(1);
    if (!ctx || ctx.commerce.status === "CANCELLED" || ctx.lead.status === "afgevallen") continue;

    const link = ctx.commerce.portalToken ? portalUrl(ctx.commerce.portalToken) : undefined;
    const wat = `Termijn ${t.volgnummer} van ${t.aantal}`;

    if (status === "te-laat") {
      const [claim] = await db
        .update(schema.paymentInstallments)
        .set({ remindedAt: nu, notifiedAt: t.notifiedAt ?? nu, updatedAt: nu })
        .where(and(eq(schema.paymentInstallments.id, t.id), isNull(schema.paymentInstallments.remindedAt)))
        .returning({ id: schema.paymentInstallments.id });
      if (!claim) continue;
      await mailAndLog(
        ctx.lead,
        "installment-reminder",
        {
          amount: euroFromCents(t.amountInclVatCents),
          extra: `${wat} (vervaldatum ${datumLang(t.dueAt!)})`,
        },
        link,
      );
      uitkomst.herinnerd++;
      continue;
    }

    // te-betalen of mislukt: het venster is open.
    const [claim] = await db
      .update(schema.paymentInstallments)
      .set({ notifiedAt: nu, updatedAt: nu })
      .where(and(eq(schema.paymentInstallments.id, t.id), isNull(schema.paymentInstallments.notifiedAt)))
      .returning({ id: schema.paymentInstallments.id });
    if (!claim) continue;
    await mailAndLog(
      ctx.lead,
      "installment-due",
      {
        amount: `${euroFromCents(t.amountInclVatCents)} incl. btw (vervaldatum ${datumLang(t.dueAt!)})`,
        extra: wat.toLowerCase(),
      },
      link,
    );
    uitkomst.klaarGemeld++;
  }

  return uitkomst;
}
