import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { invoiceForUser } from "@/lib/invoices";
import { Factuur } from "@/components/commerce/invoice-view";

export const metadata: Metadata = {
  title: "Factuur",
  robots: { index: false, follow: false },
};

/** Altijd vers: dit is een persoonlijk document, nooit een cachebare pagina. */
export const dynamic = "force-dynamic";

/**
 * Een factuur in het klantaccount.
 *
 * De eigendomscontrole zit in `invoiceForUser`: die zoekt de factuur
 * uitsluitend binnen de aanvragen van dít account. Een ander factuurnummer in
 * de URL levert daarom niets op — ook niet als dat nummer bestaat. Dat is
 * essentieel, want factuurnummers lopen op en zijn dus te raden.
 */
export default async function AccountFactuurPage({
  params,
}: {
  params: Promise<{ nummer: string }>;
}) {
  const user = await requireRole("CUSTOMER", "/inloggen");
  const { nummer } = await params;

  const factuur = await invoiceForUser(user.id, decodeURIComponent(nummer));
  if (!factuur) notFound();

  return (
    <Factuur
      factuur={factuur.view}
      terug={{ href: "/account", label: "Terug naar mijn omgeving" }}
    />
  );
}
