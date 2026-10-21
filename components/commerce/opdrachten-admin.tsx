"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Loader2, Plus } from "lucide-react";
import {
  bewaarOpdracht,
  bewaarOpdrachtNotitie,
  nieuweOpdracht,
  opdrachtActie,
  stuurOpdrachtProef,
  trekOpdrachtInActie,
  verlengOpdrachtActie,
  type OpdrachtActie,
} from "@/app/actions/opdrachten";
import type { ExtraOrderStatus } from "@/lib/db/schema";
import { cn } from "@/lib/cn";
import { euroFromCents } from "@/lib/money";
import {
  OPDRACHT_STAPPEN,
  OPDRACHT_STATUS_LABEL,
  berekenOpdracht,
  euroNaarCenten,
  maandInclBtw,
  stapIndex,
} from "@/lib/opdrachten/bedragen";

/* ----------------------------------------------------------- nieuw -------- */

export function NieuweOpdrachtKnop({ leadId, klein }: { leadId: string; klein?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFout(null);
            const r = await nieuweOpdracht(leadId);
            if (r.status === "success" && r.id) router.push(`/admin/leads/${leadId}/opdrachten/${r.id}`);
            else setFout(r.message ?? "Er ging iets mis.");
          })
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-ink font-bold text-cream transition hover:bg-ink-700 disabled:opacity-50",
          klein ? "px-3.5 py-1.5 text-[12.5px]" : "px-4 py-2 text-[13px]",
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Nieuwe opdracht
      </button>
      {fout && <p className="mt-1.5 text-[12px] font-semibold text-brand-600">{fout}</p>}
    </div>
  );
}

/* -------------------------------------------------------- voortgang ------- */

