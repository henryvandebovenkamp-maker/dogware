import Link from "next/link";
import { Check, Download, FileText } from "lucide-react";
import type { KlantFactuur } from "@/lib/invoices";
import { INVOICE_STATUS_LABEL } from "@/lib/invoices";
import { euroFromCents } from "@/lib/money";

/**
 * "Mijn facturen" in het klantaccount.
 *
 * Bewust niet technisch: geen Mollie-id's, geen interne velden, geen
 * statuscodes. De klant wil vier dingen weten — waarvoor, hoeveel, is het
 * betaald, en waar kan ik hem downloaden. Meer hoort hier niet te staan.
 */
export function KlantFacturen({ facturen }: { facturen: KlantFactuur[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">Facturen</h2>

      {facturen.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-white px-5 py-6 text-[14px] leading-relaxed text-ink-500 shadow-soft ring-1 ring-ink/5">
          Je hebt nog geen facturen. Zodra er een factuur beschikbaar is, vind je die hier terug.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {facturen.map((f) => (
            <li
              key={f.nummer}
              className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-mono text-[13px] font-bold text-ink">{f.nummer}</span>
                <span className="text-[17px] font-extrabold tabular-nums text-ink">
                  {euroFromCents(f.totalInclVatCents)}
                </span>
              </div>

              <p className="mt-1 text-[14.5px] font-semibold leading-snug text-ink-700">
                {f.omschrijving}
              </p>
              <p className="text-[13px] text-ink-500">{lang(f.issuedAt)}</p>

              {f.status === "BETAALD" ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-sage-600">
                  <Check className="h-3.5 w-3.5" />
                  Betaald{f.paidAt && ` op ${lang(f.paidAt)}`}
                </p>
              ) : f.isCreditnota ? (
                <p className="mt-2 text-[13px] font-semibold text-ink-500">
                  Creditnota — dit bedrag is teruggeboekt.
                </p>
              ) : (
                <p className="mt-2 text-[13px] font-semibold text-ink-500">
                  {INVOICE_STATUS_LABEL[f.status]}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link
                  href={`/account/facturen/${encodeURIComponent(f.nummer)}`}
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-brand transition hover:text-brand-600"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Bekijk factuur
                </Link>
                {/*
                 * Downloaden is dezelfde pagina: daar staat de knop
                 * "Afdrukken of opslaan als PDF". Eén document, één weergave —
                 * geen aparte PDF die iets anders zou kunnen zeggen.
                 */}
                <Link
                  href={`/account/facturen/${encodeURIComponent(f.nummer)}`}
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-ink-500 transition hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const lang = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
