import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { resolvePortal } from "@/lib/portal-access";
import { euroFromCents } from "@/lib/money";
import { BrandMark } from "@/components/brand";
import { TerugKnop } from "@/components/commerce/return-view";

export const metadata: Metadata = {
  title: "Bedankt",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * De terugkeerpagina na Mollie.
 *
 * Belangrijk: terugkomen uit de checkout betekent NIET dat er betaald is. De
 * webhook is de enige bron van waarheid. Deze pagina zegt daarom nooit "je
 * betaling is gelukt" op basis van de redirect alleen — hij leest de status
 * die de webhook heeft weggeschreven, en is verder eerlijk over "we wachten
 * nog even op je bank".
 */
export default async function BetaaldPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolvePortal(token);
  if (!ctx) notFound();
  const db = getDb();
  if (!db) notFound();

  const [laatste] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.commerceId, ctx.commerce.id),
        inArray(schema.payments.type, ["DEPOSIT", "FINAL_PAYMENT"]),
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);

  const betaald = laatste?.status === "PAID";
  const mislukt =
    laatste && ["FAILED", "EXPIRED", "CANCELED"].includes(laatste.status);

  const voornaam = ctx.lead.naam.split(" ")[0];

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-cream-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
          <BrandMark size={34} className="h-[34px] w-[34px]" />
          <span className="text-[13px] font-bold text-ink-500">{ctx.lead.bedrijfsnaam}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:py-20">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink/5">
          <div
            className={
              betaald
                ? "h-1.5 bg-sage"
                : mislukt
                  ? "h-1.5 bg-brand"
                  : "h-1.5 bg-gradient-to-r from-brand to-brand-400"
            }
          />
          <div className="p-7 sm:p-9">
            {betaald ? (
              <>
                <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[30px]">
                  Gelukt, {voornaam} — bedankt! 🐾
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                  We hebben je betaling van{" "}
                  <strong className="font-extrabold text-ink">
                    {euroFromCents(laatste.amountCents)}
                  </strong>{" "}
                  ontvangen.{" "}
                  {laatste.type === "DEPOSIT"
                    ? "Vanaf nu gaan we voor je bouwen."
                    : "Je website gaat binnenkort live."}
                </p>
              </>
            ) : mislukt ? (
              <>
                <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[30px]">
                  De betaling is niet doorgegaan
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                  Geen zorgen, er is niets afgeschreven en er is niets misgegaan met je opdracht. Je
                  kunt het gewoon opnieuw proberen.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[30px]">
                  Bedankt, {voornaam}
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                  We wachten nog heel even op de bevestiging van je bank. Dat duurt meestal een paar
                  seconden, soms een paar minuten. Je hoeft niets te doen — zodra het rond is krijg
                  je van ons bericht.
                </p>
              </>
            )}

            <TerugKnop token={token} verversen={!betaald && !mislukt} />
          </div>
        </div>
      </main>
    </div>
  );
}
