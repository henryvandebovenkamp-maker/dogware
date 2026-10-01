import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  createOrGetDraft,
  ensureCommerce,
  getDraftProposal,
  listProposals,
  planConfig,
  toConfig,
} from "@/lib/proposals";
import { afspraakOverzicht } from "@/lib/betaalafspraak";
import { proefOntvanger } from "@/lib/email/config";
import { ProposalEditor, type EditorData } from "@/components/commerce/proposal-editor";
import { isDirectJourney } from "@/lib/journey-variant";
import { kalenderdag } from "@/lib/proposal-geldigheid";

export const metadata: Metadata = {
  title: "Voorstel",
  robots: { index: false, follow: false },
};

const euroInput = (cents: number) => (cents / 100).toFixed(2);
// De Nederlandse kalenderdag — niet de UTC-datum, die 's avonds een dag kan verschillen.
const dateInput = (d: Date | null) => (d ? kalenderdag(d) : "");

export default async function VoorstelEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const db = getDb();
  if (!db) notFound();

  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
  if (!lead) notFound();

  const commerce = await ensureCommerce(id);
  if (!commerce) notFound();

  /*
   * Er moet een concept zijn om te kunnen bewerken. Bestaat dat nog niet, dan
   * maken we het hier aan — de beheerder komt op deze pagina omdat hij een
   * voorstel wil schrijven, niet om eerst nog op een knop te drukken.
   */
  let draft = await getDraftProposal(commerce.id);
  if (!draft) {
    draft = await createOrGetDraft(commerce, lead, actor.id);
    if (!draft) redirect(`/admin/leads/${id}`);
  }

  const alle = await listProposals(commerce.id);
  const eerderVerstuurd = alle.filter((p) => p.status !== "DRAFT").length;

  const cfg = toConfig(commerce);

  const data: EditorData = {
    leadId: id,
    // Directe klant: dezelfde editor en hetzelfde versiemodel, maar het stuk
    // heet opdrachtbevestiging en gaat meteen als overeenkomst de deur uit.
    direct: isDirectJourney(lead.journeyVariant),
    version: draft.version,
    klant: {
      bedrijfsnaam: lead.bedrijfsnaam,
      naam: lead.naam,
      email: lead.email,
      plaats: lead.plaats,
      telefoon: lead.telefoon,
    },
    content: {
      titel: draft.titel ?? "",
      intro: draft.intro ?? "",
      omschrijving: draft.omschrijving ?? "",
      werkzaamheden: (draft.werkzaamheden ?? []).join("\n"),
      modules: (draft.modules ?? []).join("\n"),
      bijzonderheden: draft.bijzonderheden ?? "",
      geldigTot: dateInput(draft.geldigTot),
    },
    config: {
      project: euroInput(cfg.projectCents),
      setup: euroInput(cfg.setupCents),
      discountType: cfg.discountType,
      discountValue:
        cfg.discountType === "percent" ? String(cfg.discountValue) : euroInput(cfg.discountValue),
      vat: String(cfg.vatPercent),
      depositPercent: String(cfg.depositPercent),
      monthly: euroInput(cfg.monthlyCents),
      freeMonths: String(cfg.freeMonths),
      introPercent: String(cfg.introDiscountPercent),
      introMonths: String(cfg.introDiscountMonths),
      startRule: commerce.subscriptionStartRule,
      startAt: dateInput(commerce.subscriptionStartAt),
      opmerkingen: commerce.opmerkingen ?? "",
      paymentPlan: commerce.paymentPlan,
      installmentCount: String(commerce.installmentCount),
      installmentStart: commerce.installmentStart,
      installmentStartDate: commerce.installmentStartDate ?? "",
    },
    // De OPGESLAGEN afspraak, server-side berekend — precies wat bij versturen
    // bevroren wordt. De editor rekent live vooruit met dezelfde functie.
    opgeslagen: afspraakOverzicht(cfg, planConfig(commerce)),
    basis: {
      freeMonths: cfg.freeMonths,
      introDiscountPercent: cfg.introDiscountPercent,
      introDiscountMonths: cfg.introDiscountMonths,
    },
    eerderVerstuurd,
    proefNaar: proefOntvanger(),
  };

  return <ProposalEditor data={data} />;
}
