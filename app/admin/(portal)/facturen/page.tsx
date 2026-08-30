import Link from "next/link";
import { Receipt } from "lucide-react";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/db/schema";
import { isDbConfigured } from "@/lib/db";
import { INVOICE_STATUS_LABEL, invoiceSummary, listInvoices } from "@/lib/invoices";
import { euroFromCents } from "@/lib/money";
import { StatusBadge } from "./status-badge";

export const metadata = { title: "Facturen" };
export const dynamic = "force-dynamic";

/**
 * De centrale factuuradministratie.
 *
 * Bewust een administratie-scherm en geen dashboard: een compacte kop met de
 * getallen die er toe doen, en daaronder een lijst die je kunt scannen. De
 * facturen zelf komen uit dezelfde `documents`-tabel als het klantportaal, dus
 * hier en daar staat per definitie hetzelfde.
 *
 * Filteren gebeurt via de URL (gewone GET-parameters). Dat is deelbaar,
 * bookmarkbaar en werkt zonder JavaScript — voor een administratiescherm is
 * dat precies goed.
 */
export default async function FacturenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const eerste = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };

  const q = eerste("q")?.trim() ?? "";
  const statusParam = eerste("status") ?? "alle";
  const status: InvoiceStatus | "alle" = (INVOICE_STATUSES as readonly string[]).includes(
    statusParam,
  )
    ? (statusParam as InvoiceStatus)
    : "alle";
  const van = eerste("van") ?? "";
  const tot = eerste("tot") ?? "";

  if (!isDbConfigured()) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Facturen</h1>
        <div className="mt-6 rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
          <strong>Database niet gekoppeld.</strong> Zonder database is er geen administratie.
        </div>
      </div>
    );
  }

  const [totalen, facturen] = await Promise.all([
    invoiceSummary(),
    listInvoices({ q, status, van, tot }),
  ]);

  const gefilterd = Boolean(q || status !== "alle" || van || tot);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-cream">
          <Receipt className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Facturen</h1>
          <p className="text-[13px] text-ink-500">
            Elke factuur ontstaat uit een echte betaling of termijn — er wordt hier niets
            handmatig bijgeboekt.
          </p>
        </div>
      </div>

      {/* Compacte totalen */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Totaal
          label="Openstaand"
          bedrag={euroFromCents(totalen.openstaandCents)}
          onder={`${totalen.openstaandAantal} ${totalen.openstaandAantal === 1 ? "factuur" : "facturen"}`}
        />
        <Totaal
          label="Betaald deze maand"
          bedrag={euroFromCents(totalen.betaaldDezeMaandCents)}
          onder={`${totalen.betaaldDezeMaandAantal} ${totalen.betaaldDezeMaandAantal === 1 ? "factuur" : "facturen"}`}
          accent="sage"
        />
        <Totaal
          label="Verlopen"
          bedrag={euroFromCents(totalen.verlopenCents)}
          onder={`${totalen.verlopenAantal} over de vervaldatum`}
          accent={totalen.verlopenAantal > 0 ? "brand" : undefined}
        />
        <Totaal
          label={`Gefactureerd ${new Date().getFullYear()}`}
          bedrag={euroFromCents(totalen.gefactureerdDitJaarCents)}
          onder="excl. btw, na creditnota's"
        />
      </div>

      {/* Zoeken en filteren */}
      <form
        method="get"
        className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/5"
      >
        <Veld label="Zoeken" className="min-w-[180px] flex-1 basis-52">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Klant, factuurnummer of referentie"
            className="w-full rounded-lg bg-cream px-3 py-2 text-[13px] text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink-300 focus:ring-brand/40"
          />
        </Veld>
        <Veld label="Status">
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg bg-cream px-3 py-2 text-[13px] text-ink ring-1 ring-ink/5 outline-none focus:ring-brand/40"
          >
            <option value="alle">Alle</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Veld>
        <Veld label="Vanaf">
          <input
            type="date"
            name="van"
            defaultValue={van}
            className="w-full rounded-lg bg-cream px-3 py-2 text-[13px] text-ink ring-1 ring-ink/5 outline-none focus:ring-brand/40"
          />
        </Veld>
        <Veld label="Tot en met">
          <input
            type="date"
            name="tot"
            defaultValue={tot}
            className="w-full rounded-lg bg-cream px-3 py-2 text-[13px] text-ink ring-1 ring-ink/5 outline-none focus:ring-brand/40"
          />
        </Veld>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-cream transition hover:bg-ink-700"
          >
            Filter
          </button>
          {gefilterd && (
            <Link
              href="/admin/facturen"
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink"
            >
              Wissen
            </Link>
          )}
        </div>
      </form>

      {/* De lijst */}
      {facturen.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-white p-12 text-center shadow-soft ring-1 ring-ink/5">
          <p className="text-sm font-semibold text-ink">
            {gefilterd ? "Geen facturen gevonden" : "Nog geen facturen"}
          </p>
          <p className="max-w-sm text-[13px] leading-relaxed text-ink-500">
            {gefilterd
              ? "Pas het filter aan om meer te zien."
              : "Zodra er een termijn betaald wordt, legt DogWare daar automatisch een factuur voor vast."}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-5 mb-2 text-[12px] font-semibold text-ink-300">
            {facturen.length} {facturen.length === 1 ? "factuur" : "facturen"}
          </p>

          {/* Tabel op desktop */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink/5 md:block">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-cream-200 bg-cream/40">
                  <Th>Factuur</Th>
                  <Th>Klant</Th>
                  <Th>Datum</Th>
                  <Th>Omschrijving</Th>
                  <Th rechts>Bedrag</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {facturen.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-cream-200/70 transition last:border-0 hover:bg-cream/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/facturen/${encodeURIComponent(f.nummer)}`}
                        className="font-mono text-[12.5px] font-bold text-ink hover:text-brand"
                      >
                        {f.nummer}
                      </Link>
                    </td>
                    <td className="max-w-[190px] px-4 py-3">
                      <Link
                        href={`/admin/leads/${f.leadId}`}
                        className="block truncate font-semibold text-ink-700 hover:text-brand"
                      >
                        {f.klant}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-500">
                      {kort(f.issuedAt)}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-ink-500">
                      {f.titel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-ink">
                      {euroFromCents(f.totalInclVatCents)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kaarten op mobiel — dezelfde gegevens, leesbaar op een telefoon */}
          <ul className="space-y-2 md:hidden">
            {facturen.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/admin/facturen/${encodeURIComponent(f.nummer)}`}
                  className="block rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5 transition hover:shadow-lift"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[12.5px] font-bold text-ink">{f.nummer}</span>
                    <span className="font-bold tabular-nums text-ink">
                      {euroFromCents(f.totalInclVatCents)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-700">
                    {f.klant}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-500">{f.titel}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[12px] tabular-nums text-ink-300">
                      {kort(f.issuedAt)}
                    </span>
                    <StatusBadge status={f.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const kort = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });

function Th({ children, rechts }: { children: React.ReactNode; rechts?: boolean }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-300 ${
        rechts ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Veld({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function Totaal({
  label,
  bedrag,
  onder,
  accent,
}: {
  label: string;
  bedrag: string;
  onder: string;
  accent?: "sage" | "brand";
}) {
  const kleur =
    accent === "sage" ? "text-sage-600" : accent === "brand" ? "text-brand-600" : "text-ink";
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-300">{label}</p>
      <p className={`mt-1 text-[19px] font-extrabold tabular-nums ${kleur}`}>{bedrag}</p>
      <p className="text-[11.5px] text-ink-300">{onder}</p>
    </div>
  );
}
