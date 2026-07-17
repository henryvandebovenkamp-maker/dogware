import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const db = getDb();

  const clicks = db
    ? await db
        .select({
          click: schema.referralClicks,
          partner: schema.partners,
        })
        .from(schema.referralClicks)
        .innerJoin(schema.partners, eq(schema.referralClicks.partnerId, schema.partners.id))
        .orderBy(desc(schema.referralClicks.firstSeenAt))
        .limit(100)
    : [];

  const attributedLeads = db
    ? await db
        .select({
          id: schema.leads.id,
          referralClickId: schema.leads.referralClickId,
          bedrijfsnaam: schema.leads.bedrijfsnaam,
        })
        .from(schema.leads)
    : [];
  const leadByClick = new Map(
    attributedLeads.filter((l) => l.referralClickId).map((l) => [l.referralClickId, l]),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Referrals</h1>
      <p className="mt-1 text-sm text-ink-500">
        Alle geregistreerde bezoeken via partnerlinks — inclusief bot- en
        testverkeer, duidelijk gemarkeerd. Zo is altijd te herleiden waarom een
        aanvraag wel of niet is toegekend.
      </p>

      {!db && (
        <div className="mt-6 rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
          <strong>Database niet gekoppeld.</strong>
        </div>
      )}

      {db && clicks.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-300">
          Nog geen referralbezoeken geregistreerd.
        </p>
      )}

      {clicks.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-ink/5">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-cream-100 text-[11px] uppercase tracking-wide text-ink-300">
                <th className="px-4 py-3 font-semibold">Datum</th>
                <th className="px-4 py-3 font-semibold">Partner</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Landing</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Conversie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {clicks.map(({ click, partner }) => {
                const lead = leadByClick.get(click.id);
                return (
                  <tr key={click.id} className="text-ink-700">
                    <td className="px-4 py-2.5 text-[12px] text-ink-500">
                      {click.firstSeenAt.toLocaleString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="font-semibold text-ink hover:text-brand"
                      >
                        {partner.bedrijfsnaam}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-brand">
                      {click.referralCode}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-500">
                      {click.landingPage}
                    </td>
                    <td className="px-4 py-2.5">
                      {click.isBot ? (
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-bold text-ink-300">
                          bot
                        </span>
                      ) : click.isInternal ? (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                          test
                        </span>
                      ) : (
                        <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-bold text-sage-600">
                          geldig
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {lead ? (
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="text-[12px] font-semibold text-sage-600 hover:underline"
                        >
                          {lead.bedrijfsnaam} →
                        </Link>
                      ) : (
                        <span className="text-[12px] text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
