"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Check, CloudOff, Loader2 } from "lucide-react";
import {
  saveCommerceConfig,
  saveProposalDraft,
  sendProposal,
  sendProposalProof,
  type CommerceState,
} from "@/app/actions/commerce";
import { cn } from "@/lib/cn";
import {
  afspraakOverzicht,
  leesAfspraak,
  type AfspraakInvoer,
  type AfspraakOverzicht,
} from "@/lib/betaalafspraak";
import { KlantPreview } from "@/components/commerce/klant-preview";
import type { CommercialConfig } from "@/lib/money";
import { INSTALLMENT_PRESETS, MAX_INSTALLMENTS, MIN_INSTALLMENTS } from "@/lib/payment-plan";

const IDLE: CommerceState = { status: "idle" };

export type EditorData = {
  leadId: string;
  /** Directe klant (zonder demo): het stuk heet opdrachtbevestiging. */
  direct?: boolean;
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
    paymentPlan: string;
    installmentCount: string;
    installmentStart: string;
    installmentStartDate: string;
  };
  /** De OPGESLAGEN afspraak, server-side berekend — wat bij versturen bevroren wordt. */
  opgeslagen: AfspraakOverzicht;
  /** Velden die de eenmalige berekening niet raken, maar de afspraak wel compleet maken. */
  basis: Pick<CommercialConfig, "freeMonths" | "introDiscountPercent" | "introDiscountMonths">;
  eerderVerstuurd: number;
  /** Waar een proef heen gaat — uit de centrale mailconfiguratie. */
  proefNaar: string;
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
  const [proefState, proefAction, proefPending] = useActionState(sendProposalProof, IDLE);
  const [startRule, setStartRule] = useState(data.config.startRule);

  /*
   * De financiële velden zijn gecontroleerd, zodat "Zo ziet de klant het" bij
   * elke wijziging meteen meebeweegt. De preview rekent met exact dezelfde
   * functies als de server (lib/betaalafspraak.ts) — geen tweede berekening.
   * Opslaan en versturen rekenen daarna opnieuw, op de server.
   */
  const [fin, setFin] = useState<AfspraakInvoer>(() => invoerVan(data.config));
  const zet = (k: keyof AfspraakInvoer) => (v: string) => setFin((f) => ({ ...f, [k]: v }));
  // Na opslaan komt de afspraak vers van de server: dan toont het formulier
  // wat er werkelijk is opgeslagen (bijv. een afgekapt aantal termijnen).
  // Alleen bij een ÉCHTE wijziging, niet bij elke refresh door de autosave.
  const opgeslagenSleutel = JSON.stringify(data.config);
  const [vorigeSleutel, setVorigeSleutel] = useState(opgeslagenSleutel);
  if (vorigeSleutel !== opgeslagenSleutel) {
    setVorigeSleutel(opgeslagenSleutel);
    setFin(invoerVan(data.config));
    setStartRule(data.config.startRule);
  }
  const discountType = fin.discountType;
  const plan = fin.paymentPlan;
  const aantal = fin.installmentCount;
  const planStart = fin.installmentStart;

  const live = useMemo(() => {
    const { config, plan: p } = leesAfspraak(fin, data.basis);
    return afspraakOverzicht(config, p);
  }, [fin, data.basis]);
  // Wijkt het formulier af van wat er in de database staat? Vergeleken na
  // normaliseren, zodat "2500" en "2500.00" gewoon hetzelfde zijn.
  const gewijzigd = useMemo(
    () =>
      startRule !== data.config.startRule ||
      JSON.stringify(leesAfspraak(fin, data.basis)) !==
        JSON.stringify(leesAfspraak(invoerVan(data.config), data.basis)),
    [fin, startRule, data.config, data.basis],
  );

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
  const m = live;
  const direct = Boolean(data.direct);
  const voornaam = data.klant.naam.split(" ")[0] || data.klant.naam;
  // Een proef of verzending leest het BEWAARDE concept; tijdens het bewaren wachten we even.
  const conceptBezig = saveState === "saving";

  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/leads/${data.leadId}`}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
        >
          <ArrowLeft className="h-4 w-4" /> {direct ? "Terug naar de klant" : "Terug naar de aanvraag"}
        </Link>
        <SaveIndicator state={saveState} message={saveMsg} />
      </div>

      <header className="mt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {direct ? "Opdrachtbevestiging" : "Voorstel"} voor {data.klant.bedrijfsnaam}
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
          titel={direct ? "Wat gaan we bouwen?" : "Het voorstel"}
          uitleg={
            direct
              ? "Dit is wat de klant leest en ondertekent. Alles wordt automatisch bewaard."
              : "Dit is wat de klant leest. Alles wordt automatisch bewaard."
          }
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
          <Veld label={direct ? "Modules en functionaliteiten" : "Modules en diensten"} hint="Eén per regel.">
            <textarea
              value={content.modules}
              onChange={(e) => set("modules")(e.target.value)}
              rows={5}
              className={cn(inputKlas, "font-mono text-[13px]")}
              placeholder={"Website\nKlantenportaal\nOnline betalen"}
            />
          </Veld>
          <Veld
            label={direct ? "Bijzonderheden / afspraken op maat" : "Bijzonderheden en afwijkende afspraken"}
            hint="Komt letterlijk in de overeenkomst als hoofdstuk 'Aanvullende afspraken'."
          >
            <textarea
              value={content.bijzonderheden}
              onChange={(e) => set("bijzonderheden")(e.target.value)}
              rows={3}
              className={inputKlas}
            />
          </Veld>
          <Veld label={direct ? "Te ondertekenen vóór" : "Voorstel geldig tot"}>
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
          <Geld name="project" label="Projectbedrag (excl. btw)" value={fin.project} onChange={zet("project")} />
          <Geld name="setup" label="Opstartkosten (excl. btw)" value={fin.setup} onChange={zet("setup")} />
          <Getal name="vat" label="Btw %" value={fin.vat} onChange={zet("vat")} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Veld label="Korting">
            <select
              name="discountType"
              value={discountType}
              onChange={(e) => zet("discountType")(e.target.value)}
              className={inputKlas}
            >
              <option value="none">Geen korting</option>
              <option value="amount">Vast bedrag (€)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </Veld>
          {discountType === "percent" ? (
            <Getal name="discountValue" label="Kortingspercentage" value={fin.discountValue} onChange={zet("discountValue")} />
          ) : discountType === "amount" ? (
            <Geld name="discountValue" label="Kortingsbedrag" value={fin.discountValue} onChange={zet("discountValue")} />
          ) : (
            <input type="hidden" name="discountValue" value="0" />
          )}
        </div>

        {/* ------------------------------------------------ betaalregeling */}
        <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wide text-ink-300">
          Betaalregeling eenmalige investering
        </p>
        <fieldset>
          <legend className="sr-only">Betaalregeling</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["50-50", "Deel bij start, rest bij oplevering", "De standaard: aanbetaling en restbetaling."],
                ["volledig", "In één keer", "100% na ondertekening."],
                ["termijnen", "In termijnen", "Maandelijks, in een vast aantal termijnen."],
              ] as const
            ).map(([waarde, titel, uitleg]) => (
              <label
                key={waarde}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-xl border p-3 transition",
                  plan === waarde
                    ? "border-brand bg-brand-50 ring-2 ring-brand/15"
                    : "border-cream-200 bg-white hover:border-ink/20",
                )}
              >
                <input
                  type="radio"
                  name="paymentPlan"
                  value={waarde}
                  checked={plan === waarde}
                  onChange={() => zet("paymentPlan")(waarde)}
                  className="mt-0.5 accent-[var(--color-brand)]"
                />
                <span>
                  <span className="block text-[13px] font-bold text-ink">{titel}</span>
                  <span className="block text-[11.5px] leading-snug text-ink-500">{uitleg}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {plan === "50-50" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Getal
              name="depositPercent"
              label="Betaling bij start %"
              value={fin.depositPercent}
              onChange={zet("depositPercent")}
            />
            <p className="self-end text-[12px] text-ink-300 sm:col-span-2">
              De betaling bij oplevering is altijd het restant — die hoef je niet apart in te vullen.
            </p>
          </div>
        ) : (
          // Niet zichtbaar, wel bewaard: terug naar 50/50 geeft het eerdere percentage terug.
          <input type="hidden" name="depositPercent" value={fin.depositPercent} />
        )}

        {plan === "termijnen" && (
          <div className="mt-3 space-y-3 rounded-xl bg-cream-100/60 p-3.5">
            <div>
              <span className="text-[12.5px] font-bold text-ink-700">Aantal termijnen</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {INSTALLMENT_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => zet("installmentCount")(String(n))}
                    className={cn(
                      "min-w-[44px] rounded-full px-3 py-1.5 text-[13px] font-bold transition",
                      aantal === String(n)
                        ? "bg-ink text-cream"
                        : "bg-white text-ink-700 ring-1 ring-ink/10 hover:bg-cream",
                    )}
                  >
                    {n}
                  </button>
                ))}
                <label className="ml-1 inline-flex items-center gap-1.5 text-[12px] text-ink-500">
                  of
                  <input
                    name="installmentCount"
                    type="number"
                    min={MIN_INSTALLMENTS}
                    max={MAX_INSTALLMENTS}
                    step={1}
                    value={aantal}
                    onChange={(e) => zet("installmentCount")(e.target.value)}
                    className="w-20 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
                    aria-label="Aangepast aantal termijnen"
                  />
                </label>
              </div>
            </div>
            <div>
              <span className="text-[12.5px] font-bold text-ink-700">Start van het schema</span>
              <div className="mt-1.5 space-y-1.5">
                <label className="flex items-start gap-2 text-[13px] text-ink-700">
                  <input
                    type="radio"
                    name="installmentStart"
                    value="bij-akkoord"
                    checked={planStart !== "datum"}
                    onChange={() => zet("installmentStart")("bij-akkoord")}
                    className="mt-0.5 accent-[var(--color-brand)]"
                  />
                  Eerste termijn bij ondertekening, daarna elke kalendermaand
                </label>
                <label className="flex flex-wrap items-center gap-2 text-[13px] text-ink-700">
                  <input
                    type="radio"
                    name="installmentStart"
                    value="datum"
                    checked={planStart === "datum"}
                    onChange={() => zet("installmentStart")("datum")}
                    className="accent-[var(--color-brand)]"
                  />
                  Vaste startdatum
                  {planStart === "datum" && (
                    <input
                      type="date"
                      name="installmentStartDate"
                      value={fin.installmentStartDate}
                      onChange={(e) => zet("installmentStartDate")(e.target.value)}
                      required
                      className="rounded-lg border border-cream-200 bg-white px-2.5 py-1 text-[13px] text-ink outline-none focus:border-brand"
                    />
                  )}
                </label>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
                {planStart === "datum"
                  ? "Eerste termijn op de gekozen datum, daarna iedere maand."
                  : "Eerste termijn bij ondertekening, daarna iedere maand."}{" "}
                De bouw start zodra de eerste termijn is betaald.
              </p>
            </div>
          </div>
        )}

        <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wide text-ink-300">
          {direct ? "DogWare maandabonnement" : "Maandabonnement"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Geld name="monthly" label="Maandbedrag (excl. btw)" value={fin.monthly} onChange={zet("monthly")} />
          <Getal name="freeMonths" label="Gratis maanden" def={c.freeMonths} />
          <Veld label={direct ? "Startmoment abonnement" : "Abonnement start"}>
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
          {gewijzigd && !cfgPending && (
            <span className="text-[12px] font-semibold text-brand-600">Nog niet opgeslagen</span>
          )}
          {cfgState.message && !gewijzigd && (
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
        <SectieKop
          titel="Zo ziet de klant het"
          uitleg={
            gewijzigd
              ? "Voorbeeld van je wijzigingen — nog niet opgeslagen. De klant krijgt pas deze afspraak na 'Bedragen opslaan'."
              : "De opgeslagen afspraak, precies zoals hij verstuurd wordt."
          }
        />
        <KlantPreview m={m} startRule={startRule} direct={direct} />
      </section>

      {/* ----------------------------------------------------------- versturen */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        {gewijzigd && (
          <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-600">
            Je hebt de bedragen of de betaalregeling gewijzigd maar nog niet opgeslagen. Sla ze eerst
            op — een proef en de definitieve versie tonen altijd wat er is opgeslagen.
          </p>
        )}

        {/* Eerst controleren: een proef naar Henry, niets naar de klant. */}
        <form action={proefAction} className="rounded-xl bg-cream-100/70 p-4 ring-1 ring-ink/5">
          <input type="hidden" name="leadId" value={data.leadId} />
          <SectieKop
            titel="Eerst controleren"
            uitleg={`Stuur een proef naar jezelf om de e-mail en ${direct ? "de opdrachtbevestiging" : "het voorstel"} te bekijken zoals ${voornaam} ze straks ontvangt. Er gaat niets naar de klant en er verandert niets aan de aanvraag.`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="submit"
              disabled={proefPending || gewijzigd || conceptBezig}
              className="w-full rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink ring-1 ring-ink/15 transition hover:bg-cream disabled:opacity-60 sm:w-auto"
            >
              {proefPending ? "Proef wordt verstuurd…" : "Stuur proef naar mezelf"}
            </button>
            <span className="text-[12px] text-ink-500">
              {proefState.status === "success" && !proefPending ? (
                <span className="font-semibold text-sage-600">{proefState.message}</span>
              ) : proefState.status === "error" && !proefPending ? (
                <span className="font-semibold text-brand-600">{proefState.message}</span>
              ) : (
                <>
                  Proef wordt verstuurd naar <strong className="font-bold text-ink">{data.proefNaar}</strong>
                </>
              )}
            </span>
          </div>
          {conceptBezig && (
            <p className="mt-2 text-[11.5px] text-ink-300">Even wachten tot het concept bewaard is…</p>
          )}
        </form>

        <form action={sendAction} className="mt-5">
          <input type="hidden" name="leadId" value={data.leadId} />
          <SectieKop
            titel="Definitief versturen"
            uitleg={
              direct
                ? "Na versturen staat deze versie vast en staat de overeenkomst voor de klant klaar om digitaal te ondertekenen. De klant geeft akkoord door te tekenen — niet eerder."
                : "Na versturen staat deze versie vast. Wijzig je later iets, dan ontstaat er automatisch een nieuwe versie."
            }
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sendPending || gewijzigd || conceptBezig}
              className="w-full rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:-translate-y-px hover:bg-brand-600 disabled:opacity-60 sm:w-auto"
            >
              {sendPending ? "Versturen…" : `Definitief naar ${voornaam} versturen`}
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
          <p className="mt-2 text-[11.5px] text-ink-300">
            Gaat naar {data.klant.naam} · {data.klant.email}
          </p>
        </form>
      </section>
    </div>
  );
}

/** De opgeslagen afspraak als formulierinvoer. */
function invoerVan(c: EditorData["config"]): AfspraakInvoer {
  return {
    project: c.project,
    setup: c.setup,
    discountType: c.discountType,
    discountValue: c.discountValue,
    vat: c.vat,
    depositPercent: c.depositPercent,
    monthly: c.monthly,
    paymentPlan: c.paymentPlan,
    installmentCount: c.installmentCount,
    installmentStart: c.installmentStart,
    installmentStartDate: c.installmentStartDate,
  };
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

type Invoer = { name: string; label: string } & (
  | { def: string; value?: never; onChange?: never }
  | { def?: never; value: string; onChange: (v: string) => void }
);

function Geld({ name, label, def, value, onChange }: Invoer) {
  return (
    <Veld label={label}>
      <div className="flex items-center gap-1.5">
        <span className="text-ink-300">€</span>
        <input
          name={name}
          type="number"
          min={0}
          step="0.01"
          {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue: def })}
          className={inputKlas}
        />
      </div>
    </Veld>
  );
}

function Getal({ name, label, def, value, onChange }: Invoer) {
  return (
    <Veld label={label}>
      <input
        name={name}
        type="number"
        min={0}
        step={1}
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue: def })}
        className={inputKlas}
      />
    </Veld>
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
