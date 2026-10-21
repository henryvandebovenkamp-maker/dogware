"use client";

import { useActionState } from "react";
import {
  cancelPartnerEmailChange,
  requestPartnerEmailChange,
  type PartnerActionState,
} from "@/app/actions/partners";

const IDLE: PartnerActionState = { status: "idle" };

/**
 * E-mailadres van de partner wijzigen. Zelfde partner, zelfde account, zelfde
 * link — alleen het adres verandert, en pas nadat de partner het vanaf het
 * nieuwe adres heeft bevestigd.
 */
export function PartnerEmailWijzigen({
  partnerId,
  huidig,
  openstaand,
}: {
  partnerId: string;
  huidig: string;
  openstaand: { nieuw: string; verloopt: string } | null;
}) {
  const [state, action, pending] = useActionState(requestPartnerEmailChange, IDLE);
  const [annState, annAction, annPending] = useActionState(cancelPartnerEmailChange, IDLE);

  return (
    <div className="rounded-xl bg-cream/60 p-4">
      <p className="text-[12px] font-bold text-ink">E-mailadres</p>
      <p className="mt-1 break-all text-[12px] text-ink-500">
        Nu: <span className="font-semibold text-ink">{huidig}</span>
      </p>

      {openstaand && (
        <form action={annAction} className="mt-2 rounded-lg bg-white p-3 ring-1 ring-ink/5">
          <input type="hidden" name="partnerId" value={partnerId} />
          <p className="break-all text-[12px] text-ink-700">
            Wacht op bevestiging van <span className="font-bold">{openstaand.nieuw}</span>
            <span className="block text-[11px] text-ink-300">Link geldig tot {openstaand.verloopt}</span>
          </p>
          <button
            type="submit"
            disabled={annPending}
            className="mt-2 text-[12px] font-semibold text-brand-600 underline disabled:opacity-60"
          >
            {annPending ? "Intrekken…" : "Wijziging intrekken"}
          </button>
          {annState.status !== "idle" && (
            <p className={`mt-1 text-[12px] font-semibold ${annState.status === "error" ? "text-brand-600" : "text-sage-600"}`}>
              {annState.message}
            </p>
          )}
        </form>
      )}

      <form action={action} className="mt-2">
        <input type="hidden" name="partnerId" value={partnerId} />
        <input
          name="email"
          type="email"
          required
          placeholder="nieuw@adres.nl"
          autoComplete="off"
          className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
        />
        <input
          name="reason"
          placeholder="Reden (optioneel, voor de auditlog)"
          className="mt-2 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink-300 focus:border-brand"
        />
        <p className="mt-1 text-[11px] text-ink-300">
          De partner krijgt een bevestigingslink op het nieuwe adres. Partner-ID,
          link, aanbrengingen en commissies blijven ongewijzigd.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
        >
          {pending ? "Versturen…" : "Bevestigingslink versturen"}
        </button>
        {state.status !== "idle" && (
          <p className={`mt-2 text-[12px] font-semibold ${state.status === "error" ? "text-brand-600" : "text-sage-600"}`}>
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
