"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, FileText, Loader2 } from "lucide-react";
import { accepteerOpdrachtActie, betaalOpdrachtActie } from "@/app/actions/opdrachten";
import type { ExtraOrderStatus } from "@/lib/db/schema";
import { BrandMark } from "@/components/brand";
import { legalFooterLine } from "@/lib/legal-entity";
import { cn } from "@/lib/cn";

export type OpdrachtKlantData = {
  token: string;
  orderId: string;
  bedrijfsnaam: string;
  voornaam: string;
  volgnummer: number;
  status: ExtraOrderStatus;
  /** De versie waarop de klant akkoord geeft. */
  versie: number;
  verlopen: boolean;
  /** Wordt aangepast: de vorige versie is vervangen, de nieuwe komt nog. */
  wordtAangepast: boolean;
  /** Proefweergave voor de beheerder: elke klantknop is uitgeschakeld. */
  proef: boolean;
  mollieKlaar: boolean;
  inhoud: {
    titel: string;
    omschrijving: string | null;
    werkzaamheden: string[];
    verwachteOplevering: string | null;
    geldigTot: string | null;
  };
  bedragen: {
    ex: string;
    btw: string;
    btwPercent: number;
    incl: string;
    aanbetaling: string;
    aanbetalingPercent: number;
    eindbetaling: string;
    eindbetalingPercent: number;
  };
  /** Null als het maandbedrag niet verandert. */
  maand: { zin: string; naarEx: string; naarIncl: string; vanEx: string; wanneer: string } | null;
  akkoord: { naam: string; op: string; versie: number } | null;
  /** De laatste poging per termijn. */
  betalingen: { aanbetaling: string | null; eindbetaling: string | null };
  /** Uitkomst na terugkeer uit Mollie, alleen als de klant net terugkomt. */
  terugUitMollie: "betaald" | "mislukt" | "wacht" | null;
  facturen: { nummer: string; titel: string; bedrag: string }[];
};

const KLANT_STAPPEN: { label: string; vanaf: ExtraOrderStatus[] }[] = [
  { label: "Akkoord", vanaf: ["AKKOORD", "AANBETAALD", "IN_UITVOERING", "OPGELEVERD", "EINDBETAALD", "AFGEROND"] },
  { label: "Aanbetaling", vanaf: ["AANBETAALD", "IN_UITVOERING", "OPGELEVERD", "EINDBETAALD", "AFGEROND"] },
  { label: "Bouwen", vanaf: ["IN_UITVOERING", "OPGELEVERD", "EINDBETAALD", "AFGEROND"] },
  { label: "Oplevering", vanaf: ["OPGELEVERD", "EINDBETAALD", "AFGEROND"] },
  { label: "Afgerond", vanaf: ["EINDBETAALD", "AFGEROND"] },
];

/**
 * Eén aanvullende opdracht in de klantomgeving. Dezelfde opbouw als de
 * hoofdpagina: eerst wat er van de klant gevraagd wordt (hooguit één knop),
 * dan wat we bouwen en wat het kost. Mobiel-first.
 */
