import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, countDistinct, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { referralLinkFor } from "@/lib/referral";
import { euro } from "@/lib/partner-data";
import { LeadStatusBadge } from "../../leads/status-badge";
import { PartnerAdminActions } from "./partner-actions";

export const metadata = { title: "Partner" };

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  if (!db) notFound();

  const rows = await db
    .select({ partner: schema.partners, user: schema.users })
    .from(schema.partners)
    .innerJoin(schema.users, eq(schema.partners.userId, schema.users.id))
    .where(eq(schema.partners.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const { partner, user } = row;

  const [[clickStats], leads, activity] = await Promise.all([
    db
      .select({
        clicks: count(),
        uniek: countDistinct(schema.referralClicks.visitorId),
      })
      .from(schema.referralClicks)
      .where(
        and(
          eq(schema.referralClicks.partnerId, id),
          eq(schema.referralClicks.isBot, false),
          eq(schema.referralClicks.isInternal, false),
        ),
      ),
    db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.affiliatePartnerId, id))
      .orderBy(desc(schema.leads.createdAt))
      .limit(20),
    db
      .select()
      .from(schema.activityLog)
      .where(
        and(
          eq(schema.activityLog.objectType, "partner"),
          eq(schema.activityLog.objectId, id),
        ),
      )
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(15),
  ]);

  const referralLink = referralLinkFor(partner.referralCode);
  const conversie =
    clickStats.uniek > 0 ? Math.round((leads.length / Number(clickStats.uniek)) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/partners" className="text-[13px] font-semibold text-ink-300 hover:text-ink-500">
        ← Alle partners
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {partner.bedrijfsnaam ?? user.naam}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {user.naam} · {user.email}
            {partner.telefoon && ` · ${partner.telefoon}`}
          </p>
          <p className="mt-1 text-[12px] text-ink-300">
            Toegevoegd op {partner.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
            {user.lastLoginAt &&
              ` · laatste login ${user.lastLoginAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`}
            {user.status === "INVITED" && " · uitnodiging nog niet geaccepteerd"}
          </p>
        </div>
        <span className="rounded-full bg-cream-100 px-3 py-1 text-[11px] font-bold text-ink-700">
          {partner.status}
        </span>
      </div>

      {/* Statistieken */}
      <div className="mt-6 grid gap-3.5 sm:grid-cols-4">
        {[
          { label: "Clicks", value: clickStats.clicks },
          { label: "Unieke bezoekers", value: clickStats.uniek },
          { label: "Demo-aanvragen", value: leads.length },
          { label: "Conversie", value: `${conversie}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Referral-link */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
          Persoonlijke link
        </p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-brand">
          {referralLink}
        </p>
      </div>

      {/* Beloning & klantvoordelen */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Beloning
          </p>
          <p className="mt-1 text-lg font-extrabold text-ink">
            {euro(partner.commissionCents)}{" "}
            <span className="text-[13px] font-semibold text-ink-500">per verkochte website</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Voordeel voor de nieuwe klant
          </p>
          {partner.newCustomerPerks.length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-300">Geen voordelen ingesteld.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {partner.newCustomerPerks.map((perk) => (
                <li key={perk} className="text-[13px] font-semibold text-ink-700">
                  ✓ {perk}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Beheeracties */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Beheer</h2>
        <PartnerAdminActions
          partnerId={partner.id}
          currentStatus={partner.status}
          currentCode={partner.referralCode}
          accountActief={user.status === "ACTIVE"}
        />
      </div>

      {/* Gekoppelde aanvragen */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="mb-3 text-sm font-extrabold text-ink">
          Gekoppelde aanvragen ({leads.length})
        </h2>
        {leads.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-300">
            Nog geen aanvragen via deze partner
          </p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {leads.map((l) => (
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
                      {l.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                      {l.attributionModel === "MANUAL" && " · handmatig toegewezen"}
                    </span>
                  </span>
                  <LeadStatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Interne notitie + activiteit */}
      {partner.notitie && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Interne notitie</h2>
          <p className="whitespace-pre-line text-[13px] text-ink-500">{partner.notitie}</p>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Activiteit</h2>
        {activity.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-ink-300">Nog geen activiteit</p>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-[13px]">
                <span className="w-28 shrink-0 text-[11px] text-ink-300">
                  {a.createdAt.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="rounded-md bg-cream-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-700">
                  {a.action}
                </span>
                {a.reason && <span className="text-ink-300">— {a.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
