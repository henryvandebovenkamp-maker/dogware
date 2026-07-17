import { requirePartner } from "@/lib/auth/session";
import {
  PARTNER_STATUS_LABELS,
  getPartnerForUser,
  getPartnerLeads,
} from "@/lib/partner-data";

export const metadata = { title: "Aanvragen" };

export default async function PartnerLeadsPage() {
  const user = await requirePartner();
  const partner = await getPartnerForUser(user.id);
  const leads = partner ? await getPartnerLeads(partner.id) : [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Aanvragen</h1>
      <p className="mt-1 text-sm text-ink-500">
        Demo-aanvragen die via jouw persoonlijke link zijn binnengekomen. Je
        volgt hier de status; de opvolging doet DogWare.
      </p>

      {leads.length === 0 ? (
        <p className="mt-12 text-center text-sm text-ink-300">
          Nog geen aanvragen via jouw link.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {leads.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-extrabold text-ink">
                  {l.bedrijfsnaam}
                </span>
                <span className="block text-[12px] text-ink-300">
                  {l.plaats} ·{" "}
                  {l.createdAt.toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · bron: jouw link ({l.referralCodeSnapshot})
                </span>
              </span>
              <span className="rounded-full bg-cream-100 px-3 py-1 text-[11px] font-bold text-ink-700">
                {PARTNER_STATUS_LABELS[l.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
