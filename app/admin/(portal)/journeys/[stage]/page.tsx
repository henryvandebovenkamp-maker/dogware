import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { STAGE_META } from "@/lib/journey";
import { LeadStatusBadge } from "../../leads/status-badge";

export const metadata = { title: "Journey-fase" };

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  if (!JOURNEY_STAGES.includes(stage as JourneyStage)) notFound();
  const s = stage as JourneyStage;

  const db = getDb();
  const leads = db
    ? await db
        .select()
        .from(schema.leads)
        .where(eq(schema.leads.stage, s))
        .orderBy(desc(schema.leads.createdAt))
    : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/journeys" className="text-[13px] font-semibold text-ink-300 hover:text-ink-500">
        ← Alle journeys
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">
        {STAGE_META[s].label}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{leads.length} aanvraag(en) in deze fase.</p>

      {leads.length === 0 ? (
        <p className="mt-12 text-center text-sm text-ink-300">Geen aanvragen in deze fase.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/leads/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-ink">{l.bedrijfsnaam}</span>
                  <span className="block text-[11px] text-ink-300">
                    {l.naam} · {l.plaats} ·{" "}
                    {l.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
                <LeadStatusBadge status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
