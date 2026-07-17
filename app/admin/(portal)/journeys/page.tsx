import Link from "next/link";
import { count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { STAGE_META } from "@/lib/journey";
import { LeadStatusBadge } from "../leads/status-badge";

export const metadata = { title: "Demo Journeys" };

export default async function JourneysPage() {
  const db = getDb();
  if (!db) {
    return (
      <div className="rounded-2xl bg-brand-100 p-6 text-sm text-brand-600">
        <strong>Database niet gekoppeld.</strong>
      </div>
    );
  }

  const [byStage, [totaal], [gestart], [viaAffiliate], [gemDuur], perMaand, recent] =
    await Promise.all([
      db
        .select({ stage: schema.leads.stage, n: count() })
        .from(schema.leads)
        .groupBy(schema.leads.stage),
      db.select({ n: count() }).from(schema.leads),
      db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.stage, "gestart")),
      db.select({ n: count() }).from(schema.leads).where(isNotNull(schema.leads.affiliatePartnerId)),
      // Gemiddelde doorlooptijd (dagen) van afgeronde journeys
      db
        .select({
          dagen: sql<number>`coalesce(avg(extract(epoch from (${schema.leads.demoSentAt} - ${schema.leads.createdAt})) / 86400), 0)`,
        })
        .from(schema.leads)
        .where(isNotNull(schema.leads.demoSentAt)),
      db
        .select({
          maand: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM')`,
          n: count(),
        })
        .from(schema.leads)
        .groupBy(sql`to_char(${schema.leads.createdAt}, 'YYYY-MM')`)
        .orderBy(desc(sql`to_char(${schema.leads.createdAt}, 'YYYY-MM')`))
        .limit(6),
      db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(8),
    ]);

  const countBy = new Map<JourneyStage, number>();
  for (const row of byStage) countBy.set(row.stage, row.n);

  const conversie = totaal.n > 0 ? Math.round((gestart.n / totaal.n) * 100) : 0;
  const gemiddeldeDagen = Math.round(Number(gemDuur.dagen) * 10) / 10;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Demo Journeys</h1>
      <p className="mt-1 text-sm text-ink-500">
        Het centrale verkoopproces — waar bevindt elke aanvraag zich?
      </p>

      {/* Kerncijfers */}
      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Totaal aanvragen" value={totaal.n} />
        <Stat label="Conversie naar gestart" value={`${conversie}%`} />
        <Stat label="Gem. tijd tot demo" value={`${gemiddeldeDagen} d`} />
        <Stat label="Via affiliates" value={viaAffiliate.n} />
      </div>

      {/* Pipeline per stage */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Pipeline</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {JOURNEY_STAGES.map((stage) => (
            <Link
              key={stage}
              href={`/admin/journeys/${stage}`}
              className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <p className="text-2xl font-extrabold text-ink">{countBy.get(stage) ?? 0}</p>
              <p className="mt-0.5 text-[11px] font-semibold leading-tight text-ink-500">
                {STAGE_META[stage].label}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Per maand */}
      {perMaand.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-extrabold text-ink">Aanvragen per maand</h2>
          <div className="flex items-end gap-3 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
            {[...perMaand].reverse().map((m) => {
              const max = Math.max(...perMaand.map((x) => x.n));
              return (
                <div key={m.maand} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold text-ink">{m.n}</span>
                  <div
                    className="w-full rounded-t bg-brand/80"
                    style={{ height: `${Math.max((m.n / max) * 80, 4)}px` }}
                  />
                  <span className="text-[10px] text-ink-300">{m.maand.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recente aanvragen */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Laatste aanvragen</h2>
        <ul className="space-y-2">
          {recent.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/leads/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-ink">
                    {l.bedrijfsnaam}
                  </span>
                  <span className="block text-[11px] text-ink-300">
                    {l.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                    {" · "}bron: {l.source}
                    {l.referralCodeSnapshot && ` · ${l.referralCodeSnapshot}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-cream-100 px-2.5 py-1 text-[10px] font-bold text-ink-700">
                    {STAGE_META[l.stage].korte}
                  </span>
                  <LeadStatusBadge status={l.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[12px] text-ink-300">
        Omzet uit demo&apos;s verschijnt hier zodra facturatie is ingericht —
        er worden bewust geen verzonnen bedragen getoond.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
    </div>
  );
}
