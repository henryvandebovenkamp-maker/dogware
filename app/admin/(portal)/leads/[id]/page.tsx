import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { STAGE_META } from "@/lib/journey-stages";
import { LeadAdminForm } from "./lead-admin-form";
import { ReassignForm } from "./reassign-form";
import { StageTimeline } from "./journey";
import { DemoPanel, StageControl } from "./journey-controls";
import { AdminCommercePanel } from "@/components/commerce/admin-panel";
import { buildPanelData } from "@/lib/commerce-view";

export const metadata: Metadata = {
  title: "Lead",
  robots: { index: false, follow: false },
};

const WEBSITE_LABELS: Record<string, string> = {
  nee: "Nee",
  ja: "Ja",
  "ja-nieuw": "Ja, maar wil iets nieuws",
};

/** Rustige sectie-wrapper. */
function Sectie({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-300">
        {titel}
      </h2>
      {children}
    </section>
  );
}

function Regel({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <p className="text-[14px] leading-relaxed text-ink-700">
      <span className="font-semibold text-ink">{label}:</span> {value}
    </p>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[13px] text-ink-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="rounded-full bg-cream-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-700">
          {i}
        </span>
      ))}
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  if (!db) notFound();

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id))
    .limit(1);
  if (!lead) notFound();

  const attributedPartner = lead.affiliatePartnerId
    ? (
        await db
          .select()
          .from(schema.partners)
          .where(eq(schema.partners.id, lead.affiliatePartnerId))
          .limit(1)
      )[0]
    : null;
  const allePartners = await db
    .select({
      id: schema.partners.id,
      bedrijfsnaam: schema.partners.bedrijfsnaam,
      referralCode: schema.partners.referralCode,
    })
    .from(schema.partners);

  const events = await db
    .select()
    .from(schema.journeyEvents)
    .where(eq(schema.journeyEvents.leadId, id))
    .orderBy(desc(schema.journeyEvents.createdAt))
    .limit(50);

  const panelData = await buildPanelData(id);

  return (
    <main className="mx-auto w-full max-w-2xl">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" /> Alle aanvragen
      </Link>

      {/* Rustige kop: wie, waar in de journey */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {lead.bedrijfsnaam}
          </h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {lead.naam}
            {" · "}
            {lead.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-[#2f6bed]/10 px-3 py-1 text-[12px] font-bold text-[#2f6bed]">
            {STAGE_META[lead.stage].label}
          </span>
          {!lead.demoSentAt && (
            <span className="text-[11px] font-semibold text-ink-300">
              Voorbeeld nog niet verstuurd
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {/* 1. Klant */}
        <Sectie titel="Klant">
          <div className="space-y-1">
            <Regel label="Naam" value={lead.naam} />
            <Regel label="Bedrijf" value={lead.bedrijfsnaam} />
            <Regel label="Telefoon" value={lead.telefoon} />
            <Regel label="E-mail" value={lead.email} />
            <Regel label="Plaats" value={lead.plaats} />
            <Regel label="Website" value={lead.website} />
          </div>

          {attributedPartner && (
            <p className="mt-2 text-[13px] text-ink-500">
              Aangebracht via{" "}
              <Link href={`/admin/partners/${attributedPartner.id}`} className="font-bold text-brand hover:underline">
                {attributedPartner.bedrijfsnaam}
              </Link>{" "}
              <span className="font-mono text-[12px]">({lead.referralCodeSnapshot})</span>
            </p>
          )}

          {/* Volledige aanvraag — ingeklapt, rustig */}
          <details className="mt-3 rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink-500">
              Volledige aanvraag bekijken
            </summary>
            <div className="mt-3 space-y-3 border-t border-cream-100 pt-3">
              <div>
                <p className="text-[12px] font-bold text-ink">Diensten</p>
                <Chips items={lead.diensten} />
                {lead.dienstenAnders && <p className="mt-1 text-[13px] text-ink-700">Anders: {lead.dienstenAnders}</p>}
              </div>
              <Regel label="Heeft website" value={lead.heeftWebsite ? WEBSITE_LABELS[lead.heeftWebsite] : undefined} />
              <Regel label="Goed aan huidige site" value={lead.websiteGoed} />
              <Regel label="Mist" value={lead.websiteMist} />
              <div>
                <p className="text-[12px] font-bold text-ink">Huidige software</p>
                <Chips items={lead.software} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink">Grootste tijdvreters</p>
                <Chips items={lead.tijdvreters} />
              </div>
              <Regel label="Droomwebsite" value={lead.droomscenario} />
              <Regel label="Inspiratie" value={lead.inspiratie} />
              <Regel label="Logo" value={lead.heeftLogo === "ja" ? "Ja" : lead.heeftLogo === "nee" ? "Nee" : undefined} />
              <Regel label="Huisstijl" value={lead.huisstijl} />
              <div>
                <p className="text-[12px] font-bold text-ink">Gewenste functies</p>
                <Chips items={lead.functies} />
              </div>
              <Regel label="Opmerkingen" value={lead.opmerkingen} />
              {lead.uploads.length > 0 && (
                <ul className="space-y-1">
                  {lead.uploads.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-600">
                        <ExternalLink className="h-3.5 w-3.5" />
                        {decodeURIComponent(url.split("/").pop() ?? url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {/* Handmatige partner-hertoewijzing (zelden nodig) */}
              <div className="border-t border-cream-100 pt-2">
                <ReassignForm
                  leadId={lead.id}
                  currentPartnerId={lead.affiliatePartnerId}
                  partners={allePartners.map((p) => ({ id: p.id, label: `${p.bedrijfsnaam} (${p.referralCode})` }))}
                />
              </div>
            </div>
          </details>

          {/* Interne notitie + leadstatus */}
          <div className="mt-3 rounded-xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            <LeadAdminForm leadId={lead.id} status={lead.status} notities={lead.notities ?? ""} />
          </div>
        </Sectie>

        {/* 2. Voorbeeld */}
        <Sectie titel="Voorbeeld">
          <div className="rounded-xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            <DemoPanel
              leadId={lead.id}
              website={lead.demoDomain ?? ""}
              portaal={lead.demoPortalUrl ?? ""}
              loginEmail={lead.demoLoginEmail ?? ""}
              klantEmail={lead.email}
              alSent={Boolean(lead.demoSentAt)}
            />
          </div>
        </Sectie>

        {/* Financiën & betalingen */}
        <Sectie titel="Financiën & betalingen">
          <div className="rounded-xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
            <AdminCommercePanel data={panelData} />
          </div>
        </Sectie>

        {/* 3. Journey */}
        <Sectie titel="Journey">
          <div className="rounded-xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
            <StageTimeline current={lead.stage} />
            <div className="mt-4 border-t border-cream-100 pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                Stap handmatig zetten
              </p>
              <StageControl leadId={lead.id} current={lead.stage} />
            </div>
          </div>
        </Sectie>

        {/* 4. Activiteit */}
        <Sectie titel="Activiteit">
          <div className="rounded-xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            {events.length === 0 ? (
              <p className="py-2 text-center text-[13px] text-ink-300">Nog geen activiteit.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-[13px]">
                    <span className="w-24 shrink-0 text-[11px] text-ink-300">
                      {e.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                      {" "}
                      {e.createdAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-ink-700">{e.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Sectie>
      </div>
    </main>
  );
}
