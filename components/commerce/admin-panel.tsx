"use client";

import { useActionState, useState, useTransition } from "react";
import {
  markDeliveryReady,
  saveCommerceConfig,
  sendProposal,
  startPayment,
  type CommerceState,
} from "@/app/actions/commerce";

const IDLE: CommerceState = { status: "idle" };

export type PanelData = {
  leadId: string;
  status: string;
  config: {
    project: string; setup: string; discountType: string; discountValue: string;
    vat: string; depositPercent: string; monthly: string; freeMonths: string;
    introPercent: string; introMonths: string; startRule: string; opmerkingen: string;
  };
  computed: {
    subtotal: string; discount: string; net: string; vat: string; total: string;
    deposit: string; final: string; paid: string; outstanding: string;
  };
  accepted: boolean;
  depositPaid: boolean;
  mollieReady: boolean;
};

export function AdminCommercePanel({ data }: { data: PanelData }) {
  const [saveState, saveAction, saving] = useActionState(saveCommerceConfig, IDLE);
  const [propState, propAction, propPending] = useActionState(sendProposal, IDLE);
  const [delState, delAction, delPending] = useActionState(markDeliveryReady, IDLE);
  const [pending, startT] = useTransition();
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState(data.config.discountType);

  function pay(kind: "deposit" | "final") {
    startT(async () => {
      const res = await startPayment(data.leadId, kind);
      if (res.checkoutUrl) window.open(res.checkoutUrl, "_blank");
      else setPayMsg(res.message ?? "Kon betaling niet starten.");
    });
  }

  const c = data.config;
  return (
    <div className="space-y-4">
      {/* Samenvatting bedragen */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Amount label="Projecttotaal" value={data.computed.total} />
        <Amount label="Eerste termijn" value={data.computed.deposit} tone="brand" />
        <Amount label="Tweede termijn" value={data.computed.final} tone="brand" />
        <Amount label="Openstaand" value={data.computed.outstanding} tone={data.computed.outstanding === "€ 0,00" ? "sage" : "ink"} />
      </div>

      {/* Afspraak instellen */}
      <form action={saveAction} className="rounded-xl bg-cream/60 p-4">
        <input type="hidden" name="leadId" value={data.leadId} />
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-300">Eenmalige kosten</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Money name="project" label="Projectbedrag (excl. btw)" def={c.project} />
          <Money name="setup" label="Opstartkosten (excl. btw)" def={c.setup} />
          <Num name="vat" label="Btw %" def={c.vat} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-[12px] font-semibold text-ink-700">
            Korting
            <select name="discountType" value={discountType} onChange={(e) => setDiscountType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand">
              <option value="none">Geen</option>
              <option value="amount">Vast bedrag (€)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </label>
          {discountType === "percent"
            ? <Num name="discountValue" label="Kortingspercentage" def={c.discountValue} />
            : <Money name="discountValue" label="Kortingsbedrag" def={c.discountValue} />}
          <Num name="depositPercent" label="Aanbetaling %" def={c.depositPercent} />
        </div>

        <p className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wide text-ink-300">Maandabonnement</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Money name="monthly" label="Maandbedrag (excl. btw)" def={c.monthly} />
          <Num name="freeMonths" label="Gratis maanden" def={c.freeMonths} />
          <label className="text-[12px] font-semibold text-ink-700">
            Abonnement start
            <select name="startRule" defaultValue={c.startRule}
              className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand">
              <option value="na-oplevering">Na oplevering</option>
              <option value="na-laatste-betaling">Na laatste betaling</option>
              <option value="eerste-volgende-maand">1e van volgende maand</option>
              <option value="handmatig">Handmatig</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Num name="introPercent" label="Introkorting %" def={c.introPercent} />
          <Num name="introMonths" label="Introkorting maanden" def={c.introMonths} />
        </div>
        <label className="mt-3 block text-[12px] font-semibold text-ink-700">
          Opmerkingen (optioneel)
          <textarea name="opmerkingen" defaultValue={c.opmerkingen} rows={2}
            className="mt-1 w-full resize-y rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand" />
        </label>
        <button type="submit" disabled={saving}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60">
          {saving ? "Opslaan…" : "Afspraak opslaan"}
        </button>
        {saveState.message && <span className="ml-3 text-[12px] font-semibold text-sage-600">{saveState.message}</span>}
      </form>

      {/* Acties — alleen wat op dit moment logisch is */}
      <div className="flex flex-wrap items-center gap-2">
        <form action={propAction}>
          <input type="hidden" name="leadId" value={data.leadId} />
          <ActionBtn pending={propPending}>Voorstel versturen</ActionBtn>
        </form>
        {data.accepted && !data.depositPaid && (
          <button type="button" onClick={() => pay("deposit")} disabled={pending || !data.mollieReady}
            className="rounded-full bg-brand px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-600 disabled:opacity-50">
            {pending ? "…" : "Eerste betaling openen"}
          </button>
        )}
        {data.depositPaid && (
          <form action={delAction}>
            <input type="hidden" name="leadId" value={data.leadId} />
            <ActionBtn pending={delPending}>Oplevering gereedmelden</ActionBtn>
          </form>
        )}
        {data.depositPaid && (
          <button type="button" onClick={() => pay("final")} disabled={pending || !data.mollieReady || data.computed.outstanding === "€ 0,00"}
            className="rounded-full bg-brand px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-600 disabled:opacity-50">
            Tweede betaling openen
          </button>
        )}
        {!data.mollieReady && (
          <span className="text-[11px] font-semibold text-ink-300">Mollie nog niet geconfigureerd</span>
        )}
      </div>
      {(propState.message || delState.message || payMsg) && (
        <p className="text-[12px] font-semibold text-ink-500">{propState.message || delState.message || payMsg}</p>
      )}
    </div>
  );
}

function Amount({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "brand" | "sage" }) {
  const t = tone === "brand" ? "text-brand" : tone === "sage" ? "text-sage-600" : "text-ink";
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-ink/5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-300">{label}</p>
      <p className={`mt-0.5 text-[15px] font-extrabold ${t}`}>{value}</p>
    </div>
  );
}

function Money({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <label className="text-[12px] font-semibold text-ink-700">
      {label}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-ink-400">€</span>
        <input name={name} type="number" min={0} step="0.01" defaultValue={def}
          className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand" />
      </div>
    </label>
  );
}

function Num({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <label className="text-[12px] font-semibold text-ink-700">
      {label}
      <input name={name} type="number" min={0} step={1} defaultValue={def}
        className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand" />
    </label>
  );
}

function ActionBtn({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending}
      className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60">
      {pending ? "…" : children}
    </button>
  );
}
