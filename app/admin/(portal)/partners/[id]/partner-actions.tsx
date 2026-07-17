"use client";

import { useActionState, useState } from "react";
import {
  changeReferralCode,
  resendInvite,
  updatePartnerStatus,
  type PartnerActionState,
} from "@/app/actions/partners";
import { PARTNER_STATUSES } from "@/lib/db/schema";

const IDLE: PartnerActionState = { status: "idle" };

function Feedback({ state }: { state: PartnerActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      className={`mt-2 text-[12px] font-semibold ${
        state.status === "error" ? "text-brand-600" : "text-sage-600"
      }`}
    >
      {state.message}
    </p>
  );
}

export function PartnerAdminActions({
  partnerId,
  currentStatus,
  currentCode,
  accountActief,
}: {
  partnerId: string;
  currentStatus: string;
  currentCode: string;
  accountActief: boolean;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(resendInvite, IDLE);
  const [statusState, statusAction, statusPending] = useActionState(updatePartnerStatus, IDLE);
  const [codeState, codeAction, codePending] = useActionState(changeReferralCode, IDLE);
  const [gekozenStatus, setGekozenStatus] = useState(currentStatus);

  const destructief = gekozenStatus === "BLOCKED" || gekozenStatus === "ENDED";

  return (
    <div className="mt-3 grid gap-5 lg:grid-cols-3">
      {/* Uitnodiging opnieuw */}
      <form action={inviteAction} className="rounded-xl bg-cream/60 p-4">
        <input type="hidden" name="partnerId" value={partnerId} />
        <p className="text-[12px] font-bold text-ink">Uitnodiging</p>
        <p className="mt-1 text-[12px] text-ink-500">
          {accountActief
            ? "Account is geactiveerd."
            : "Verstuurt een nieuwe activatielink; oude links vervallen direct."}
        </p>
        {!accountActief && (
          <button
            type="submit"
            disabled={invitePending}
            className="mt-3 rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
          >
            {invitePending ? "Versturen…" : "Opnieuw versturen"}
          </button>
        )}
        <Feedback state={inviteState} />
      </form>

      {/* Status */}
      <form action={statusAction} className="rounded-xl bg-cream/60 p-4">
        <input type="hidden" name="partnerId" value={partnerId} />
        <p className="text-[12px] font-bold text-ink">Status</p>
        <select
          name="status"
          value={gekozenStatus}
          onChange={(e) => setGekozenStatus(e.target.value)}
          className="mt-2 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
        >
          {PARTNER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {destructief && (
          <input
            name="reason"
            required
            placeholder="Reden (verplicht bij blokkeren/beëindigen)"
            className="mt-2 w-full rounded-lg border border-brand/30 bg-white px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink-300 focus:border-brand"
          />
        )}
        <button
          type="submit"
          disabled={statusPending || gekozenStatus === currentStatus}
          className={`mt-3 rounded-full px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60 ${
            destructief ? "bg-brand-600 hover:bg-brand" : "bg-ink hover:bg-ink-700"
          }`}
        >
          {statusPending
            ? "Opslaan…"
            : destructief
              ? `Bevestig: ${gekozenStatus}`
              : "Status opslaan"}
        </button>
        <Feedback state={statusState} />
      </form>

      {/* Referralcode */}
      <form action={codeAction} className="rounded-xl bg-cream/60 p-4">
        <input type="hidden" name="partnerId" value={partnerId} />
        <p className="text-[12px] font-bold text-ink">Referralcode</p>
        <input
          name="referralCode"
          defaultValue={currentCode}
          className="mt-2 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-brand"
        />
        <p className="mt-1 text-[11px] text-ink-300">
          Historische aanvragen behouden hun oorspronkelijke code.
        </p>
        <button
          type="submit"
          disabled={codePending}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
        >
          {codePending ? "Opslaan…" : "Code wijzigen"}
        </button>
        <Feedback state={codeState} />
      </form>
    </div>
  );
}
