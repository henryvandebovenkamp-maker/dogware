import { cn } from "@/lib/cn";
import type { AfspraakOverzicht } from "@/lib/betaalafspraak";

/*
 * "Zo ziet de klant het" uit de voorstel-editor, als losse component: puur
 * presentatie van een `AfspraakOverzicht`, zonder state of server-acties.
 */

const ABONNEMENT_START: Record<string, string> = {
  "na-oplevering": "Start na oplevering",
  "na-laatste-betaling": "Start na de laatste betaling",
  "eerste-volgende-maand": "Start op de 1e van de volgende maand",
  handmatig: "Start op een vaste datum",
};

/**
 * De betaalafspraak zoals de klant hem te zien krijgt. Welke kaarten er staan
 * volgt uit de gekozen regeling; alle bedragen komen uit `afspraakOverzicht`.
 * Het maandabonnement is een aparte afspraak en staat altijd los ernaast.
 */
export function KlantPreview({
  m,
  startRule,
  direct,
}: {
  m: AfspraakOverzicht;
  startRule: string;
  direct: boolean;
}) {
  const r = m.regeling;
  const eerste = r.termijnen[0];
  const laatste = r.termijnen[r.termijnen.length - 1];
  const laatsteAfwijkend = r.soort === "termijnen" && laatste.inclVat !== eerste.inclVat;

  return (
    <>
      <dl className="mt-4 space-y-1.5 text-[14px]">
        {m.heeftKorting && (
          <>
            <Regel label="Subtotaal excl. btw" value={m.subtotal} />
            <Regel label="Korting" value={`− ${m.discount}`} />
          </>
        )}
        <Regel label="Eenmalige investering" value={`${m.net} excl. btw`} sterk />
        <Regel label={`Btw ${m.vatPercent}%`} value={m.vat} />
        <Regel label="Totaal" value={`${m.total} incl. btw`} sterk />
        <Regel label="Betaalregeling" value={r.soort === "termijnen" ? `${r.aantal} maandelijkse termijnen` : r.titel} />
      </dl>

      {m.regelingFout && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-600">
          {m.regelingFout}
        </p>
      )}

      <div className={cn("mt-4 grid gap-2.5", r.soort === "50-50" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {r.soort === "50-50" && (
          <>
            <Bedrag
              label={`Betaling bij start (${m.depositPercent}%)`}
              value={eerste.inclVat}
              sub="incl. btw · na ondertekening"
              tint="brand"
            />
            <Bedrag
              label={`Betaling bij oplevering (${m.finalPercent}%)`}
              value={laatste.inclVat}
              sub="incl. btw · vóór livegang"
              tint="brand"
            />
          </>
        )}
        {r.soort === "volledig" && (
          <Bedrag label="Eenmalige betaling" value={m.total} sub="incl. btw · na ondertekening" tint="brand" />
        )}
        {r.soort === "termijnen" && (
          <Bedrag
            label={`Betaling in ${r.aantal} termijnen`}
            value={`${eerste.inclVat} per termijn`}
            sub={`incl. btw · eerste termijn ${
              r.eersteBetaling === "Na ondertekening" ? "bij ondertekening" : `op ${r.eersteBetaling}`
            }, daarna maandelijks${laatsteAfwijkend ? ` · laatste termijn ${laatste.inclVat}` : ""}`}
            tint="brand"
          />
        )}
        <Bedrag
          label={direct ? "DogWare maandabonnement" : "DogWare abonnement"}
          value={`${m.monthlyExVat} p/m`}
          sub={`excl. btw · ${ABONNEMENT_START[startRule] ?? "Apart maandelijks"} · los van de eenmalige investering`}
          tint="sage"
        />
      </div>

      {r.soort === "termijnen" && (
        <div className="mt-2.5 rounded-xl bg-white p-3.5 ring-1 ring-ink/5">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-300">Termijnschema</p>
          <ol className="mt-1.5 divide-y divide-cream-100">
            {r.termijnen.map((t) => (
              <li
                key={t.volgnummer}
                className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-[12.5px]"
              >
                <span className="text-ink-700">
                  <span className="font-bold tabular-nums">
                    {t.volgnummer} van {t.aantal}
                  </span>{" "}
                  <span className="text-ink-300">· {t.wanneer}</span>
                </span>
                <span className="tabular-nums">
                  <span className="font-extrabold text-brand">{t.inclVat}</span>{" "}
                  <span className="text-ink-300">incl. btw · {t.exVat} excl.</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-1.5 flex justify-between border-t border-cream-200 pt-1.5 text-[12.5px] font-bold text-ink">
            <span>Samen</span>
            <span className="tabular-nums">{m.total} incl. btw</span>
          </p>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- bouwstenen -- */

function Regel({ label, value, sterk }: { label: string; value: string; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-ink-500", sterk && "font-bold text-ink")}>{label}</dt>
      <dd className={cn("tabular-nums text-ink-700", sterk && "font-extrabold text-ink")}>{value}</dd>
    </div>
  );
}

function Bedrag({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  tint: "brand" | "sage";
}) {
  return (
    <div className="rounded-xl bg-white p-3.5 ring-1 ring-ink/5">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-300">{label}</p>
      <p
        className={cn(
          "mt-1 text-[17px] font-extrabold tabular-nums",
          tint === "brand" ? "text-brand" : "text-sage-600",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-ink-300">{sub}</p>}
    </div>
  );
}
