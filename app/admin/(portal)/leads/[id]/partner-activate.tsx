"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Handshake } from "lucide-react";
import {
  activatePartnerFromLead,
  type PartnerActionState,
} from "@/app/actions/partners";

const IDLE: PartnerActionState = { status: "idle" };

/**
 * Dezelfde persoon ook partner maken, vanuit de aanvraag zelf.
 * De uitnodiging gaat pas weg na een expliciete tweede klik.
 */
export function PartnerActivatePanel({
  leadId,
  naam,
  email,
  telefoon,
  bedrijfsnaam,
  bestaandePartnerId,
}: {
  leadId: string;
  naam: string;
  email: string;
  telefoon: string | null;
  bedrijfsnaam: string | null;
  /** Al partner? Dan alleen een verwijzing, geen formulier. */
  bestaandePartnerId: string | null;
}) {
  const [state, action, pending] = useActionState(activatePartnerFromLead, IDLE);
  const [open, setOpen] = useState(false);
  // De server heeft de bevestiging gevraagd; de volgende klik voert hem uit.
  const bevestigd = state.status === "bevestig";

  const partnerId = bestaandePartnerId ?? state.partnerId;

  if (bestaandePartnerId || state.status === "al_partner" || state.status === "success") {
    return (
      <div className="rounded-xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
        <p className="text-[13px] font-semibold text-ink">
          {state.status === "success"
            ? state.message
            : `${naam} is ook partner.`}
        </p>
        <p className="mt-1 text-[12px] text-ink-500">
          Deze aanvraag en de klantjourney blijven gewoon bij dezelfde persoon
          horen — één account, twee rollen.
        </p>
        {partnerId && (
          <Link
            href={`/admin/partners/${partnerId}`}
            className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700"
          >
            Partnerprofiel openen
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
      <div className="flex items-start gap-3">
        <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">
            Ook als partner activeren
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Zelfde e-mailadres, zelfde account. {naam} houdt deze aanvraag en
            krijgt daarnaast een eigen partnerlink.
          </p>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 ring-1 ring-ink/10 transition hover:ring-ink/25"
        >
          Partner activeren
        </button>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="bevestigd" value={bevestigd ? "1" : "0"} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold text-ink-700">
              Naam
              <input
                name="naam"
                defaultValue={naam}
                className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="text-[12px] font-semibold text-ink-700">
              E-mailadres
              <input
                name="email"
                type="email"
                defaultValue={email}
                readOnly
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-cream-200 bg-cream/60 px-3 py-2 text-[13px] font-normal text-ink-500 outline-none"
              />
            </label>
            <label className="text-[12px] font-semibold text-ink-700">
              Bedrijfsnaam
              <input
                name="bedrijfsnaam"
                defaultValue={bedrijfsnaam ?? ""}
                className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="text-[12px] font-semibold text-ink-700">
              Telefoon
              <input
                name="telefoon"
                defaultValue={telefoon ?? ""}
                className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="text-[12px] font-semibold text-ink-700">
              Beloning per website (€)
              <input
                name="beloning"
                type="number"
                min={0}
                step={50}
                defaultValue={500}
                className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand"
              />
            </label>
          </div>

          {state.status === "bevestig" && (
            <div className="rounded-xl bg-sage-100/60 px-3 py-2.5 ring-1 ring-sage-600/20">
              <p className="text-[12px] font-semibold text-ink">{state.message}</p>
              <p className="mt-0.5 text-[11px] text-ink-500">
                Klik nog één keer om te bevestigen; pas dan gaat het bericht weg.
              </p>
            </div>
          )}
          {state.status === "error" && (
            <p className="text-[12px] font-semibold text-brand-600">{state.message}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-brand px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {pending
                ? "Bezig…"
                : bevestigd
                  ? "Ja, activeren en bericht sturen"
                  : "Partner activeren"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-300 hover:text-ink-500"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
