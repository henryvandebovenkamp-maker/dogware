import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { resolvePortal } from "@/lib/portal-access";
import { getActiveProposal } from "@/lib/proposals";
import {
  agreementConsents,
  ensureAgreement,
  getCurrentAgreement,
  isSigned,
  renderAgreement,
} from "@/lib/agreements";
import { contractVersionDateLabel } from "@/lib/agreement";
import { AgreementView } from "@/components/commerce/agreement-view";

export const metadata: Metadata = {
  title: "Samenwerkingsovereenkomst",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OvereenkomstPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolvePortal(token);
  if (!ctx) notFound();
  const { lead, commerce } = ctx;
  const db = getDb();
  if (!db) notFound();

  const proposal = await getActiveProposal(commerce.id);
  if (!proposal?.acceptedAt) notFound();

  let agreement = await getCurrentAgreement(commerce.id);
  if (!agreement || agreement.status === "SUPERSEDED") {
    agreement = await ensureAgreement(commerce, lead, proposal);
  }
  if (!agreement) notFound();

  // Het openen registreren — zonder tracking weet Henry nooit of de klant het
  // stuk daadwerkelijk onder ogen kreeg.
  if (!agreement.viewedAt) {
    await db
      .update(schema.agreements)
      .set({ viewedAt: new Date(), status: agreement.status === "SENT" ? "VIEWED" : agreement.status })
      .where(eq(schema.agreements.id, agreement.id));
  }

  const { chapters, versionName } = renderAgreement(agreement, proposal);
  const consents = agreementConsents(agreement);

  return (
    <AgreementView
      token={token}
      chapters={chapters}
      versionName={versionName}
      versionDate={contractVersionDateLabel(agreement.voorwaardenVersie)}
      consents={consents}
      getekend={isSigned(agreement)}
      getekendOp={agreement.signedAt?.toISOString() ?? null}
      getekendDoor={agreement.signerName}
      voorstelVersie={agreement.proposalVersion}
      klant={{
        bedrijfsnaam: agreement.signerCompany ?? lead.bedrijfsnaam,
        naam: agreement.signerName ?? lead.naam,
        email: agreement.signerEmail ?? lead.email,
        telefoon: agreement.signerPhone ?? lead.telefoon ?? "",
        adres: agreement.signerAddress ?? "",
        postcode: agreement.signerPostcode ?? "",
        plaats: agreement.signerCity ?? lead.plaats,
        kvk: agreement.signerKvk ?? "",
        btw: agreement.signerVat ?? "",
        functie: agreement.signerRole ?? "",
      }}
    />
  );
}
