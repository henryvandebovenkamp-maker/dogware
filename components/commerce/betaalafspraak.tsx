import { Check, Clock, Receipt } from "lucide-react";
import type { SchemaWeergave, TermijnRij } from "@/lib/payment-schedule";
import type { RegelingLabels } from "@/lib/proposals";
import type { TermijnStatus } from "@/lib/payment-plan";
import { cn } from "@/lib/cn";

/**
 * De betaalafspraak, zoals klant en beheerder hem zien.
 *
 * Eén set bouwstenen voor beide kanten, zodat ze nooit iets anders beweren.
 * Bewust geen boekhoudtabel: op een telefoon is een termijn een regel met een
 * bedrag, een datum en een status — meer niet. De beheerder ziet daarnaast
 * factuur en Mollie-status, de klant niet.
 *
 * Puur presentatie: alle bedragen en statussen komen kant-en-klaar van de
 * server (lib/payment-schedule.ts, lib/proposals.ts).
 */

/* ----------------------------------------------------------- status-pil -- */

const PIL: Record<TermijnStatus, string> = {
  betaald: "bg-sage-100 text-sage-600",
  "te-betalen": "bg-brand-100 text-brand-600",
  mislukt: "bg-brand-100 text-brand-600",
  "te-laat": "bg-brand-600 text-white",
  gepland: "bg-cream-200 text-ink-500",
  "wacht-op-oplevering": "bg-cream-200 text-ink-500",
  geannuleerd: "bg-cream-200 text-ink-300 line-through",
};

export function TermijnPil({ status, label }: { status: TermijnStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        PIL[status],
      )}
    >
      {status === "betaald" && <Check className="h-3 w-3" />}
      {label}
    </span>
  );
}

/* ------------------------------------------------------- voortgangsbalk -- */

