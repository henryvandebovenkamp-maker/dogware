import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getInvoiceView } from "@/lib/documents";
import { effectieveStatus } from "@/lib/invoices";
import { euroFromCents } from "@/lib/money";
import { StatusBadge } from "../status-badge";
import { FactuurActies } from "./factuur-acties";

export const metadata: Metadata = {
  title: "Factuur",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * De factuurdetailpagina in de administratie.
 *
 * Rustig en feitelijk: wat is het, van wie, waar hoort het bij, en wat is
 * ermee gebeurd. De factuur zelf (het document dat de klant ziet) staat één
 * klik verderop — bewust dezelfde weergave als de klant krijgt, want twee
 * versies van één factuur is precies wat je niet wilt.
 */
export default async function FactuurDetailPage({
  params,
}: {
  params: Promise<{ nummer: string }>;
}) {
  await requireAdmin();
  const { nummer } = await params;

  const factuur = await getInvoiceView(decodeURIComponent(nummer));
  if (!factuur) notFound();
  const { view, doc } = factuur;

  const db = getDb();
  const [lead] = db
    ? await db.select().from(schema.leads).where(eq(schema.leads.id, doc.leadId)).limit(1)
    : [];
  if (!lead) notFound();

  // Waar deze factuur vandaan komt: de opdracht (getekende overeenkomst) en
  // het voorstel waarop die is gebaseerd.
  const [overeenkomst] = db && doc.agreementId
    ? await db
        .select()
        .from(schema.agreements)
        .where(eq(schema.agreements.id, doc.agreementId))
        .limit(1)
    : [];
  const [betaling] = db && doc.paymentId
    ? await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, doc.paymentId))
        .limit(1)
    : [];
  const [creditnota] = db && doc.creditedByDocumentId
    ? await db
        .select({ nummer: schema.documents.nummer })
        .from(schema.documents)
        .where(eq(schema.documents.id, doc.creditedByDocumentId))
        .limit(1)
    : [];
  const [gecrediteerde] = db && doc.creditsDocumentId
    ? await db
        .select({ nummer: schema.documents.nummer })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, doc.creditsDocumentId),
            eq(schema.documents.leadId, doc.leadId),
          ),
        )
        .limit(1)
    : [];

  const status = effectieveStatus(doc);
  const documentHref = `/admin/leads/${doc.leadId}/factuur/${encodeURIComponent(doc.nummer)}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/facturen"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar facturen
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-extrabold tracking-tight text-ink">
            {doc.nummer}
          </h1>
          <p className="mt-0.5 text-[14px] text-ink-500">{view.omschrijving}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={status} />
          <p className="mt-1.5 text-[19px] font-extrabold tabular-nums text-ink">
            {euroFromCents(view.bedragen.inclCents)}
          </p>
        </div>
      </div>

      {/* Waar het bij hoort */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Kaart titel="Klant">
          <Link
            href={`/admin/leads/${doc.leadId}`}
            className="text-[14px] font-extrabold text-ink hover:text-brand"
          >
            {view.klant.naam || lead.bedrijfsnaam}
          </Link>
          <p className="text-[12.5px] text-ink-500">
            {view.klant.contactpersoon ?? lead.naam}
            {view.klant.email && ` · ${view.klant.email}`}
          </p>
          <p className="mt-1 text-[12px] text-ink-300">
            Gegevens zoals vastgelegd bij het uitgeven van deze factuur.
          </p>
        </Kaart>

        <Kaart titel="Opdracht">
          {overeenkomst ? (
            <>
              <p className="text-[14px] font-bold text-ink">
                Overeenkomst — voorstel v{overeenkomst.proposalVersion}
              </p>
              <p className="text-[12.5px] text-ink-500">
                {overeenkomst.signedAt
                  ? `Getekend op ${lang(overeenkomst.signedAt)} door ${overeenkomst.signerName ?? "onbekend"}`
                  : "Nog niet getekend"}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-ink-300">
              Niet aan een overeenkomst gekoppeld.
            </p>
          )}
        </Kaart>
      </div>

      {/* Feiten */}
      <div className="mt-2 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
        <dl className="space-y-1.5 text-[13.5px]">
          <Regel label="Factuurdatum" value={lang(doc.issuedAt)} />
          <Regel label="Vervaldatum" value={doc.dueAt ? lang(doc.dueAt) : "—"} />
          <Regel label="Betaald op" value={doc.paidAt ? lang(doc.paidAt) : "—"} />
          <Regel label="Betaalmethode" value={view.betaling.methode ?? "—"} />
          <Regel
            label="Betaling"
            value={betaling ? `${betaling.type} · ${betaling.status}` : "—"}
          />
          <Regel label="Onze referentie" value={view.betaling.referentie ?? "—"} mono />
          <Regel label="Mollie" value={view.betaling.molliePaymentId ?? "—"} mono />
          <Regel
            label="Verstuurd"
            value={doc.sentAt ? `${lang(doc.sentAt)} naar ${doc.sentTo}` : "Nog niet verstuurd"}
          />
        </dl>
      </div>

      {/* Creditnota-verband */}
      {(creditnota || gecrediteerde) && (
        <p className="mt-2 rounded-xl bg-cream-100 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500 ring-1 ring-ink/5">
          {creditnota && (
            <>
              Deze factuur is gecrediteerd met{" "}
              <Link
                href={`/admin/facturen/${encodeURIComponent(creditnota.nummer)}`}
                className="font-mono font-bold text-ink hover:text-brand"
              >
                {creditnota.nummer}
              </Link>
              {doc.creditReason && ` — ${doc.creditReason}`}.
            </>
          )}
          {gecrediteerde && (
            <>
              Deze creditnota boekt factuur{" "}
              <Link
                href={`/admin/facturen/${encodeURIComponent(gecrediteerde.nummer)}`}
                className="font-mono font-bold text-ink hover:text-brand"
              >
                {gecrediteerde.nummer}
              </Link>
              {doc.creditReason && ` tegen — ${doc.creditReason}`}.
            </>
          )}
        </p>
      )}

      {/* Regels */}
      <div className="mt-2 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-300">
          Factuurregels
        </p>
        <ul className="divide-y divide-cream-200">
          {view.regels.map((r, i) => (
            <li
              key={`${r.omschrijving}-${i}`}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[13.5px]"
            >
              <span className="min-w-0">
                <span className="font-semibold text-ink">{r.omschrijving}</span>
                {r.toelichting && (
                  <span className="block text-[12.5px] text-ink-500">{r.toelichting}</span>
                )}
              </span>
              <span className="tabular-nums text-ink-500">
                {r.aantal} × {euroFromCents(r.prijsExVatCents)} · {r.vatPercent}% ={" "}
                <span className="font-bold text-ink">{euroFromCents(r.regelExVatCents)}</span>
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-cream-200 pt-3 text-[13.5px]">
          <Regel label="Subtotaal excl. btw" value={euroFromCents(view.bedragen.exclCents)} />
          <Regel
            label={`Btw ${view.bedragen.btwPercent}%`}
            value={euroFromCents(view.bedragen.btwCents)}
          />
          <Regel
            label="Totaal incl. btw"
            value={euroFromCents(view.bedragen.inclCents)}
            nadruk
          />
        </dl>
      </div>

      {/* Acties */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={documentHref}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink shadow-soft ring-1 ring-ink/5 transition hover:shadow-lift"
        >
          <FileText className="h-3.5 w-3.5" />
          Bekijk factuur
        </Link>
        <Link
          href={documentHref}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink shadow-soft ring-1 ring-ink/5 transition hover:shadow-lift"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Download PDF
        </Link>
      </div>
      <p className="mt-1.5 text-[12px] text-ink-300">
        De PDF maak je op de factuurpagina zelf met &ldquo;Afdrukken of opslaan als
        PDF&rdquo;. Dat is exact het document dat de klant ziet.
      </p>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
        <FactuurActies
          documentId={doc.id}
          klantEmail={lead.email}
          eerderVerstuurdAan={doc.sentTo}
          crediteerbaar={doc.type !== "CREDIT_NOTE" && !doc.creditedByDocumentId}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-ink-300">
          Een factuur wordt nooit handmatig op betaald gezet: die status komt uitsluitend uit de
          bevestigde Mollie-betaling. Corrigeren gebeurt met een creditnota, niet door te
          verwijderen.
        </p>
      </div>
    </div>
  );
}

const lang = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

function Kaart({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-300">
        {titel}
      </p>
      {children}
    </div>
  );
}

function Regel({
  label,
  value,
  mono,
  nadruk,
}: {
  label: string;
  value: string;
  mono?: boolean;
  nadruk?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <dt className={nadruk ? "font-extrabold text-ink" : "text-ink-500"}>{label}</dt>
      <dd
        className={`tabular-nums ${mono ? "font-mono text-[12px] text-ink-500" : ""} ${
          nadruk ? "text-[15px] font-extrabold text-ink" : "text-ink-700"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
