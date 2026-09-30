import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgreementView } from "@/components/commerce/agreement-view";
import { conceptOvereenkomst } from "@/lib/agreements";
import { conceptAlsVerstuurd, overeenkomstVoorKlant } from "@/lib/klantweergave";
import { resolveProef } from "@/lib/proef";
import { ProefNietMeerConcept } from "../niet-meer-concept";

export const metadata: Metadata = {
  title: "Proefweergave overeenkomst",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * De overeenkomst zoals de klant hem na definitief versturen leest — gebouwd
 * in het geheugen met exact de waarden die `ensureAgreement` zou opslaan.
 * Er wordt niets opgeslagen en ondertekenen is uitgeschakeld.
 */
export default async function ProefOvereenkomstPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveProef(token);
  if (!ctx) notFound();
  if (ctx.soort === "niet-meer-concept") return <ProefNietMeerConcept />;

  const { lead, commerce } = ctx;
  const proposal = conceptAlsVerstuurd(ctx.proposal, commerce);
  const agreement = conceptOvereenkomst(commerce, lead, proposal);

  return (
    <AgreementView
      token=""
      pad={`/traject/proef/${token}`}
      proef
      {...overeenkomstVoorKlant(agreement, proposal, lead)}
    />
  );
}