export function OpdrachtVoortgang({ status, compact }: { status: ExtraOrderStatus; compact?: boolean }) {
  if (status === "INGETROKKEN") {
    return <p className="text-[12px] font-semibold text-ink-300">Ingetrokken</p>;
  }
  const huidig = stapIndex(status);
  return (
    <ol className={cn("flex w-full gap-1", compact ? "" : "mt-1")} aria-label="Voortgang">
      {OPDRACHT_STAPPEN.map((s, i) => (
        <li key={s.status} className="min-w-0 flex-1">
          <span
            className={cn(
              "block h-1.5 rounded-full",
              i < huidig ? "bg-sage" : i === huidig ? "bg-brand" : "bg-cream-200",
            )}
          />
          {!compact && (
            <span
              className={cn(
                "mt-1.5 hidden text-[10.5px] leading-tight sm:block",
                i === huidig ? "font-bold text-ink" : "text-ink-300",
              )}
            >
              {s.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function StatusPil({ status, verlopen }: { status: ExtraOrderStatus; verlopen?: boolean }) {
  const label = verlopen ? "Verlopen" : OPDRACHT_STATUS_LABEL[status];
  const toon =
    status === "AFGEROND"
      ? "bg-sage/15 text-sage-600"
      : status === "INGETROKKEN" || verlopen
        ? "bg-cream-200 text-ink-500"
        : status === "CONCEPT"
          ? "bg-cream-100 text-ink-500 ring-1 ring-ink/5"
          : "bg-[#2f6bed]/10 text-[#2f6bed]";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", toon)}>{label}</span>;
}

/* ----------------------------------------------------------- editor ------- */

export type ConceptWaarden = {
  titel: string;
  omschrijving: string;
  werkzaamheden: string;
  prijs: string;
  maandDelta: string;
  maandIngang: "oplevering" | "datum";
  maandIngangDatum: string;
  verwachteOplevering: string;
  geldigTot: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Het conceptformulier. Alles wordt automatisch bewaard (debounced, plus een
 * flush bij wegnavigeren), net als de voorstel-editor. Het overzicht van de
 * bedragen rekent met dezelfde functie als de server; bij versturen rekent de
 * server opnieuw en legt die uitkomst vast.
 */
export function OpdrachtEditor({
  leadId,
  orderId,
  begin,
  vatPercent,
  huidigMaandCents,
  proefNaar,
  ontbreekt,
}: {
  leadId: string;
  orderId: string;
  begin: ConceptWaarden;
  vatPercent: number;
  huidigMaandCents: number;
  proefNaar: string;
  ontbreekt: string[];
}) {
  const router = useRouter();
  const [w, setW] = useState(begin);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [pending, start] = useTransition();

  const huidig = useRef(w);
  const laatste = useRef(JSON.stringify(begin));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    huidig.current = w;
  }, [w]);

  const bewaar = useCallback(async (): Promise<boolean> => {
    const payload = huidig.current;
    const ser = JSON.stringify(payload);
    if (ser === laatste.current) return true;
    setSaveState("saving");
    const r = await bewaarOpdracht(leadId, orderId, payload);
    if (r.status === "success") {
      laatste.current = ser;
      setSaveState("saved");
      setSaveMsg(null);
      return true;
    }
    setSaveState("error");
    setSaveMsg(r.message ?? "Opslaan lukte niet.");
    return false;
  }, [leadId, orderId]);

  useEffect(() => {
    if (JSON.stringify(w) === laatste.current) return;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void bewaar(), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [w, bewaar]);

  useEffect(() => {
    const flush = () => void bewaar();
    const onVis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [bewaar]);

  const zet = (k: keyof ConceptWaarden) => (v: string) => setW((x) => ({ ...x, [k]: v }));

  const prijsCent = euroNaarCenten(w.prijs) ?? 0;
  const deltaCent = euroNaarCenten(w.maandDelta) ?? 0;
  const b = useMemo(() => berekenOpdracht({ priceExVatCents: Math.max(0, prijsCent), vatPercent }), [prijsCent, vatPercent]);
  const nieuweMaand = huidigMaandCents + deltaCent;

  function verstuur(proef: boolean) {
    setMelding(null);
    start(async () => {
      // Eerst het laatste concept wegschrijven: versturen leest wat er bewaard is.
      if (timer.current) clearTimeout(timer.current);
      if (!(await bewaar())) return;
      const r = proef ? await stuurOpdrachtProef(leadId, orderId) : await opdrachtActie(leadId, orderId, "versturen");
      setMelding({ ok: r.status === "success", tekst: r.message ?? "" });
      if (r.status === "success" && !proef) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SaveIndicator state={saveState} message={saveMsg} />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <SectieKop titel="Wat gaan we bouwen?" uitleg="Dit leest de klant. Alles wordt automatisch als concept bewaard." />
        <div className="mt-4 space-y-4">
          <Veld label="Titel">
            <input value={w.titel} onChange={(e) => zet("titel")(e.target.value)} className={inputKlas} placeholder="Module Workshops" maxLength={160} />
          </Veld>
          <Veld label="Omschrijving van de uitbreiding">
            <textarea value={w.omschrijving} onChange={(e) => zet("omschrijving")(e.target.value)} rows={4} className={inputKlas} placeholder="Wat voegen we toe, en wat levert het de klant op?" />
          </Veld>
          <Veld label="Werkzaamheden en opleverpunten" hint="Eén per regel.">
            <textarea
              value={w.werkzaamheden}
              onChange={(e) => zet("werkzaamheden")(e.target.value)}
              rows={5}
              className={cn(inputKlas, "font-mono text-[13px]")}
              placeholder={"Workshoppagina's met datum en plaatsen\nOnline inschrijven en betalen\nDeelnemerslijst in het beheer"}
            />
          </Veld>
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld label="Verwachte oplevering" hint="Optioneel.">
              <input type="date" value={w.verwachteOplevering} onChange={(e) => zet("verwachteOplevering")(e.target.value)} className={inputKlas} />
            </Veld>
            <Veld label="Voorstel geldig tot en met">
              <input type="date" value={w.geldigTot} onChange={(e) => zet("geldigTot")(e.target.value)} className={inputKlas} />
            </Veld>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <SectieKop titel="Prijs en abonnement" uitleg="Bij versturen rekent de server alles opnieuw en legt de bedragen vast." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Veld label="Eenmalige prijs (excl. btw)">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-300">€</span>
              <input inputMode="decimal" value={w.prijs} onChange={(e) => zet("prijs")(e.target.value)} className={inputKlas} placeholder="1250" />
            </div>
          </Veld>
          <Veld label="Wijziging maandbedrag (excl. btw)" hint="Leeg of 0 = geen wijziging. Een verlaging met een min: -10.">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-300">€</span>
              <input inputMode="decimal" value={w.maandDelta} onChange={(e) => zet("maandDelta")(e.target.value)} className={inputKlas} placeholder="0" />
              <span className="shrink-0 text-[12px] text-ink-300">p/m</span>
            </div>
          </Veld>
        </div>

        {deltaCent !== 0 && (
          <div className="mt-4 rounded-xl bg-cream-100/60 p-3.5">
            <p className="text-[12.5px] font-bold text-ink-700">Wanneer gaat het nieuwe maandbedrag in?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["oplevering", "Bij oplevering"],
                  ["datum", "Op een vaste datum"],
                ] as const
              ).map(([v, l]) => (
                <label
                  key={v}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                    w.maandIngang === v ? "border-brand bg-brand-50 text-ink" : "border-cream-200 bg-white text-ink-500",
                  )}
                >
                  <input type="radio" name="maandIngang" checked={w.maandIngang === v} onChange={() => zet("maandIngang")(v)} className="accent-[var(--color-brand)]" />
                  {l}
                </label>
              ))}
              {w.maandIngang === "datum" && (
                <input type="date" value={w.maandIngangDatum} onChange={(e) => zet("maandIngangDatum")(e.target.value)} className={cn(inputKlas, "max-w-[190px] py-1.5")} />
              )}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              Nu {euroFromCents(huidigMaandCents)} → straks{" "}
              <strong className="text-ink">{euroFromCents(nieuweMaand)}</strong> excl. btw (
              {euroFromCents(maandInclBtw(nieuweMaand, vatPercent))} incl.). Het bestaande abonnement wordt aangepast; er komt
              geen tweede bij. De wijziging gaat pas in na de aanbetaling.
            </p>
          </div>
        )}

        <dl className="mt-5 space-y-1.5 border-t border-cream-100 pt-4 text-[13.5px]">
          <Rij label="Prijs excl. btw" value={euroFromCents(b.exVatCents)} />
          <Rij label={`Btw ${b.vatPercent}%`} value={euroFromCents(b.vatCents)} />
          <Rij label="Totaal incl. btw" value={euroFromCents(b.inclVatCents)} sterk />
          <Rij label={`Aanbetaling bij akkoord (${b.aanbetaling.percent}%)`} value={euroFromCents(b.aanbetaling.inclVatCents)} />
          <Rij label={`Eindbetaling bij oplevering (${b.eindbetaling.percent}%)`} value={euroFromCents(b.eindbetaling.inclVatCents)} />
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <SectieKop titel="Versturen" />
        {ontbreekt.length > 0 && saveState === "idle" && (
          <p className="mt-2 text-[12.5px] text-ink-500">
            Nog nodig om te versturen: {ontbreekt.join(", ")}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={pending || saveState === "saving"}
            onClick={() => verstuur(false)}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-white shadow-glow transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Verstuur naar de klant
          </button>
          <button
            type="button"
            disabled={pending || saveState === "saving"}
            onClick={() => verstuur(true)}
            className="rounded-full px-4 py-2.5 text-[13px] font-bold text-ink-500 ring-1 ring-ink/10 transition hover:bg-cream disabled:opacity-50"
          >
            Proefmail naar {proefNaar}
          </button>
        </div>
        {melding && <Melding {...melding} />}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------- acties ------- */

const KNOPPEN: Partial<Record<ExtraOrderStatus, { actie: OpdrachtActie; label: string; primair?: boolean }[]>> = {
  VERZONDEN: [
    { actie: "herinneren", label: "Herinnering sturen" },
    { actie: "aanpassen", label: "Aanpassen (nieuwe versie)" },
  ],
  AKKOORD: [{ actie: "herinneren", label: "Herinner aan aanbetaling" }],
  AANBETAALD: [{ actie: "start-bouw", label: "Start de bouw", primair: true }],
  IN_UITVOERING: [{ actie: "opleveren", label: "Opleveren & eindbetaling vrijgeven", primair: true }],
  OPGELEVERD: [{ actie: "herinneren", label: "Herinner aan eindbetaling" }],
  EINDBETAALD: [{ actie: "afronden", label: "Afronden", primair: true }],
};

export function OpdrachtActies({
  leadId,
  orderId,
  status,
  verlopen,
  geldigTotDag,
  vandaag,
  intrekbaar,
}: {
  leadId: string;
  orderId: string;
  status: ExtraOrderStatus;
  verlopen: boolean;
  geldigTotDag: string | null;
  vandaag: string;
  intrekbaar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [datum, setDatum] = useState(geldigTotDag && geldigTotDag >= vandaag ? geldigTotDag : vandaag);
  const [reden, setReden] = useState("");
  const [intrekOpen, setIntrekOpen] = useState(false);

  const doe = (fn: () => Promise<{ status: string; message?: string }>) =>
    start(async () => {
      setMelding(null);
      const r = await fn();
      setMelding({ ok: r.status === "success", tekst: r.message ?? "" });
      if (r.status === "success") router.refresh();
    });

  const knoppen = (KNOPPEN[status] ?? []).filter((k) => !(verlopen && k.actie === "herinneren"));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {knoppen.map((k) => (
          <button
            key={k.actie}
            type="button"
            disabled={pending}
            onClick={() => doe(() => opdrachtActie(leadId, orderId, k.actie))}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-bold transition disabled:opacity-50",
              k.primair ? "bg-brand text-white shadow-glow hover:bg-brand-600" : "text-ink-700 ring-1 ring-ink/10 hover:bg-cream",
            )}
          >
            {k.label}
          </button>
        ))}
        {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-300" />}
      </div>

      {status === "VERZONDEN" && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-cream-100 pt-4">
          <label className="block">
            <span className="text-[12px] font-bold text-ink-700">{verlopen ? "Verlengen tot en met" : "Geldig tot en met"}</span>
            <input type="date" min={vandaag} value={datum} onChange={(e) => setDatum(e.target.value)} className={cn(inputKlas, "mt-1 max-w-[190px] py-1.5")} />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => doe(() => verlengOpdrachtActie(leadId, orderId, datum))}
            className="rounded-full px-4 py-2 text-[13px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream disabled:opacity-50"
          >
            Geldigheid aanpassen
          </button>
        </div>
      )}

      {intrekbaar && (
        <div className="mt-4 border-t border-cream-100 pt-3">
          {intrekOpen ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block min-w-[220px] flex-1">
                <span className="text-[12px] font-bold text-ink-700">Reden (intern)</span>
                <input value={reden} onChange={(e) => setReden(e.target.value)} className={cn(inputKlas, "mt-1 py-1.5")} />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() => doe(() => trekOpdrachtInActie(leadId, orderId, reden))}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-cream disabled:opacity-50"
              >
                Definitief intrekken
              </button>
              <button type="button" onClick={() => setIntrekOpen(false)} className="px-2 py-2 text-[12.5px] font-semibold text-ink-300">
                Annuleren
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setIntrekOpen(true)} className="text-[12.5px] font-semibold text-ink-300 hover:text-ink-500">
              Opdracht intrekken…
            </button>
          )}
        </div>
      )}

      {melding && <Melding {...melding} />}
    </div>
  );
}

/* ---------------------------------------------------------- notitie ------- */

export function InterneNotitie({ leadId, orderId, begin }: { leadId: string; orderId: string; begin: string }) {
  const [tekst, setTekst] = useState(begin);
  const [pending, start] = useTransition();
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  return (
    <div>
      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={3}
        className={inputKlas}
        placeholder="Alleen zichtbaar voor beheerders. Nooit in de klantomgeving of in een mail."
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || tekst === begin}
          onClick={() =>
            start(async () => {
              const r = await bewaarOpdrachtNotitie(leadId, orderId, tekst);
              setMelding({ ok: r.status === "success", tekst: r.message ?? "" });
            })
          }
          className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream disabled:opacity-40"
        >
          Notitie bewaren
        </button>
        {melding && <span className={cn("text-[12px] font-semibold", melding.ok ? "text-sage-600" : "text-brand-600")}>{melding.tekst}</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- bouwstenen ------ */

const inputKlas =
  "w-full rounded-xl border border-cream-200 bg-white px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

function SectieKop({ titel, uitleg }: { titel: string; uitleg?: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-extrabold text-ink">{titel}</h2>
      {uitleg && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-300">{uitleg}</p>}
    </div>
  );
}

function Veld({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-bold text-ink-700">{label}</span>
      {hint && <span className="mt-0.5 block text-[11.5px] text-ink-300">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Rij({ label, value, sterk }: { label: string; value: string; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-ink-500", sterk && "font-bold text-ink")}>{label}</dt>
      <dd className={cn("tabular-nums text-ink-700", sterk && "font-extrabold text-ink")}>{value}</dd>
    </div>
  );
}

function Melding({ ok, tekst }: { ok: boolean; tekst: string }) {
  if (!tekst) return null;
  return (
    <p
      className={cn(
        "mt-3 rounded-xl px-4 py-2.5 text-[13px] font-semibold",
        ok ? "bg-sage/10 text-sage-600" : "bg-brand-50 text-brand-600",
      )}
    >
      {tekst}
    </p>
  );
}

function SaveIndicator({ state, message }: { state: SaveState; message: string | null }) {
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-600">
        <CloudOff className="h-3.5 w-3.5" /> {message ?? "Niet opgeslagen"}
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Bewaren…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-sage-600">
        <Check className="h-3.5 w-3.5" /> Concept bewaard
      </span>
    );
  }
  return <span className="text-[12px] text-ink-300">Wijzigingen worden automatisch bewaard</span>;
}
