"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Check, CloudOff, Loader2 } from "lucide-react";
import {
  saveCommerceConfig,
  saveProposalDraft,
  sendProposal,
  type CommerceState,
} from "@/app/actions/commerce";
import { cn } from "@/lib/cn";

const IDLE: CommerceState = { status: "idle" };

export type EditorData = {
  leadId: string;
  version: number;
  klant: { bedrijfsnaam: string; naam: string; email: string; plaats: string; telefoon: string | null };
  content: {
    titel: string;
    intro: string;
    omschrijving: string;
    werkzaamheden: string;
    modules: string;
    bijzonderheden: string;
    geldigTot: string;
  };
  config: {
    project: string;
    setup: string;
    discountType: string;
    discountValue: string;
    vat: string;
    depositPercent: string;
    monthly: string;
    freeMonths: string;
    introPercent: string;
    introMonths: string;
    startRule: string;
    startAt: string;
    opmerkingen: string;
  };
  computed: {
    subtotal: string;
    discount: string;
    net: string;
    vat: string;
    total: string;
    deposit: string;
    final: string;
    depositPercent: number;
    finalPercent: number;
    monthlyExVat: string;
    monthlyInclVat: string;
  };
  eerderVerstuurd: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * De voorstel-editor.
 *
 * De inhoud wordt automatisch als concept bewaard (debounced, plus een flush
 * bij het verlaten van de pagina): een half getypt voorstel mag nooit
 * verdwijnen door een refresh. De bedragen worden bewust NIET automatisch
 * opgeslagen — die zijn een commerciële beslissing en gaan via een expliciete
 * knop, waarna de server ze herberekent.
 */
export function ProposalEditor({ data }: { data: EditorData }) {
  const [content, setContent] = useState(data.content);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [cfgState, cfgAction, cfgPending] = useActionState(saveCommerceConfig, IDLE);
  const [sendState, sendAction, sendPending] = useActionState(sendProposal, IDLE);
  const [discountType, setDiscountType] = useState(data.config.discountType);
  const [startRule, setStartRule] = useState(data.config.startRule);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatsteOpslag = useRef(JSON.stringify(data.content));
  // De laatste waarde vasthouden buiten de render, zodat de flush bij
  // wegnavigeren altijd het meest recente concept wegschrijft.
  const huidig = useRef(content);
  useEffect(() => {
    huidig.current = content;
  }, [content]);

  const bewaar = useCallback(async () => {
    const payload = huidig.current;
    const serialised = JSON.stringify(payload);
    if (serialised === laatsteOpslag.current) return;
    setSaveState("saving");
    const res = await saveProposalDraft(data.leadId, {
      titel: payload.titel,
      intro: payload.intro,
      omschrijving: payload.omschrijving,
      werkzaamheden: payload.werkzaamheden.split("\n").map((r) => r.trim()).filter(Boolean),
      modules: payload.modules.split("\n").map((r) => r.trim()).filter(Boolean),
      bijzonderheden: payload.bijzonderheden,
      geldigTot: payload.geldigTot || null,
    });
    if (res.ok) {
      laatsteOpslag.current = serialised;
      setSaveState("saved");
      setSaveMsg(null);
    } else {
      setSaveState("error");
      setSaveMsg(res.message ?? "Opslaan lukte niet.");
    }
  }, [data.leadId]);

  // Debounced autosave bij elke wijziging.
  useEffect(() => {
    if (JSON.stringify(content) === laatsteOpslag.current) return;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void bewaar(), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, bewaar]);

  // Vangnet: bij wegnavigeren of tabwissel meteen wegschrijven.
  useEffect(() => {
    const flush = () => void bewaar();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [bewaar]);

  const set = (k: keyof EditorData["content"]) => (v: string) =>
    setContent((c) => ({ ...c, [k]: v }));

  const c = data.config;
  const m = data.computed;

  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/leads/${data.leadId}`}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar de aanvraag
        </Link>
        <SaveIndicator state={saveState} message={saveMsg} />
      </div>

      <header className="mt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          Voorstel voor {data.klant.bedrijfsnaam}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Versie {data.version}
          {data.eerderVerstuurd > 0 && (
            <> · er {data.eerderVerstuurd === 1 ? "is" : "zijn"} al {data.eerderVerstuurd} versie
              {data.eerderVerstuurd === 1 ? "" : "s"} verstuurd</>
          )}{" "}
          · {data.klant.naam} · {data.klant.email}
        </p>
      </header>

      {/* ---------------------------------------------------------- inhoud -- */}
      <section className="mt-7 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <SectieKop
          titel="Het voorstel"
          uitleg="Dit is wat de klant leest. Alles wordt automatisch bewaard."
        />
        <div className="mt-4 space-y-4">
          <Veld label="Titel">
            <input
              value={content.titel}
              onChange={(e) => set("titel")(e.target.value)}
              className={inputKlas}
              placeholder="Jouw nieuwe website met DogWare"
            />
          </Veld>
          <Veld label="Persoonlijke intro" hint="Één alinea. Spreek de klant aan zoals je zou bellen.">
            <textarea
              value={content.intro}
              onChange={(e) => set("intro")(e.target.value)}
              rows={4}
              className={inputKlas}
              placeholder="Hoi Miranda, wat leuk dat we samen aan de slag gaan…"
            />
          </Veld>
          <Veld label="Omschrijving van het project">
            <textarea
              value={content.omschrijving}
              onChange={(e) => set("omschrijving")(e.target.value)}
              rows={5}
              className={inputKlas}
              placeholder="Wat gaan we maken en waarom?"
            />
          </Veld>
          <Veld label="Werkzaamheden" hint="Eén per regel.">
            <textarea
              value={content.werkzaamheden}
              onChange={(e) => set("werkzaamheden")(e.target.value)}
              rows={6}
              className={cn(inputKlas, "font-mono text-[13px]")}
              placeholder={"Ontwerp en opbouw van de website\nInrichten van de agenda\nOverzetten van bestaande content"}
            />
          </Veld>
          <Veld label="Modules en diensten" hint="Eén per regel.">
            <textarea
              value={content.modules}
              onChange={(e) => set("modules")(e.target.value)}
              rows={5}
              className={cn(inputKlas, "font-mono text-[13px]")}
              placeholder={"Website\nKlantenportaal\nOnline betalen"}
            />
          </Veld>
          <Veld
            label="Bijzonderheden en afwijkende afspraken"
            hint="Komt letterlijk in de overeenkomst als hoofdstuk 'Aanvullende afspraken'."
          >
            <textarea
              value={content.bijzonderheden}
              onChange={(e) => set("bijzonderheden")(e.target.value)}
              rows={3}
              className={inputKlas}
            />
          </Veld>
          <Veld label="Voorstel geldig tot">
            <input
              type="date"
              value={content.geldigTot}
              onChange={(e) => set("geldigTot")(e.target.value)}
              className={cn(inputKlas, "max-w-[200px]")}
            />
          </Veld>
        </div>
      </section>

      {/* -------------------------------------------------------- financieel */}
      <form action={cfgAction} className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <input type="hidden" name="leadId" value={data.leadId} />
        <SectieKop
          titel="Financieel"
          uitleg="De bedragen worden altijd op de server herberekend. Sla ze op om het overzicht bij te werken."
        />

        <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-300">
          Eenmalige investering
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Geld name="project" label="Projectbedrag (excl. btw)" def={c.project} />
          <Geld name="setup" label="Opstartkosten (excl. btw)" def={c.setup} />
          <Getal name="vat" label="Btw %" def={c.vat} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Veld label="Korting">
            <select
              name="discountType"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              className={inputKlas}
            >
              <option value="none">Geen korting</option>
              <option value="amount">Vast bedrag (€)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </Veld>
          {discountType === "percent" ? (
            <Getal name="discountValue" label="Kortingspercentage" def={c.discountValue} />
          ) : (
            <Geld name="discountValue" label="Kortingsbedrag" def={c.discountValue} />
          )}
          <Getal name="depositPercent" label="Eerste termijn %" def={c.depositPercent} />
        </div>
        <p className="mt-2 text-[12px] text-ink-300">
          De tweede termijn is altijd het restant — die hoef je niet apart in te vullen.
        </p>

        <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wide text-ink-300">
          Maandabonnement
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Geld name="monthly" label="Maandbedrag (excl. btw)" def={c.monthly} />
          <Getal name="freeMonths" label="Gratis maanden" def={c.freeMonths} />
          <Veld label="Abonnement start">
            <select
              name="startRule"
              value={startRule}
              onChange={(e) => setStartRule(e.target.value)}
              className={inputKlas}
            >
              <option value="na-oplevering">Na oplevering</option>
              <option value="na-laatste-betaling">Na de laatste betaling</option>
              <option value="eerste-volgende-maand">1e van de volgende maand</option>
              <option value="handmatig">Op een vaste datum</option>
            </select>
          </Veld>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Getal name="introPercent" label="Introkorting %" def={c.introPercent} />
          <Getal name="introMonths" label="Introkorting maanden" def={c.introMonths} />
          {startRule === "handmatig" && (
            <Veld label="Startdatum abonnement">
              <input type="date" name="startAt" defaultValue={c.startAt} className={inputKlas} />
            </Veld>
          )}
        </div>
        <Veld label="Interne opmerking bij de afspraak" hint="Niet zichtbaar voor de klant.">
          <textarea name="opmerkingen" defaultValue={c.opmerkingen} rows={2} className={cn(inputKlas, "mt-3")} />
        </Veld>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={cfgPending}
            className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-60"
          >
            {cfgPending ? "Opslaan…" : "Bedragen opslaan"}
          </button>
          {cfgState.message && (
            <span
              className={cn(
                "text-[12px] font-semibold",
                cfgState.status === "error" ? "text-brand-600" : "text-sage-600",
              )}
            >
              {cfgState.message}
            </span>
          )}
        </div>
      </form>

      {/* --------------------------------------------------------- overzicht */}
      <section className="mt-6 rounded-2xl bg-cream-100/60 p-5 ring-1 ring-ink/5 sm:p-6">
        <SectieKop titel="Zo ziet de klant het" uitleg="Server-berekend, op basis van de opgeslagen bedragen." />
        <dl className="mt-4 space-y-1.5 text-[14px]">
          <Regel label="Subtotaal" value={m.subtotal} />
          {m.discount !== "€ 0,00" && <Regel label="Korting" value={`− ${m.discount}`} />}
          <Regel label="Netto excl. btw" value={m.net} sterk />
          <Regel label={`Btw ${c.vat}%`} value={m.vat} />
          <Regel label="Totaal incl. btw" value={m.total} sterk />
        </dl>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <Bedrag label={`Betaling bij start (${m.depositPercent}%)`} value={m.deposit} tint="brand" />
          <Bedrag label={`Betaling bij oplevering (${m.finalPercent}%)`} value={m.final} tint="brand" />
          <Bedrag label="DogWare abonnement" value={`${m.monthlyExVat} p/m`} sub="excl. btw" tint="sage" />
        </div>
      </section>

      {/* ----------------------------------------------------------- versturen */}
      <form
        action={sendAction}
        className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6"
      >
        <input type="hidden" name="leadId" value={data.leadId} />
        <SectieKop
          titel="Definitief versturen"
          uitleg="Na versturen staat deze versie vast. Wijzig je later iets, dan ontstaat er automatisch een nieuwe versie."
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={sendPending}
            className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:-translate-y-px hover:bg-brand-600 disabled:opacity-60"
          >
            {sendPending ? "Versturen…" : `Voorstel versturen naar ${data.klant.email}`}
          </button>
          {sendState.message && (
            <span
              className={cn(
                "text-[12px] font-semibold",
                sendState.status === "error" ? "text-brand-600" : "text-sage-600",
              )}
            >
              {sendState.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------- bouwstenen -- */

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

function Veld({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-bold text-ink-700">{label}</span>
      {hint && <span className="mt-0.5 block text-[11.5px] text-ink-300">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Geld({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <Veld label={label}>
      <div className="flex items-center gap-1.5">
        <span className="text-ink-300">€</span>
        <input name={name} type="number" min={0} step="0.01" defaultValue={def} className={inputKlas} />
      </div>
    </Veld>
  );
}

function Getal({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <Veld label={label}>
      <input name={name} type="number" min={0} step={1} defaultValue={def} className={inputKlas} />
    </Veld>
  );
}

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
