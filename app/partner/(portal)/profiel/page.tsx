import { requirePartner } from "@/lib/auth/session";
import { getPartnerForUser } from "@/lib/partner-data";

export const metadata = { title: "Profiel" };

function Rij({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-[13px] font-semibold text-ink-500">{label}</dt>
      <dd className="text-right text-[13px] font-bold text-ink">
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}

export default async function ProfielPage() {
  const user = await requirePartner();
  const partner = await getPartnerForUser(user.id);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Profiel</h1>
      <p className="mt-1 text-sm text-ink-500">
        Jouw gegevens zoals bekend bij DogWare. Klopt er iets niet? Laat het ons
        weten, dan passen we het aan.
      </p>

      <dl className="mt-6 divide-y divide-cream-100 rounded-2xl bg-white px-5 py-2 shadow-soft ring-1 ring-ink/5">
        <Rij label="Naam" value={user.naam} />
        <Rij label="E-mailadres" value={user.email} />
        <Rij label="Bedrijf" value={partner?.bedrijfsnaam} />
        <Rij label="Telefoon" value={partner?.telefoon} />
        <Rij label="Website" value={partner?.website} />
        <Rij label="Referralcode" value={partner?.referralCode} />
        <Rij
          label="Partner sinds"
          value={partner?.activatedAt?.toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
      </dl>

      <p className="mt-5 text-[13px] text-ink-300">
        DogWare is volledig wachtwoordloos: je logt altijd in met een veilige
        link of eenmalige code per e-mail.
      </p>
    </div>
  );
}
