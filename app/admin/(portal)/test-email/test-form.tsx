"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { sendTestEmail, type TestEmailState } from "./actions";

const INITIAL_STATE: TestEmailState = { status: "idle" };

const TEMPLATES = [
  { value: "plain", label: "Kale testmail (alleen tekst)" },
  { value: "demo-request", label: "Demo-aanvraag (interne notificatie)" },
  { value: "demo-confirmation", label: "Demo-bevestiging (naar aanvrager)" },
  { value: "welcome", label: "Welkomstmail" },
  { value: "notification", label: "Interne notificatie" },
];

export function TestEmailForm() {
  const [state, formAction, pending] = useActionState(
    sendTestEmail,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="to"
          className="mb-1.5 block text-[13px] font-semibold text-ink-700"
        >
          Ontvanger
        </label>
        <input
          id="to"
          name="to"
          type="email"
          required
          placeholder="jij@voorbeeld.nl"
          className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div>
        <label
          htmlFor="template"
          className="mb-1.5 block text-[13px] font-semibold text-ink-700"
        >
          Template
        </label>
        <select
          id="template"
          name="template"
          defaultValue="plain"
          className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          {TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="subject"
          className="mb-1.5 block text-[13px] font-semibold text-ink-700"
        >
          Onderwerp (optioneel — alleen voor kale mail en notificatie)
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          placeholder="Testmail van DogWare"
          className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {pending ? (
          <>
            Versturen…
            <Loader2 className="h-4 w-4 animate-spin" />
          </>
        ) : (
          <>
            Verstuur testmail
            <Send className="h-4 w-4" />
          </>
        )}
      </button>

      {state.status === "success" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-sage-100 p-4 text-sm font-semibold text-sage-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {state.message}
            {state.id && (
              <span className="mt-0.5 block font-mono text-xs font-normal">
                id: {state.id}
              </span>
            )}
          </span>
        </div>
      )}
      {state.status === "error" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-brand-100 p-4 text-sm font-semibold text-brand-600">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}
    </form>
  );
}
