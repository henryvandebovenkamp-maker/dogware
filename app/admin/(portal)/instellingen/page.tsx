import { ATTRIBUTION_DAYS, ATTRIBUTION_MODEL } from "@/lib/referral";

export const metadata = { title: "Instellingen" };

export default function InstellingenPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Instellingen</h1>
      <p className="mt-1 text-sm text-ink-500">
        Actieve systeeminstellingen. Beheer via environment variables.
      </p>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <h2 className="text-sm font-extrabold text-ink">Partnerprogramma</h2>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Attributiemodel</dt>
              <dd className="font-mono font-semibold text-ink">{ATTRIBUTION_MODEL}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Attributieperiode</dt>
              <dd className="font-semibold text-ink">
                {ATTRIBUTION_DAYS} dagen{" "}
                <span className="font-normal text-ink-300">(ATTRIBUTION_DAYS)</span>
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <h2 className="text-sm font-extrabold text-ink">Toekomstige instellingen</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            Commissiepercentages, uitbetalingen en partnerlevels worden in een
            volgende fase ingericht.
          </p>
        </div>
      </div>
    </div>
  );
}
