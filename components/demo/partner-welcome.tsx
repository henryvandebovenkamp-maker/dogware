import { GlyphCheck } from "./illustrations";

/**
 * Persoonlijke introductie voor bezoekers die via een partnerlink binnenkomen.
 * Warm en menselijk — geen kortingsbanner. Toont wie je heeft uitgenodigd
 * (met foto of nette initialen) en welke voordelen voor je klaarstaan.
 */
export function PartnerWelcome({
  perks,
  partnerName,
  firstName,
  avatarUrl,
}: {
  perks: string[];
  /** Weergavenaam van de partner (bedrijfsnaam of volledige naam) */
  partnerName?: string | null;
  /** Voornaam voor een persoonlijke aanhef */
  firstName?: string | null;
  avatarUrl?: string | null;
}) {
  const naam = partnerName?.trim() || "een DogWare-partner";
  const voornaam = firstName?.trim() || partnerName?.trim() || null;
  const initialen = initials(partnerName || firstName);

  return (
    <div className="mx-auto mb-10 max-w-2xl rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-8">
      <div className="flex items-start gap-4">
        {/* Foto of nette initialen — nooit een kapotte afbeelding */}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={naam}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-brand-50"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-extrabold text-brand">
            {initialen}
          </span>
        )}

        <div>
          <span className="text-[13px] font-semibold text-sage-600">
            Je bent persoonlijk uitgenodigd
          </span>
          <h2 className="mt-1 text-balance text-xl font-extrabold tracking-tight text-ink sm:text-[1.55rem]">
            {partnerName
              ? `${naam} nodigt je uit voor DogWare`
              : "Welkom! Je bent doorverwezen door een DogWare-partner"}
          </h2>
        </div>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed text-ink-500">
        Wat leuk dat {voornaam ? <span className="font-semibold text-ink">{voornaam}</span> : "iemand"} je heeft
        uitgenodigd om kennis te maken met DogWare. Omdat je via {voornaam ?? "deze partner"} bij ons
        terechtkomt, staan er twee dingen voor je klaar:
      </p>

      {perks.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-white">
                <GlyphCheck className="h-3.5 w-3.5" />
              </span>
              <span className="text-[15px] font-semibold text-ink">{perk}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-[14px] leading-relaxed text-ink-500">
        Vul hieronder rustig iets over je bedrijf in, dan maak ik met alle tijd
        een persoonlijk voorbeeld voor je. Vrijblijvend en zonder verplichtingen.
      </p>
    </div>
  );
}

/** Nette initialen (max 2 letters) uit een naam. */
function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