export function Voortgangsbalk({ betaald, aantal }: { betaald: number; aantal: number }) {
  return (
    <div
      className="flex gap-1"
      role="img"
      aria-label={`${betaald} van ${aantal} ${aantal === 1 ? "betaling" : "termijnen"} betaald`}
    >
      {Array.from({ length: aantal }, (_, i) => (
        <span
          key={i}
          className={cn("h-2 flex-1 rounded-full", i < betaald ? "bg-sage" : "bg-cream-200")}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------- het termijnschema -- */

/**
 * Het volledige schema. `admin` voegt factuurlink, Mollie-status en
 * betaaldatum toe; `factuurBasis` bepaalt waar een factuurlink heen wijst.
 */
export function TermijnLijst({
  weergave,
  admin = false,
  factuurBasis,
}: {
  weergave: SchemaWeergave;
  admin?: boolean;
  factuurBasis?: string;
}) {
  return (
    <ol className="divide-y divide-cream-100">
      {weergave.rijen.map((r) => (
        <TermijnRegel key={r.id} r={r} admin={admin} factuurBasis={factuurBasis} enkel={weergave.rijen.length === 1} />
      ))}
    </ol>
  );
}

function TermijnRegel({
  r,
  admin,
  factuurBasis,
  enkel,
}: {
  r: TermijnRij;
  admin: boolean;
  factuurBasis?: string;
  enkel: boolean;
}) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-extrabold tabular-nums",
          r.status === "betaald" ? "bg-sage text-white" : "bg-cream-100 text-ink-500",
        )}
        aria-hidden
      >
        {r.status === "betaald" ? <Check className="h-3.5 w-3.5" /> : r.volgnummer}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[14px] font-bold text-ink">
            {enkel ? "Eenmalige betaling" : `Termijn ${r.volgnummer} van ${r.aantal}`}
          </p>
          <p className="text-[14px] font-extrabold tabular-nums text-ink">
            {r.exVat} <span className="text-[11.5px] font-semibold text-ink-300">excl. btw</span>
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="text-[12.5px] text-ink-500">{r.wanneer}</p>
          <TermijnPil status={r.status} label={r.statusLabel} />
        </div>
        <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-300">
          {r.inclVat} incl. btw ({r.vat} btw)
        </p>
        {(r.factuur || (admin && r.mollieStatus)) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {r.factuur && factuurBasis && (
              <a
                href={`${factuurBasis}${encodeURIComponent(r.factuur)}`}
                className="inline-flex items-center gap-1 font-bold text-brand hover:text-brand-600"
              >
                <Receipt className="h-3.5 w-3.5" />
                Factuur {r.factuur}
              </a>
            )}
            {admin && r.mollieStatus && (
              <span className="font-mono text-[11px] text-ink-300">
                Mollie: {r.mollieStatus.toLowerCase()}
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------- de kerngetallen, één regel -- */

/**
 * "€ 2.500 → 6 termijnen → 2 betaald → € 1.666,66 open → volgende € 416,67".
 * Wat de beheerder binnen een paar seconden moet kunnen zien.
 */
export function RegelingSamenvatting({
  totaalEx,
  titel,
  weergave,
}: {
  totaalEx: string;
  titel: string;
  weergave: SchemaWeergave;
}) {
  const v = weergave.voortgang;
  const stappen: { label: string; value: string; tint?: "sage" | "brand" }[] = [
    { label: "Eenmalig", value: `${totaalEx} excl.` },
    { label: "Regeling", value: titel },
    {
      label: "Betaald",
      value: `${v.betaaldAantal} van ${v.aantal} · ${v.betaaldEx}`,
      tint: v.betaaldAantal > 0 ? "sage" : undefined,
    },
    { label: "Open", value: v.openEx, tint: v.volledigBetaald ? "sage" : undefined },
    ...(v.volgende
      ? [
          {
            label: v.volgende.status === "te-laat" ? "Te laat" : "Volgende",
            value: `${v.volgende.exVat} · ${v.volgende.wanneer}`,
            tint: v.volgende.status === "te-laat" ? ("brand" as const) : undefined,
          },
        ]
      : []),
  ];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
      <Voortgangsbalk betaald={v.betaaldAantal} aantal={v.aantal} />
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-5">
        {stappen.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-300">{s.label}</dt>
            <dd
              className={cn(
                "text-[13.5px] font-extrabold tabular-nums leading-snug",
                s.tint === "sage" ? "text-sage-600" : s.tint === "brand" ? "text-brand-600" : "text-ink",
              )}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {v.teLaatAantal > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-600">
          <Clock className="h-3.5 w-3.5" />
          {v.teLaatAantal === 1 ? "1 termijn te laat" : `${v.teLaatAantal} termijnen te laat`}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------ vóór ondertekening: het voorstel -- */

/**
 * De regeling zoals de klant hem leest vóór het tekenen. Nog zonder
 * statussen, met "wanneer" in woorden ("1 maand na ondertekening") of — bij
 * een vaste startdatum — als datum.
 */
export function RegelingVoorstel({
  regeling,
  totaalEx,
  totaalIncl,
  vat,
  vatPercent,
}: {
  regeling: RegelingLabels;
  totaalEx: string;
  totaalIncl: string;
  vat: string;
  vatPercent: number;
}) {
  const enkel = regeling.termijnen.length === 1;
  return (
    <div className="p-6 sm:p-7">
      <p className="text-[12.5px] font-bold uppercase tracking-wide text-ink-300">Betaalafspraak</p>
      <p className="mt-1 text-[20px] font-extrabold leading-tight tracking-tight text-ink">
        {regeling.titel}
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">{regeling.zin}</p>

      <ol className="mt-4 divide-y divide-cream-100 rounded-xl bg-cream-100/50 px-4 py-1">
        {regeling.termijnen.map((t) => (
          <li key={t.volgnummer} className="flex items-start justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">
                {enkel ? "Eenmalige betaling" : `Termijn ${t.volgnummer}`}
              </span>
              <span className="block text-[12px] text-ink-500">{t.wanneer}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[13.5px] font-extrabold tabular-nums text-ink">
                {t.exVat} <span className="text-[11px] font-semibold text-ink-300">excl.</span>
              </span>
              <span className="block text-[11.5px] tabular-nums text-ink-300">{t.inclVat} incl. btw</span>
            </span>
          </li>
        ))}
      </ol>
      <dl className="mt-3 space-y-1 text-[12.5px]">
        <div className="flex justify-between gap-3 text-ink-500">
          <dt>Totaal excl. btw</dt>
          <dd className="tabular-nums">{totaalEx}</dd>
        </div>
        <div className="flex justify-between gap-3 text-ink-500">
          <dt>Btw {vatPercent}%</dt>
          <dd className="tabular-nums">{vat}</dd>
        </div>
        <div className="flex justify-between gap-3 font-bold text-ink">
          <dt>Totaal incl. btw</dt>
          <dd className="tabular-nums">{totaalIncl}</dd>
        </div>
      </dl>
    </div>
  );
}
