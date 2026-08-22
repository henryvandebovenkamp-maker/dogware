import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInvoiceView } from "@/lib/documents";
import { resolvePortal } from "@/lib/portal-access";
import { Factuur } from "@/components/commerce/invoice-view";

export const metadata: Metadata = {
  title: "Factuur",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * De factuur in de klantomgeving.
 *
 * Twee sloten: de sleutel moet kloppen én de factuur moet bij dít traject
 * horen. Zonder die tweede controle zou iemand met een geldige eigen link elk
 * willekeurig factuurnummer kunnen opvragen.
 */
export default async function KlantFactuurPage({
  params,
}: {
  params: Promise<{ token: string; nummer: string }>;
}) {
  const { token, nummer } = await params;

  const ctx = await resolvePortal(token);
  if (!ctx) notFound();

  const factuur = await getInvoiceView(decodeURIComponent(nummer));
  if (!factuur) notFound();
  if (factuur.commerceId !== ctx.commerce.id) notFound();

  return (
    <Factuur
      factuur={factuur.view}
      terug={{ href: `/traject/${token}`, label: "Terug naar je overzicht" }}
    />
  );
}