export function OpdrachtKlantView({ d }: { d: OpdrachtKlantData }) {
  return (
    <div className="min-h-screen bg-cream">
      {d.proef && (
        <div className="sticky top-0 z-20 bg-ink px-5 py-2.5 text-center text-cream">
          <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em]">Proefweergave</p>
          <p className="text-[12px] text-cream/75">Zo ziet de klant het. Akkoord geven en betalen zijn hier uitgeschakeld.</p>
        </div>
      )}
      <header className="border-b border-cream-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
          <BrandMark size={34} className="h-[34px] w-[34px]" />
          <span className="text-[13px] font-bold text-ink-500">{d.bedrijfsnaam}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-20 pt-6 sm:pt-10">
        <a
          href={`/traject/${d.token}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
        >
          <ArrowLeft className="h-4 w-4" /> Naar je overzicht
        </a>
        <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-300">
          Aanvullende opdracht
        </p>
        <h1 className="mt-1 text-balance text-[28px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[34px]">
          {d.inhoud.titel}
        </h1>
        <p className="mt-2 text-[15px] text-ink-500">
          Hoi {d.voornaam} — je website blijft gewoon online. Dit is een uitbreiding erop.
        </p>

        {d.status !== "VERZONDEN" && d.status !== "INGETROKKEN" && !d.wordtAangepast && (
          <ol className="mt-6 grid grid-cols-5 gap-1.5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            {KLANT_STAPPEN.map((s) => {
              const klaar = s.vanaf.includes(d.status);
              return (
                <li key={s.label} className="min-w-0">
                  <span className={cn("block h-1.5 rounded-full", klaar ? "bg-sage" : "bg-cream-200")} />
                  <span className={cn("mt-1.5 block truncate text-[10.5px] sm:text-[11.5px]", klaar ? "font-bold text-ink" : "text-ink-300")}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <Terugkeer uitkomst={d.terugUitMollie} />
        <VolgendeStap d={d} />

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-7">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-300">Wat ik ga bouwen</h2>
          {d.inhoud.omschrijving && (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{d.inhoud.omschrijving}</p>
          )}
          <ul className="mt-4 space-y-2">
            {d.inhoud.werkzaamheden.map((w) => (
              <li key={w} className="flex gap-2.5">
                <Check className="mt-[3px] h-4 w-4 shrink-0 text-sage" />
                <span className="text-[14.5px] leading-relaxed text-ink-700">{w}</span>
              </li>
            ))}
          </ul>
          {d.inhoud.verwachteOplevering && (
            <p className="mt-4 text-[13.5px] text-ink-500">
              Verwachte oplevering: <strong className="text-ink">{d.inhoud.verwachteOplevering}</strong>
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-7">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-300">De afspraak</h2>
          <dl className="mt-3 space-y-1.5 text-[14.5px]">
            <Rij label="Prijs excl. btw" value={d.bedragen.ex} />
            <Rij label={`Btw ${d.bedragen.btwPercent}%`} value={d.bedragen.btw} />
            <Rij label="Totaal incl. btw" value={d.bedragen.incl} sterk />
          </dl>
          <dl className="mt-4 space-y-1.5 border-t border-cream-100 pt-4 text-[14px]">
            <Rij label={`Eerste betaling bij akkoord (${d.bedragen.aanbetalingPercent}%)`} value={d.bedragen.aanbetaling} />
            <Rij label={`Tweede betaling bij oplevering (${d.bedragen.eindbetalingPercent}%)`} value={d.bedragen.eindbetaling} />
          </dl>
          <div className="mt-4 rounded-xl bg-cream-100/70 px-4 py-3 text-[13.5px] leading-relaxed text-ink-700">
            <p className="font-bold text-ink">Je maandelijkse kosten</p>
            <p className="mt-0.5">{d.maand ? d.maand.zin : "Je maandbedrag blijft hetzelfde."}</p>
          </div>
          {d.inhoud.geldigTot && d.status === "VERZONDEN" && (
            <p className="mt-3 text-[12.5px] text-ink-300">Dit voorstel is geldig tot en met {d.inhoud.geldigTot}.</p>
          )}
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-300">
            Een korte opdrachtbevestiging, geen nieuwe overeenkomst: de afspraken en voorwaarden die we al hebben,
            blijven gewoon gelden.
          </p>
        </section>

        {d.facturen.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-300">Facturen van deze opdracht</h2>
            <ul className="mt-3 space-y-2">
              {d.facturen.map((f) => (
                <li key={f.nummer}>
                  <a
                    href={`/traject/${d.token}/factuur/${f.nummer}`}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-ink-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{f.titel}</span>
                      <span className="block font-mono text-[11px] text-ink-300">{f.nummer}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">{f.bedrag}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-14 border-t border-cream-200 pt-6">
          <p className="text-[11.5px] leading-relaxed text-ink-300">
            Vragen? Bel of mail Henry — je krijgt gewoon een mens aan de lijn.
            <br />
            {legalFooterLine()}
          </p>
        </footer>
      </main>
    </div>
  );
}

function VolgendeStap({ d }: { d: OpdrachtKlantData }) {
  const [pending, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [opdrachtOk, setOpdrachtOk] = useState(false);
  const [maandOk, setMaandOk] = useState(false);

  function accepteer() {
    if (d.proef) return;
    setFout(null);
    start(async () => {
      const r = await accepteerOpdrachtActie(d.token, d.orderId, {
        versie: d.versie,
        naam,
        agreesOpdracht: opdrachtOk,
        agreesMaandbedrag: maandOk,
      });
      if (r.status === "error") setFout(r.message ?? "Er ging iets mis.");
      else window.location.reload();
    });
  }

  function betaal(soort: "aanbetaling" | "eindbetaling") {
    if (d.proef) return;
    setFout(null);
    start(async () => {
      const r = await betaalOpdrachtActie(d.token, d.orderId, soort);
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
      else setFout(r.message ?? "Betalen lukt nu even niet.");
    });
  }

  if (d.status === "INGETROKKEN") {
    return (
      <Kaart>
        <Kop>Deze opdracht is ingetrokken</Kop>
        <Tekst>Er staat voor deze opdracht niets meer open. Vragen? Laat het me gerust weten.</Tekst>
      </Kaart>
    );
  }

  if (d.wordtAangepast) {
    return (
      <Kaart>
        <Kop>Ik pas deze opdracht nog even aan</Kop>
        <Tekst>Je ontvangt binnenkort de nieuwe versie. Je hoeft nu even niets te doen.</Tekst>
      </Kaart>
    );
  }

  if (d.status === "VERZONDEN") {
    if (d.verlopen) {
      return (
        <Kaart>
          <Kop>Dit voorstel is verlopen</Kop>
          <Tekst>Neem even contact met me op, dan zet ik hem graag opnieuw voor je klaar.</Tekst>
        </Kaart>
      );
    }
    const klaar = naam.trim().length >= 2 && opdrachtOk && (!d.maand || maandOk);
    return (
      <Kaart tint="brand">
        <Kop>Klopt alles? Geef dan akkoord</Kop>
        <Tekst>Daarna vraag ik de eerste betaling van {d.bedragen.aanbetaling}, en begin ik zodra die binnen is.</Tekst>
        <div className="mt-5 space-y-3">
          <Vinkje checked={opdrachtOk} onChange={setOpdrachtOk}>
            Ik geef opdracht voor <strong>{d.inhoud.titel}</strong> voor {d.bedragen.ex} excl. btw ({d.bedragen.incl} incl.
            btw), te betalen in twee delen: {d.bedragen.aanbetaling} bij akkoord en {d.bedragen.eindbetaling} bij oplevering.
          </Vinkje>
          {d.maand && (
            <Vinkje checked={maandOk} onChange={setMaandOk}>
              Ik ga akkoord met het nieuwe maandbedrag van <strong>{d.maand.naarEx} excl. btw</strong> ({d.maand.naarIncl}{" "}
              incl. btw, nu {d.maand.vanEx}), {d.maand.wanneer}. Mijn bestaande abonnement wordt hierop aangepast.
            </Vinkje>
          )}
          <label className="block">
            <span className="text-[13px] font-bold text-ink-700">Je naam</span>
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Voor- en achternaam"
            />
          </label>
        </div>
        <Primair onClick={accepteer} pending={pending} label="Akkoord geven" disabled={!klaar} proef={d.proef} />
        <Fout tekst={fout} />
      </Kaart>
    );
  }

  if (d.status === "AKKOORD") {
    return (
      <Kaart tint="brand">
        <Kop>Dank je wel voor je akkoord</Kop>
        {d.akkoord && (
          <p className="mt-2 text-[13px] text-ink-300">
            Akkoord gegeven door {d.akkoord.naam} op {d.akkoord.op} (versie {d.akkoord.versie}).
          </p>
        )}
        <Tekst>
          {d.betalingen.aanbetaling === "OPEN" || d.betalingen.aanbetaling === "PENDING"
            ? "Je betaling wordt nog verwerkt. Ben je halverwege gestopt? Dan kun je hem hieronder afmaken."
            : d.betalingen.aanbetaling && ["FAILED", "EXPIRED", "CANCELED"].includes(d.betalingen.aanbetaling)
              ? "Je vorige betaalpoging is niet gelukt. Er is niets afgeschreven — je kunt het gewoon opnieuw proberen."
              : `Om te starten vraag ik de eerste betaling van ${d.bedragen.aanbetaling}. Zodra die binnen is, plan ik de bouw in.`}
        </Tekst>
        {d.mollieKlaar ? (
          <Primair onClick={() => betaal("aanbetaling")} pending={pending} label={`Betaal aanbetaling (${d.bedragen.aanbetaling})`} proef={d.proef} />
        ) : (
          <p className="mt-3 text-[12.5px] text-ink-300">Betalen wordt zo geactiveerd — je hoort van me.</p>
        )}
        <Fout tekst={fout} />
      </Kaart>
    );
  }

  if (d.status === "AANBETAALD") {
    return (
      <Kaart tint="sage">
        <Kop>Aanbetaling ontvangen</Kop>
        <Tekst>Dank je wel! Ik plan de bouw in en laat het je weten zodra ik begin. Je hoeft nu niets te doen.</Tekst>
      </Kaart>
    );
  }

  if (d.status === "IN_UITVOERING") {
    return (
      <Kaart tint="sage">
        <Kop>Ik ben ermee bezig</Kop>
        <Tekst>
          Je website blijft gewoon online terwijl ik bouw.
          {d.inhoud.verwachteOplevering ? ` De verwachte oplevering is ${d.inhoud.verwachteOplevering}.` : ""} Je hoort van me
          zodra het klaar is.
        </Tekst>
      </Kaart>
    );
  }

  if (d.status === "OPGELEVERD") {
    return (
      <Kaart tint="brand">
        <Kop>Het is opgeleverd!</Kop>
        <Tekst>
          {d.betalingen.eindbetaling && ["FAILED", "EXPIRED", "CANCELED"].includes(d.betalingen.eindbetaling)
            ? "Je vorige betaalpoging is niet gelukt. Er is niets afgeschreven — probeer het gerust opnieuw."
            : `Om de opdracht af te ronden staat de tweede betaling van ${d.bedragen.eindbetaling} voor je klaar.`}
        </Tekst>
        {d.mollieKlaar ? (
          <Primair onClick={() => betaal("eindbetaling")} pending={pending} label={`Betaal eindbetaling (${d.bedragen.eindbetaling})`} proef={d.proef} />
        ) : (
          <p className="mt-3 text-[12.5px] text-ink-300">Betalen wordt zo geactiveerd — je hoort van me.</p>
        )}
        <Fout tekst={fout} />
      </Kaart>
    );
  }

  return (
    <Kaart tint="sage">
      <Kop>Helemaal afgerond 🐾</Kop>
      <Tekst>Alles is opgeleverd en betaald. Dank je wel! Je website en je abonnement lopen gewoon door.</Tekst>
    </Kaart>
  );
}

function Terugkeer({ uitkomst }: { uitkomst: OpdrachtKlantData["terugUitMollie"] }) {
  if (!uitkomst) return null;
  const tekst =
    uitkomst === "betaald"
      ? "Gelukt — je betaling is ontvangen. Dank je wel!"
      : uitkomst === "mislukt"
        ? "De betaling is niet doorgegaan. Er is niets afgeschreven; je kunt het hieronder opnieuw proberen."
        : "We wachten nog heel even op de bevestiging van je bank. Je hoeft niets te doen — ververs de pagina gerust over een minuutje.";
  return (
    <p
      className={cn(
        "mt-6 rounded-xl px-4 py-3 text-[13.5px] font-semibold",
        uitkomst === "betaald" ? "bg-sage/15 text-sage-600" : uitkomst === "mislukt" ? "bg-brand-50 text-brand-600" : "bg-white text-ink-500 ring-1 ring-ink/5",
      )}
    >
      {tekst}
    </p>
  );
}

/* -------------------------------------------------------------- bouwstenen */

function Kaart({ children, tint }: { children: React.ReactNode; tint?: "brand" | "sage" }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink/5">
      <div className={cn("h-1.5", tint === "sage" ? "bg-sage" : tint === "brand" ? "bg-gradient-to-r from-brand to-brand-400" : "bg-cream-200")} />
      <div className="p-6 sm:p-7">{children}</div>
    </div>
  );
}

function Kop({ children }: { children: React.ReactNode }) {
  return <h2 className="text-balance text-xl font-extrabold tracking-tight text-ink sm:text-[24px]">{children}</h2>;
}

function Tekst({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-pretty text-[15px] leading-relaxed text-ink-500">{children}</p>;
}

function Rij({ label, value, sterk }: { label: string; value: string; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-ink-500", sterk && "font-bold text-ink")}>{label}</dt>
      <dd className={cn("shrink-0 tabular-nums text-ink-700", sterk && "font-extrabold text-ink")}>{value}</dd>
    </div>
  );
}

function Vinkje({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl bg-cream-100/70 p-3.5 text-[14px] leading-relaxed text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
      />
      <span>{children}</span>
    </label>
  );
}

function Primair({
  onClick,
  pending,
  label,
  disabled,
  proef,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
  disabled?: boolean;
  proef: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={proef ? undefined : onClick}
        disabled={pending || disabled || proef}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-[15px] font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Een moment…" : label}
      </button>
      {proef && (
        <p className="mt-2 text-[12px] font-semibold text-ink-300">Uitgeschakeld in de proefweergave — de klant kan hier wel op klikken.</p>
      )}
    </>
  );
}

function Fout({ tekst }: { tekst: string | null }) {
  if (!tekst) return null;
  return <p className="mt-3 rounded-xl bg-brand-50 px-4 py-2.5 text-[13px] font-semibold text-brand-600">{tekst}</p>;
}
