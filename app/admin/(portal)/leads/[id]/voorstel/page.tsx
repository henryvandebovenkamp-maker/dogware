import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  createOrGetDraft,
  ensureCommerce,
  freezePricing,
  getDraftProposal,
  listProposals,
  toConfig,
} from "@/lib/proposals";
import { computeOneOff, euroFromCents } from "@/lib/money";
import { ProposalEditor, type EditorData } from "@/components/commerce/proposal-editor";

export const metadata: Metadata = {
  title: "Voorstel",
  robots: { index: false, follow: false },
};

const euroInput = (cents: number) => (cents / 100).toFixed(2);
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

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
  const berekend = computeOneOff(cfg);
  void freezePricing;

  const data: EditorData = {
    leadId: id,
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
    },
    computed: {
      subtotal: euroFromCents(berekend.subtotalCents),
      discount: euroFromCents(berekend.discountCents),
      net: euroFromCents(berekend.netExVatCents),
      vat: euroFromCents(berekend.vatCents),
      total: euroFromCents(berekend.totalInclVatCents),
      deposit: euroFromCents(berekend.depositCents),
      final: euroFromCents(berekend.finalCents),
      depositPercent: berekend.depositPercent,
      finalPercent: berekend.finalPercent,
      monthlyExVat: euroFromCents(berekend.monthlyExVatCents),
      monthlyInclVat: euroFromCents(berekend.monthlyInclVatCents),
    },
    eerderVerstuurd,
  };

  return <ProposalEditor data={data} />;
}
