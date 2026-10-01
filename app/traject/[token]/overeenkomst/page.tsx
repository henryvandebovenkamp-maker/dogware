import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { resolvePortal } from "@/lib/portal-access";
import { getActiveProposal } from "@/lib/proposals";
import { ensureAgreement, getCurrentAgreement } from "@/lib/agreements";
import { overeenkomstVoorKlant } from "@/lib/klantweergave";
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
  // Nog niet aan de beurt? Dan terug naar het overzicht, dat vertelt wat de volgende stap is.
  if (!proposal || (!poort.ok && !(direct && proposal.sentAt))) redirect(`/traject/${token}`);

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

  return <AgreementView token={token} {...overeenkomstVoorKlant(agreement, proposal, lead)} />;
}
