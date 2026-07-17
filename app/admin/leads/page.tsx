import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { Inbox, Users } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { isAdminAllowed } from "@/lib/admin-auth";
import { LeadStatusBadge } from "./status-badge";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!isAdminAllowed(token)) notFound();

  const db = getDb();
  const leads = db
    ? await db
        .select()
        .from(schema.leads)
        .orderBy(desc(schema.leads.createdAt))
    : null;

  const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : "";

  return (
    <main className="min-h-screen bg-cream px-5 py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Leads</h1>
            <p className="text-[13px] text-ink-500">
              Persoonlijke demo-aanvragen · nieuwste eerst
            </p>
          </div>
        </div>

        {!db && (
          <div className="rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
            <strong>Database niet geconfigureerd.</strong> Zet{" "}
            <code>DATABASE_URL</code> in <code>.env.local</code> en draai{" "}
            <code>npx drizzle-kit push</code>. Tot die tijd komen aanvragen
            alleen per e-mail binnen.
          </div>
        )}

        {leads && leads.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-ink/5">
            <Inbox className="h-8 w-8 text-ink-300" />
            <p className="font-semibold text-ink">Nog geen leads</p>
            <p className="text-sm text-ink-500">
              Zodra iemand de demo-intake invult, verschijnt de aanvraag hier.
            </p>
          </div>
        )}

        {leads && leads.length > 0 && (
          <ul className="space-y-3">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/admin/leads/${lead.id}${tokenSuffix}`}
                  className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block font-extrabold text-ink">
                      {lead.bedrijfsnaam}
                    </span>
                    <span className="block text-sm text-ink-500">
                      {lead.naam} · {lead.plaats} ·{" "}
                      {lead.createdAt.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    {lead.diensten.slice(0, 2).map((d) => (
                      <span
                        key={d}
                        className="hidden rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-ink-700 sm:inline"
                      >
                        {d}
                      </span>
                    ))}
                    <LeadStatusBadge status={lead.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
