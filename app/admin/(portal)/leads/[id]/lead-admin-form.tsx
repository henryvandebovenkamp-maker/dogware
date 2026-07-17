"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/db/schema";
import { updateLead, type UpdateLeadState } from "./actions";

const INITIAL_STATE: UpdateLeadState = { status: "idle" };

export function LeadAdminForm({
  leadId,
  status,
  notities,
}: {
  leadId: string;
  status: LeadStatus;
  notities: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateLead,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={leadId} />

      <div>
        <label
          htmlFor="status"
          className="mb-1.5 block text-[13px] font-semibold text-ink-700"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="notities"
          className="mb-1.5 block text-[13px] font-semibold text-ink-700"
        >
          Interne notities
        </label>
        <textarea
          id="notities"
          name="notities"
          defaultValue={notities}
          rows={5}
          placeholder="Bijv. gebeld op dinsdag, wil vooral online boeken…"
          className="w-full resize-y rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {pending ? (
            <>
              Opslaan… <Loader2 className="h-4 w-4 animate-spin" />
            </>
          ) : (
            <>
              Opslaan <Save className="h-4 w-4" />
            </>
          )}
        </button>
        {state.status === "success" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage-600">
            <CheckCircle2 className="h-4 w-4" /> {state.message}
          </span>
        )}
        {state.status === "error" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
            <XCircle className="h-4 w-4" /> {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
