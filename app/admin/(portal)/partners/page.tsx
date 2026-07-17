import Link from "next/link";
import { and, count, countDistinct, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Partners" };

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const db = getDb();

  const partners = db
    ? await db
        .select({
          partner: schema.partners,
          user: schema.users,
        })
        .from(schema.partners)
        .innerJoin(schema.users, eq(schema.partners.userId, schema.users.id))
        .orderBy(desc(schema.partners.createdAt))
    : [];

  // Statistieken per partner (clicks / uniek / aanvragen)
  const clickStats = db
    ? await db
        .select({
          partnerId: schema.referralClicks.partnerId,
          clicks: count(),
          uniek: countDistinct(schema.referralClicks.visitorId),
        })
        .from(schema.referralClicks)
        .where(
          and(
            eq(schema.referralClicks.isBot, false),
            eq(schema.referralClicks.isInternal, false),
          ),
        )
        .groupBy(schema.referralClicks.partnerId)
    : [];
  const leadStats = db
    ? await db
        .select({ partnerId: schema.leads.affiliatePartnerId, aanvragen: count() })
        .from(schema.leads)
        .groupBy(schema.leads.affiliatePartnerId)
    : [];

  const clicksBy = new Map(clickStats.map((s) => [s.partnerId, s]));
  const leadsBy = new Map(leadStats.map((s) => [s.partnerId, s.aanvragen]));

  const term = (q ?? "").toLowerCase();
  const filtered = partners.filter(({ partner, user }) => {
    if (status && partner.status !== status) return false;
    if (!term) return true;
    return [partner.bedrijfsnaam ?? user.naam, user.naam, user.email, partner.referralCode]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Partners</h1>
          <p className="mt-1 text-sm text-ink-500">Het DogWare Partnerprogramma.</p>
        </div>
        <Link
          href="/admin/partners/new"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600"
        >
          + Nieuwe partner
        </Link>
      </div>

      {/* Zoeken & filteren */}
      <form className="mt-5 flex flex-wrap gap-2.5" action="/admin/partners" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Zoek op naam, bedrijf, e-mail of code…"
          className="w-64 rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl border border-cream-200 bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
        >
          <option value="">Alle statussen</option>
          {["INVITED", "ACTIVE", "PAUSED", "BLOCKED", "ENDED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-cream hover:bg-ink-700"
        >
          Filter
        </button>
      </form>

      {!db && (
        <div className="mt-6 rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
          <strong>Database niet gekoppeld.</strong> Partners verschijnen hier zodra{" "}
          <code>DATABASE_URL</code> is ingesteld.
        </div>
      )}

      {db && filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-300">
          Geen partners gevonden.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {filtered.map(({ partner, user }) => {
          const cs = clicksBy.get(partner.id);
          const aanvragen = leadsBy.get(partner.id) ?? 0;
          const uniek = cs?.uniek ?? 0;
          const conversie = uniek > 0 ? Math.round((aanvragen / uniek) * 100) : 0;
          return (
            <li key={partner.id}>
              <Link
                href={`/admin/partners/${partner.id}`}
                className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block truncate font-extrabold text-ink">
                    {partner.bedrijfsnaam ?? user.naam}
                  </span>
                  <span className="block truncate text-[13px] text-ink-500">
                    {user.naam} · {user.email} ·{" "}
                    <span className="font-mono font-semibold text-brand">
                      {partner.referralCode}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4 text-[12px] font-semibold text-ink-500">
                  <span>{cs?.clicks ?? 0} clicks</span>
                  <span>{uniek} uniek</span>
                  <span>{aanvragen} demo&apos;s</span>
                  <span>{conversie}%</span>
                  <span className="rounded-full bg-cream-100 px-2.5 py-1 text-[10px] font-bold text-ink-700">
                    {partner.status}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
