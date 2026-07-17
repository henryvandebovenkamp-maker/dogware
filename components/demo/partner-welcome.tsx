import { GlyphCheck, GlyphPaw } from "./illustrations";

/**
 * Warm welkom voor bezoekers die via een partner binnenkomen.
 * Uitnodigend, niet commercieel — "er wordt tijd voor je genomen".
 */
export function PartnerWelcome({ perks }: { perks: string[] }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-ink/5">
      <div className="h-1.5 bg-gradient-to-r from-brand to-sage" />
      <div className="p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3.5 py-1.5 text-[12px] font-bold text-sage-600">
          <GlyphPaw className="h-3.5 w-3.5" />
          Je bent persoonlijk uitgenodigd
        </span>
        <h2 className="mt-4 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-[1.7rem]">
          Welkom! Je bent doorverwezen door een DogWare-partner.
        </h2>

        {perks.length > 0 && (
          <>
            <p className="mt-3 text-[15px] text-ink-500">Speciaal voor jou staat klaar:</p>
            <ul className="mt-3 space-y-2">
              {perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-white">
                    <GlyphCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[15px] font-semibold text-ink">{perk}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-5 text-[14px] leading-relaxed text-ink-500">
          Vul hieronder rustig iets over je bedrijf in. Ik neem echt de tijd om
          een persoonlijk voorbeeld voor je te maken — geen standaard verhaal.
        </p>
      </div>
    </div>
  );
}
