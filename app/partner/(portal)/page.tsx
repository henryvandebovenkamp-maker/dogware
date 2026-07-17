import Link from "next/link";
import { requirePartner } from "@/lib/auth/session";
import { branding } from "@/lib/branding";
import {
  PARTNER_STATUS_LABELS,
  getPartnerForUser,
  getPartnerLeads,
  getPartnerStats,
} from "@/lib/partner-data";
import { ShareLink } from "@/components/partner/share-link";

export const metadata = { title: "Partneroverzicht" };

export default async function PartnerDashboard() {
  const user = await requirePartner();
  const partner = await getPartnerForUser(user.id);

  if (!partner) {
    return (
      <p className="py-16 text-center text-sm text-ink-500">
        Je partnerprofiel wordt nog ingericht. Neem contact op met DogWare.
      </p>
    );
  }

  const [stats, leads] = await Promise.all([
    getPartnerStats(partner.id),
    getPartnerLeads(partner.id),
  ]);
  const link = `${branding.siteUrl}/p/${partner.referralCode}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Welkom, {user.naam.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Deel je persoonlijke link en volg hier wat het oplevert.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            partner.status === "ACTIVE"
              ? "bg-sage-100 text-sage-600"
              : "bg-cream-200 text-ink-500"
          }`}
        >
          {partner.status === "ACTIVE"
            ? "Actieve partner"
            : partner.status === "PAUSED"
              ? "Tijdelijk gepauzeerd"
              : partner.status}
        </span>
      </div>

      {partner.status === "PAUSED" && (
        <p className="mt-4 rounded-2xl bg-gold/10 px-4 py-3 text-[13px] font-semibold text-ink-700">
          Je partnerschap is tijdelijk gepauzeerd — nieuwe aanvragen via je link
          worden op dit moment niet aan je toegekend.
        </p>
      )}

      {/* Persoonlijke link — het hart van de pagina */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-7">
        <h2 className="text-[15px] font-extrabold text-ink">Jouw persoonlijke link</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Iedereen die hiermee een demo aanvraagt, wordt automatisch aan jou
          gekoppeld.
        </p>
        <div className="mt-4">
          <ShareLink link={link} />
        </div>
      </section>

      {/* Statistieken */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[
          { label: "Geldige clicks", value: stats.clicks },
          { label: "Unieke bezoekers", value: stats.uniek },
          { label: "Demo-aanvragen", value: stats.aanvragen },
          { label: "Conversie", value: `${stats.conversie}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recente aanvragen */}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-ink">Recente aanvragen</h2>
          <Link
            href="/partner/aanvragen"
            className="text-[12px] font-semibold text-brand hover:text-brand-600"
          >
            alles →
          </Link>
        </div>
        {leads.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-300">
            Nog geen aanvragen — deel je link en hier verschijnt het resultaat.
          </p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-ink">
                    {l.bedrijfsnaam}
                  </span>
                  <span className="block text-[11px] text-ink-300">
                    {l.createdAt.toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · via jouw link
                  </span>
                </span>
                <span className="rounded-full bg-cream-100 px-2.5 py-1 text-[10px] font-bold text-ink-700">
                  {PARTNER_STATUS_LABELS[l.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
