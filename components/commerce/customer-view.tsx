"use client";

import { useState, useTransition } from "react";
import { acceptProposal, startPayment } from "@/app/actions/commerce";

export type CustomerCommerce = {
  leadId: string;
  status: string;
  total: string;
  deposit: string;
  outstanding: string;
  monthly: string;
  freeMonths: number;
  accepted: boolean;
  depositPaid: boolean;
  fullyPaid: boolean;
  mollieReady: boolean;
};

/**
 * Rustige commerciële weergave voor de klant. Eén duidelijke primaire actie
 * per fase; geen technisch betaaloverzicht.
 */
export function CustomerCommerce({ data }: { data: CustomerCommerce }) {
  const [pending, startT] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function accept() {
    startT(async () => {
      const res = await acceptProposal(data.leadId);
      if (res.status === "error") setMsg(res.message ?? "Er ging iets mis.");
      else window.location.reload();
    });
  }
  function pay(kind: "deposit" | "final") {
    startT(async () => {
      const res = await startPayment(data.leadId, kind);
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else setMsg(res.message ?? "Betalen lukt nu even niet.");
    });
  }

  // Kopregel + primaire actie per fase
  let kop = "";
  let tekst = "";
  let actie: React.ReactNode = null;

  if (!data.accepted) {
    kop = "Je voorstel staat klaar";
    tekst = `Projecttotaal ${data.total}. Na akkoord betaal je de eerste termijn van ${data.deposit}; het restant volgt bij oplevering. Daarna een abonnement van ${data.monthly} per maand${data.freeMonths > 0 ? `, met de eerste ${data.freeMonths === 1 ? "maand" : `${data.freeMonths} maanden`} gratis` : ""}.`;
    actie = <Primary onClick={accept} pending={pending} label="Akkoord geven" />;
  } else if (!data.depositPaid) {
    kop = "Mooi — we kunnen beginnen";
    tekst = `Om te starten met bouwen vragen we de eerste termijn van ${data.deposit}.`;
    actie = <Primary onClick={() => pay("deposit")} pending={pending} label={`Betaal ${data.deposit}`} disabled={!data.mollieReady} />;
  } else if (!data.fullyPaid && data.status === "DELIVERY_READY") {
    kop = "Je omgeving is klaar!";
    tekst = `De laatste termijn van ${data.outstanding} staat voor je klaar. Daarna is alles van jou.`;
    actie = <Primary onClick={() => pay("final")} pending={pending} label={`Betaal ${data.outstanding}`} disabled={!data.mollieReady} />;
  } else if (!data.fullyPaid) {
    kop = "We bouwen aan jouw DogWare";
    tekst = "De eerste termijn is betaald — dank je wel! We zijn nu aan het bouwen. Bij oplevering hoor je van ons.";
  } else {
    kop = "Helemaal rond 🐾";
    tekst = `Je project is volledig betaald. Binnenkort start je abonnement van ${data.monthly} per maand${data.freeMonths > 0 ? ` — de eerste ${data.freeMonths === 1 ? "maand" : `${data.freeMonths} maanden`} van ons cadeau` : ""}.`;
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-ink/5">
      <div className="h-1.5 bg-gradient-to-r from-brand to-sage" />
      <div className="p-6 sm:p-7">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{kop}</h2>
        <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-500">{tekst}</p>
        {actie && <div className="mt-5">{actie}</div>}
        {msg && <p className="mt-3 text-[13px] font-semibold text-brand-600">{msg}</p>}
        {!data.mollieReady && !data.fullyPaid && data.accepted && (
          <p className="mt-2 text-[12px] text-ink-300">Betalen wordt zo geactiveerd — je hoort van ons.</p>
        )}
      </div>
    </div>
  );
}

function Primary({ onClick, pending, label, disabled }: { onClick: () => void; pending: boolean; label: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={pending || disabled}
      className="rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
      {pending ? "Een moment…" : label}
    </button>
  );
}
