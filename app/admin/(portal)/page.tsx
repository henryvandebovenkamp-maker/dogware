import Link from "next/link";
import { and, count, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { LeadStatusBadge } from "./leads/status-badge";

export const metadata = { title: "Overzicht" };

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-300">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-ink">
        {value}
      </p>
    </Link>
  );
}

export default async function AdminDashboard() {
  const db = getDb();
  if (!db) {
    return (
      <div className="rounded-2xl bg-brand-100 p-6 text-sm text-brand-600">
        <strong>Database niet gekoppeld.</strong> Zet <code>DATABASE_URL</code>{" "}
        in de environment en draai de migratie — daarna komt dit dashboard tot
        leven.
      </div>
    );
  }

  const [
    [totalLeads],
    [newLeads],
    [partnerLeads],
    [activePartners],
    [clicks],
    recentLeads,
    recentPartners,
    recentActivity,
  ] = await Promise.all([
    db.select({ n: count() }).from(schema.leads),
    db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.status, "nieuw")),
    db.select({ n: count() }).from(schema.leads).where(isNotNull(schema.leads.affiliatePartnerId)),
    db.select({ n: count() }).from(schema.partners).where(eq(schema.partners.status, "ACTIVE")),
    db
      .select({ n: count() })
      .from(schema.referralClicks)
      .where(and(eq(schema.referralClicks.isBot, false), eq(schema.referralClicks.isInternal, false))),
    db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(5),
    db
      .select({ partner: schema.partners, user: schema.users })
      .from(schema.partners)
      .innerJoin(schema.users, eq(schema.partners.userId, schema.users.id))
      .orderBy(desc(schema.partners.createdAt))
      .limit(5),
    db
      .select()
      .from(schema.activityLog)
      .where(gt(schema.activityLog.createdAt, sql`now() - interval '7 days'`))
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(8),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Overzicht</h1>
      <p className="mt-1 text-sm text-ink-500">
        Het centrale beeld van DogWare — alles klikbaar.
      </p>

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Demo-aanvragen" value={totalLeads.n} href="/admin/leads" />
        <StatCard label="Nieuw" value={newLeads.n} href="/admin/leads" />
        <StatCard label="Via partners" value={partnerLeads.n} href="/admin/referrals" />
        <StatCard label="Actieve partners" value={activePartners.n} href="/admin/partners" />
        <StatCard label="Geldige clicks" value={clicks.n} href="/admin/referrals" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* Recente aanvragen */}
        <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">Laatste aanvragen</h2>
            <Link href="/admin/leads" className="text-[12px] font-semibold text-brand hover:text-brand-600">
              alles →
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-300">Nog geen aanvragen</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {recentLeads.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/admin/leads/${l.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-ink">
                        {l.bedrijfsnaam}
                      </span>
                      <span className="block text-[11px] text-ink-300">
                        {l.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                        {l.referralCodeSnapshot && ` · via ${l.referralCodeSnapshot}`}
                      </span>
                    </span>
                    <LeadStatusBadge status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Nieuwste partners */}
        <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">Nieuwste partners</h2>
            <Link href="/admin/partners" className="text-[12px] font-semibold text-brand hover:text-brand-600">
              alles →
            </Link>
          </div>
          {recentPartners.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-300">
              Nog geen partners —{" "}
              <Link href="/admin/partners/new" className="font-semibold text-brand">
                nodig de eerste uit
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {recentPartners.map(({ partner, user }) => (
                <li key={partner.id}>
                  <Link
                    href={`/admin/partners/${partner.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-ink">
                        {partner.bedrijfsnaam}
                      </span>
                      <span className="block text-[11px] text-ink-300">
                        {user.naam} · {partner.referralCode}
                      </span>
                    </span>
                    <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-[10px] font-bold text-ink-500">
                      {partner.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recente activiteit */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-ink">Recente activiteit</h2>
          <Link href="/admin/activiteit" className="text-[12px] font-semibold text-brand hover:text-brand-600">
            volledig log →
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-300">
            Nog geen activiteit deze week
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-[13px]">
                <span className="w-24 shrink-0 text-[11px] text-ink-300">
                  {a.createdAt.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="rounded-md bg-cream-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-700">
                  {a.action}
                </span>
                <span className="truncate text-ink-500">{a.objectType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
