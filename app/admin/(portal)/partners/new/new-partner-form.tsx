"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createPartner, type PartnerActionState } from "@/app/actions/partners";

const IDLE: PartnerActionState = { status: "idle" };

export function NewPartnerForm() {
  const [state, action, pending] = useActionState(createPartner, IDLE);

  if (state.status === "success") {
    return (
      <div className="text-center">
        <p className="text-sm font-semibold text-sage-600">{state.message}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href={`/admin/partners/${state.partnerId}`}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-ink-700"
          >
            Bekijk partner
          </Link>
          <Link
            href="/admin/partners/new"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-500 ring-1 ring-ink/10 hover:ring-ink/25"
          >
            Nog iemand uitnodigen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {/* Alleen naam + e-mail */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-[13px] font-semibold text-ink-700">
          Naam <span className="text-brand">*</span>
          <input
            name="naam"
            required
            placeholder="Sanne Bakker"
            className="mt-1 w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label className="text-[13px] font-semibold text-ink-700">
          E-mailadres <span className="text-brand">*</span>
          <input
            name="email"
            type="email"
            required
            placeholder="sanne@voorbeeld.nl"
            className="mt-1 w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-cream/60 p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-300">
          Beloning voor de partner
        </p>
        <label className="mt-2 block text-[13px] font-semibold text-ink-700">
          Bedrag per verkochte website (€)
          <div className="mt-1 flex items-center gap-2">
            <span className="text-ink-500">€</span>
            <input
              name="beloning"
              type="number"
              min={0}
              step={50}
              defaultValue={500}
              className="w-32 rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] font-normal text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </label>
      </div>

      <div className="rounded-2xl bg-cream/60 p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-300">
          Voordeel voor de nieuwe klant
        </p>
        <label className="mt-2 block text-[13px] font-semibold text-ink-700">
          Eén voordeel per regel
          <textarea
            name="perks"
            rows={3}
            defaultValue={"10% korting op jouw nieuwe website\nDe eerste maand abonnement cadeau"}
            className="mt-1 w-full resize-y rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <p className="mt-1 text-[11px] text-ink-300">
          Deze voordelen ziet de bezoeker die via deze partner binnenkomt.
        </p>
      </div>

      {state.status === "error" && (
        <p className="text-[13px] font-semibold text-brand-600">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {pending ? "Partner activeren…" : "Partner activeren"}
      </button>
      <p className="text-center text-[11px] text-ink-300">
        We maken meteen een account + persoonlijke link aan en sturen een warme
        uitnodiging.
      </p>
    </form>
  );
}
