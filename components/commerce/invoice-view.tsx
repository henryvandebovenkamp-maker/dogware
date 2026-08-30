import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { InvoiceView } from "@/lib/documents";
import { euroFromCents } from "@/lib/money";
import { BrandMark } from "@/components/brand";
import { PrintKnop } from "./print-button";

/**
 * De factuur zoals hij op het scherm en op papier staat.
 *
 * Bewust één component voor de admin én de klant: een factuur die er voor de
 * beheerder anders uitziet dan voor de ontvanger is geen factuur maar een
 * weergave. Alleen de terugweg en de interne waarschuwing verschillen.
 *
 * Alles wat hier getoond wordt komt uit de BEVROREN momentopname van het
 * document (zie lib/documents.ts). Verhuist de klant volgend jaar, dan blijft
 * deze factuur het adres tonen dat er destijds op stond.
 *
 * Geen PDF-generator. De browser maakt er met "Print → Bewaar als PDF" een
 * echte PDF van; de print-stijlen hieronder zorgen dat er dan geen navigatie
 * of knoppen op het papier belanden. Dat scheelt een afhankelijkheid die we
 * alleen voor de opmaak zouden binnenhalen.
 */
export function Factuur({
  factuur,
  terug,
  toonInterneWaarschuwing = false,
}: {
  factuur: InvoiceView;
  terug: { href: string; label: string };
  toonInterneWaarschuwing?: boolean;
}) {
  const f = factuur;
  const datum = (d: Date) =>
    d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const kop = f.isCreditnota ? "Creditnota" : "Factuur";

  return (
    <div className="min-h-screen bg-cream px-5 py-8 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-[820px]">
        {/* Alles in dit blok verdwijnt bij het afdrukken */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={terug.href}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
          >
            <ArrowLeft className="h-4 w-4" /> {terug.label}
          </Link>
          <PrintKnop />
        </div>

        {toonInterneWaarschuwing && f.leverancier.ontbreekt.length > 0 && (
          <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-[12.5px] leading-relaxed text-brand-600 ring-1 ring-brand/10 print:hidden">
            <span className="font-bold">Nog niet compleet:</span>{" "}
            {f.leverancier.ontbreekt.join(" en ")} ontbrak toen deze factuur werd uitgegeven. Een
            Nederlandse factuur hoort dit te vermelden — vul het aan in{" "}
            <code className="font-mono text-[11.5px]">lib/legal-entity.ts</code>. Bestaande
            facturen blijven bewust ongewijzigd.
          </p>
        )}

        <article className="rounded-2xl bg-white p-8 shadow-soft ring-1 ring-ink/5 sm:p-12 print:rounded-none print:p-0 print:shadow-none print:ring-0">
          {/* Kop */}
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-cream-200 pb-8">
            <div>
              <BrandMark size={44} className="h-11 w-11" />
              <p className="mt-3 text-[13px] font-extrabold text-ink">{f.leverancier.naam}</p>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
                {f.leverancier.adresregels.map((r) => (
                  <div key={r}>{r}</div>
                ))}
                {f.leverancier.land && <div>{f.leverancier.land}</div>}
                {f.leverancier.email && <div>{f.leverancier.email}</div>}
                {f.leverancier.telefoon && <div>{f.leverancier.telefoon}</div>}
                {f.leverancier.kvk && <div>KvK {f.leverancier.kvk}</div>}
                {f.leverancier.btw && <div>Btw {f.leverancier.btw}</div>}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-[26px] font-extrabold tracking-tight text-ink">{kop}</h1>
              <p className="mt-1 font-mono text-[13px] font-bold text-ink-700">{f.nummer}</p>
              <p className="mt-2 text-[12.5px] text-ink-500">Factuurdatum {datum(f.datum)}</p>
              {f.vervaldatum && (
                <p className="text-[12.5px] text-ink-500">
                  Vervaldatum {datum(f.vervaldatum)}
                </p>
              )}
              {f.betaling.betaald && !f.isCreditnota && (
                <span className="mt-3 inline-block rounded-full bg-sage-100 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-sage-600">
                  Voldaan
                </span>
              )}
              {f.status === "GECREDITEERD" && (
                <span className="mt-3 inline-block rounded-full bg-cream-200 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-500">
                  Gecrediteerd
                </span>
              )}
            </div>
          </header>

          {/* Aan wie */}
          <section className="border-b border-cream-200 py-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
              {kop} aan
            </p>
            <p className="mt-2 text-[15px] font-extrabold text-ink">{f.klant.naam}</p>
            <div className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
              {f.klant.contactpersoon && <div>t.a.v. {f.klant.contactpersoon}</div>}
              {f.klant.adresregels.map((r) => (
                <div key={r}>{r}</div>
              ))}
              {f.klant.land && <div>{f.klant.land}</div>}
              {f.klant.email && <div>{f.klant.email}</div>}
              {f.klant.kvk && <div>KvK {f.klant.kvk}</div>}
              {f.klant.btw && <div>Btw {f.klant.btw}</div>}
            </div>
          </section>

          {/* De regels */}
          <section className="py-7">
            {/* Op een smal scherm mag de tabel schuiven, de pagina niet */}
            <div className="-mx-1 overflow-x-auto px-1 print:overflow-visible">
              <table className="w-full min-w-[440px] border-collapse">
                <thead>
                  <tr className="border-b border-cream-200">
                    <Kop>Omschrijving</Kop>
                    <Kop rechts>Aantal</Kop>
                    <Kop rechts>Prijs</Kop>
                    <Kop rechts>Btw</Kop>
                    <Kop rechts>Totaal</Kop>
                  </tr>
                </thead>
                <tbody>
                  {f.regels.map((r, i) => (
                    <tr key={`${r.omschrijving}-${i}`} className="align-top">
                      <td className="py-4 pr-4 text-[14px] leading-relaxed text-ink-700">
                        <span className="font-semibold text-ink">{r.omschrijving}</span>
                        {r.toelichting && (
                          <span className="mt-0.5 block text-[12.5px] text-ink-500">
                            {r.toelichting}
                          </span>
                        )}
                      </td>
                      <td className="py-4 pl-2 text-right text-[14px] tabular-nums text-ink-700">
                        {r.aantal}
                      </td>
                      <td className="py-4 pl-2 text-right text-[14px] tabular-nums text-ink-700">
                        {euroFromCents(r.prijsExVatCents)}
                      </td>
                      <td className="py-4 pl-2 text-right text-[14px] tabular-nums text-ink-700">
                        {r.vatPercent}%
                      </td>
                      <td className="py-4 pl-2 text-right text-[14px] font-semibold tabular-nums text-ink">
                        {euroFromCents(r.regelExVatCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totalen */}
            <div className="mt-2 flex justify-end border-t border-cream-200 pt-4">
              <dl className="w-full max-w-[300px] space-y-2">
                <Regel label="Subtotaal excl. btw" value={euroFromCents(f.bedragen.exclCents)} />
                <Regel
                  label={`Btw ${f.bedragen.btwPercent}%`}
                  value={euroFromCents(f.bedragen.btwCents)}
                />
                <div className="border-t border-ink/10 pt-2">
                  <Regel
                    label="Totaal incl. btw"
                    value={euroFromCents(f.bedragen.inclCents)}
                    groot
                  />
                </div>
              </dl>
            </div>
          </section>

          {/* Betaling */}
          <footer className="border-t border-cream-200 pt-6">
            {f.isCreditnota ? (
              <p className="text-[13px] leading-relaxed text-ink-500">
                <span className="font-bold text-ink">Creditnota.</span> Deze nota boekt factuur{" "}
                {f.betaling.referentie ?? "hierboven"} tegen. Er hoeft niets te worden
                overgemaakt.
              </p>
            ) : f.betaling.betaald ? (
              <p className="text-[13px] leading-relaxed text-ink-500">
                <span className="font-bold text-ink">Reeds voldaan</span>
                {f.betaling.betaaldOp && ` op ${datum(f.betaling.betaaldOp)}`}
                {f.betaling.methode && ` via ${f.betaling.methode}`}. Dit bedrag hoeft niet meer
                te worden overgemaakt.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-500">
                Deze factuur staat nog open
                {f.vervaldatum && ` en vervalt op ${datum(f.vervaldatum)}`}.
                {f.leverancier.iban &&
                  ` Je kunt het bedrag overmaken naar ${f.leverancier.iban} t.n.v. ${f.leverancier.naam}, onder vermelding van ${f.nummer}.`}
              </p>
            )}
            {(f.betaling.referentie || f.betaling.molliePaymentId) && !f.isCreditnota && (
              <p className="mt-1.5 font-mono text-[11px] text-ink-300">
                {f.betaling.referentie}
                {f.betaling.molliePaymentId && ` · ${f.betaling.molliePaymentId}`}
              </p>
            )}
            <p className="mt-5 text-[11.5px] leading-relaxed text-ink-300">
              DogWare is een dienst van {f.leverancier.naam}
              {f.leverancier.kvk && ` · KvK ${f.leverancier.kvk}`}
              {f.leverancier.btw && ` · btw ${f.leverancier.btw}`}
              {f.leverancier.iban && ` · ${f.leverancier.iban}`}. Vragen over deze factuur? Mail{" "}
              {f.leverancier.email}.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Kop({ children, rechts }: { children: React.ReactNode; rechts?: boolean }) {
  return (
    <th
      className={`pb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300 ${
        rechts ? "pl-2 text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Regel({
  label,
  value,
  groot,
}: {
  label: string;
  value: string;
  groot?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={groot ? "text-[14px] font-extrabold text-ink" : "text-[13px] text-ink-500"}>
        {label}
      </dt>
      <dd
        className={
          groot
            ? "text-[18px] font-extrabold tabular-nums text-ink"
            : "text-[13px] tabular-nums text-ink-700"
        }
      >
        {value}
      </dd>
    </div>
  );
}
