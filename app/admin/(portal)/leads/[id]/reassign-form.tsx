"use client";

import { useActionState, useState } from "react";
import { reassignLead, type PartnerActionState } from "@/app/actions/partners";

const IDLE: PartnerActionState = { status: "idle" };

export function ReassignForm({
  leadId,
  currentPartnerId,
  partners,
}: {
  leadId: string;
  currentPartnerId: string | null;
  partners: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(reassignLead, IDLE);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12px] font-semibold text-ink-300 underline-offset-2 hover:text-ink-500 hover:underline"
        >
          Toewijzing handmatig aanpassen…
        </button>
        {state.status === "success" && (
          <p className="mt-1 text-[12px] font-semibold text-sage-600">{state.message}</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2.5 rounded-xl bg-cream/60 p-4">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-[12px] font-bold text-ink">
        Handmatige toewijzing — wordt vastgelegd in de auditlog
      </p>
      <select
        name="partnerId"
        defaultValue={currentPartnerId ?? ""}
        className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
      >
        <option value="">Geen partner (organisch)</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        name="reason"
        required
        placeholder="Reden (verplicht)"
        className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink-300 focus:border-brand"
      />
      {state.status === "error" && (
        <p className="text-[12px] font-semibold text-brand-600">{state.message}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
        >
          {pending ? "Opslaan…" : "Toewijzing opslaan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 ring-1 ring-ink/10"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
