import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getInvoiceView } from "@/lib/documents";
import { Factuur } from "@/components/commerce/invoice-view";

export const metadata: Metadata = {
  title: "Factuur",
  robots: { index: false, follow: false },
};

/** Dezelfde factuur als de klant ziet, plus de interne waarschuwing. */
export default async function AdminFactuurPage({
  params,
}: {
  params: Promise<{ id: string; nummer: string }>;
}) {
  await requireAdmin();
  const { id, nummer } = await params;

  const factuur = await getInvoiceView(decodeURIComponent(nummer));
  if (!factuur) notFound();
  // De factuur moet bij deze aanvraag horen, ook al is de kijker beheerder.
  if (factuur.leadId !== id) notFound();

  return (
    <Factuur
      factuur={factuur.view}
      terug={{ href: `/admin/leads/${id}`, label: "Terug naar de aanvraag" }}
      toonInterneWaarschuwing
    />
  );
}
