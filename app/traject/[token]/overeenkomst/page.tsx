import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
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
import { logJourneyEvent } from "@/lib/journey";
import { isDirectJourney, overeenkomstPoort } from "@/lib/journey-variant";

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

  /*
   * Demo: pas na een apart akkoord op het voorstel. Direct: zodra de
   * opdrachtbevestiging definitief verstuurd is — tekenen ís dan het akkoord.
   * Eén poortwachter, dezelfde als bij het ondertekenen zelf.
   */
  const direct = isDirectJourney(lead.journeyVariant);
  const proposal = await getActiveProposal(commerce.id);
  const poort = overeenkomstPoort(lead.journeyVariant, proposal);
  // Een verlopen opdrachtbevestiging mag nog wel gelezen worden; tekenen weigert de actie.
  if (!proposal || (!poort.ok && !(direct && proposal.sentAt))) notFound();

  let agreement = await getCurrentAgreement(commerce.id);
  if (!agreement || agreement.status === "SUPERSEDED") {
    agreement = await ensureAgreement(commerce, lead, proposal);
  }
  if (!agreement) notFound();

  // Het openen registreren — zonder tracking weet Henry nooit of de klant het
  // stuk daadwerkelijk onder ogen kreeg.
  if (!agreement.viewedAt) {
    // Voorwaardelijk, zodat twee gelijktijdige openingen maar één tijdlijnregel opleveren.
    const [eersteKeer] = await db
      .update(schema.agreements)
      .set({ viewedAt: new Date(), status: agreement.status === "SENT" ? "VIEWED" : agreement.status })
      .where(and(eq(schema.agreements.id, agreement.id), isNull(schema.agreements.viewedAt)))
      .returning({ id: schema.agreements.id });
    if (eersteKeer) {
      await logJourneyEvent(
        lead.id,
        "agreement_viewed",
        direct ? "Opdrachtbevestiging en overeenkomst bekeken" : "Overeenkomst bekeken",
        { actor: "klant", agreementId: agreement.id },
      );
    }
  }

  const { chapters, versionName } = renderAgreement(agreement, proposal, lead.journeyVariant);
  const consents = agreementConsents(agreement, lead.journeyVariant);

  return (
    <AgreementView
      token={token}
      direct={direct}
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
