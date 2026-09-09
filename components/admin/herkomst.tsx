import Link from "next/link";
import { COMMISSIE_FASE_LABEL, type CommissieFase } from "@/lib/commissie";
import type { Utm } from "@/lib/db/schema";

/**
 * Waar deze aanvraag vandaan komt.
 *
 * Compact en in gewone taal, op de plek waar de beheerder de aanvraag toch al
 * openslaat — geen apart analyticsscherm. Alles wat hier staat komt uit de
 * lead-rij zelf: de vastgelegde herkomst, niet de cookie van de bezoeker.
 *
 * De partnerkoppeling (wie de commissie toekomt) en de marketingherkomst (via
 * welke campagne iemand kwam) staan bewust onder elkaar en niet door elkaar:
 * alleen de eerste gaat over geld.
 */

export type HerkomstProps = {
  partner: { id: string; naam: string } | null;
  referralCode: string | null;
  /** Zichtbaar wanneer de aanbrenger een andere partner is dan de eerste link */
  eersteAanraking: { id: string; naam: string } | null;
  laatsteAanraking: { id: string; naam: string } | null;
  eersteBezoekAt: Date | null;
  landingPage: string | null;
  verwijzer: string | null;
  utm: Utm | null;
  /** Waarlangs de aanvraag binnenkwam: website, affiliate, referral, handmatig */
  bron: string;
  handmatigToegewezen: boolean;
  commissie: CommissieFase;
};

const DATUM: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

function Rij({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-cream-200 py-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-ink-300">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[14px] font-semibold text-ink sm:text-right">
        {children}
      </dd>
    </div>
  );
}

export function Herkomst({
  partner,
  referralCode,
  eersteAanraking,
  laatsteAanraking,
  eersteBezoekAt,
  landingPage,
  verwijzer,
  utm,
  bron,
  handmatigToegewezen,
  commissie,
}: HerkomstProps) {
  // Een organische aanvraag zonder enige marketingherkomst verdient geen
  // half leeg blok: dan is één regel eerlijker dan zes streepjes.
  const heeftMarketing = Boolean(landingPage || verwijzer || utm);
  if (!partner && !heeftMarketing) {
    return (
      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-300">
          Herkomst
        </h2>
        <div className="rounded-2xl bg-white p-5 text-[14px] text-ink-500 shadow-soft ring-1 ring-ink/5">
          Rechtstreeks binnengekomen via de website — geen partner en geen
          campagne.
        </div>
      </section>
    );
  }

  // Alleen tonen wanneer de aanbreng ergens anders vandaan komt dan de partner
  // die de commissie krijgt; anders is het ruis.
  const toonAanrakingen =
    (eersteAanraking && eersteAanraking.id !== partner?.id) ||
    (laatsteAanraking && laatsteAanraking.id !== partner?.id);

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-300">
        Herkomst
      </h2>
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <dl>
          <Rij label="Partner">
            {partner ? (
              <Link
                href={`/admin/partners/${partner.id}`}
                className="text-brand hover:underline"
              >
                {partner.naam}
              </Link>
            ) : (
              <span className="text-ink-300">Geen — organische aanvraag</span>
            )}
          </Rij>

          {referralCode && (
            <Rij label="Referralcode">
              <span className="font-mono text-[13px]">{referralCode}</span>
            </Rij>
          )}

          {toonAanrakingen && (
            <>
              <Rij label="Eerste bezoek via">
                {eersteAanraking ? (
                  <Link
                    href={`/admin/partners/${eersteAanraking.id}`}
                    className="text-brand hover:underline"
                  >
                    {eersteAanraking.naam}
                  </Link>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </Rij>
              <Rij label="Laatste bezoek via">
                {laatsteAanraking ? (
                  <Link
                    href={`/admin/partners/${laatsteAanraking.id}`}
                    className="text-brand hover:underline"
                  >
                    {laatsteAanraking.naam}
                  </Link>
                ) : (
                  <span className="text-ink-300">—</span>
                )}
              </Rij>
            </>
          )}

          {eersteBezoekAt && (
            <Rij label="Eerste bezoek">
              {eersteBezoekAt.toLocaleDateString("nl-NL", DATUM)}
            </Rij>
          )}
          {landingPage && (
            <Rij label="Landingspagina">
              <span className="font-mono text-[13px]">{landingPage}</span>
            </Rij>
          )}
          {verwijzer && (
            <Rij label="Kwam van">
              <span className="break-all font-mono text-[13px]">{verwijzer}</span>
            </Rij>
          )}
          {utm?.utm_source && <Rij label="Bron">{utm.utm_source}</Rij>}
          {utm?.utm_medium && <Rij label="Medium">{utm.utm_medium}</Rij>}
          {utm?.utm_campaign && <Rij label="Campagne">{utm.utm_campaign}</Rij>}
          {utm?.utm_content && <Rij label="Content">{utm.utm_content}</Rij>}
          {utm?.utm_term && <Rij label="Zoekterm">{utm.utm_term}</Rij>}

          <Rij label="Conversie">Demo-aanvraag ({bron})</Rij>
          <Rij label="Commissie">
            {COMMISSIE_FASE_LABEL[commissie]}
            {handmatigToegewezen && (
              <span className="ml-1.5 font-normal text-ink-300">
                · handmatig toegewezen
              </span>
            )}
          </Rij>
        </dl>
      </div>
    </section>
  );
}
