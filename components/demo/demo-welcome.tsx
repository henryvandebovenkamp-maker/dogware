import { GlyphCheck } from "./illustrations";
import { BrandMark } from "@/components/brand";

/**
 * Introductie voor de reguliere demo-aanvraag: iemand die zelf op
 * 'Demo aanvragen' klikt. Bewust neutraal — geen partnernaam, geen korting,
 * geen uitnodiging. Dezelfde kaartvorm als de partnerversie, zodat de wizard
 * eronder in beide routes identiek aanvoelt.
 */
const KRIJGT = [
  "Een voorbeeldwebsite in jouw stijl",
  "Een demo-omgeving met jouw diensten erin",
];

export function DemoWelcome() {
  return (
    <div className="mx-auto mb-10 max-w-2xl rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50">
          <BrandMark size={30} className="h-[30px] w-[30px]" />
        </span>

        <div>
          <span className="text-[13px] font-semibold text-sage-600">
            Kosteloos en vrijblijvend
          </span>
          <h2 className="mt-1 text-balance text-xl font-extrabold tracking-tight text-ink sm:text-[1.55rem]">
            Leuk dat je kennis wilt maken met DogWare
          </h2>
        </div>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed text-ink-500">
        Vertel hieronder iets over jouw bedrijf. Ik maak vervolgens persoonlijk
        een voorbeeldwebsite én een demo-omgeving, zodat je precies kunt zien
        hoe DogWare er voor jouw bedrijf uit kan zien.
      </p>

      <ul className="mt-4 space-y-2.5">
        {KRIJGT.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-white">
              <GlyphCheck className="h-3.5 w-3.5" />
            </span>
            <span className="text-[15px] font-semibold text-ink">{item}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[14px] leading-relaxed text-ink-500">
        Het invullen duurt zo&apos;n twee minuten. Je zit nergens aan vast en er
        komt geen verkoopgesprek achteraan.
      </p>
    </div>
  );
}
