"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  checkPartnerEmail,
  createPartner,
  type PartnerActionState,
} from "@/app/actions/partners";

const IDLE: PartnerActionState = { status: "idle" };

export function NewPartnerForm() {
  const [state, action, pending] = useActionState(createPartner, IDLE);
  // Vooruitblik terwijl de beheerder typt: geen verrassing bij het opslaan.
  const [vooruitblik, setVooruitblik] = useState<PartnerActionState>(IDLE);
  const [, startCheck] = useTransition();

  // Zodra de server bevestiging vraagt, staat die melding voorop.
  const melding = state.status === "idle" ? vooruitblik : state;
  // Afgeleid, niet apart bijgehouden: is de koppeling al één keer getoond?
  const bevestigd = melding.status === "bevestig";

  function controleerEmail(email: string) {
    if (!email.includes("@")) {
      setVooruitblik(IDLE);
      return;
    }
    const data = new FormData();
    data.set("email", email);
    startCheck(async () => setVooruitblik(await checkPartnerEmail(IDLE, data)));
  }

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

  const alPartner = melding.status === "al_partner";

  return (
    <form action={action} className="space-y-5">
      {/* Bevestiging dat we aan het bestaande account koppelen. */}
      <input type="hidden" name="bevestigd" value={bevestigd ? "1" : "0"} />

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
            onBlur={(e) => controleerEmail(e.target.value.trim().toLowerCase())}
            className="mt-1 w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
      </div>

      {/* Bestaand account: geen blokkade, gewoon uitleg wat er gebeurt. */}
      {melding.status === "bevestig" && (
        <div className="rounded-2xl bg-sage-100/60 px-4 py-3 ring-1 ring-sage-600/20">
          <p className="text-[13px] font-semibold text-ink">{melding.message}</p>
          <p className="mt-1 text-[12px] text-ink-500">
            De bestaande aanvragen, klantgegevens en journey van deze persoon
            blijven ongewijzigd. Er komt geen tweede account bij.
          </p>
        </div>
      )}

      {alPartner && (
        <div className="rounded-2xl bg-cream/80 px-4 py-3 ring-1 ring-ink/10">
          <p className="text-[13px] font-semibold text-ink">
            Dit account is al als partner actief.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/admin/partners/${melding.partnerId}`}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700"
            >
              Partnerprofiel openen
            </Link>
            <Link
              href={`/admin/partners/${melding.partnerId}`}
              className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 ring-1 ring-ink/10 hover:ring-ink/25"
            >
              Link bekijken of uitnodiging opnieuw sturen
            </Link>
          </div>
        </div>
      )}

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

      {melding.status === "error" && (
        <p className="text-[13px] font-semibold text-brand-600">{melding.message}</p>
      )}

      <button
        type="submit"
        disabled={pending || alPartner}
        className="w-full rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {pending ? "Partner activeren…" : "Partner activeren"}
      </button>
      <p className="text-center text-[11px] text-ink-300">
        {melding.status === "bevestig"
          ? "We koppelen de partneromgeving aan het bestaande account en sturen een persoonlijk bericht."
          : "We maken meteen een account + persoonlijke link aan en sturen een warme uitnodiging."}
      </p>
    </form>
  );
}
