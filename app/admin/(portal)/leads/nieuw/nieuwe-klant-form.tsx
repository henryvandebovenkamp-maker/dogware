"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { createDirectCustomer, type DirecteKlantState } from "@/app/actions/direct-klant";
import type { DirecteKlantVelden } from "@/lib/direct-klant";
import { cn } from "@/lib/cn";

const IDLE: DirecteKlantState = { status: "idle" };

const VELDEN: {
  naam: keyof DirecteKlantVelden;
  label: string;
  type?: string;
  autoComplete?: string;
  optioneel?: boolean;
}[] = [
  { naam: "bedrijfsnaam", label: "Bedrijfsnaam", autoComplete: "organization" },
  { naam: "naam", label: "Naam contactpersoon", autoComplete: "name" },
  { naam: "email", label: "E-mailadres", type: "email", autoComplete: "email" },
  { naam: "telefoon", label: "Telefoonnummer", type: "tel", autoComplete: "tel" },
  { naam: "plaats", label: "Plaats", autoComplete: "address-level2" },
  { naam: "website", label: "Huidige website", type: "url", optioneel: true },
];

export function NieuweKlantForm() {
  const [state, action, pending] = useActionState(createDirectCustomer, IDLE);

  return (
    <form action={action} className="space-y-4" noValidate>
      {VELDEN.map((v) => {
        const fout = state.velden?.[v.naam];
        return (
          <div key={v.naam}>
            <label htmlFor={v.naam} className="mb-1.5 block text-[13px] font-semibold text-ink-700">
              {v.label}
              {v.optioneel && <span className="font-normal text-ink-300"> — optioneel</span>}
            </label>
            <input
              id={v.naam}
              name={v.naam}
              type={v.type === "url" ? "text" : (v.type ?? "text")}
              inputMode={v.type === "url" ? "url" : undefined}
              autoComplete={v.autoComplete}
              required={!v.optioneel}
              defaultValue={state.waarden?.[v.naam] ?? ""}
              aria-invalid={Boolean(fout)}
              className={cn(
                "w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20",
                fout ? "border-brand" : "border-cream-200",
              )}
            />
            {fout && <p className="mt-1 text-[12px] font-semibold text-brand-600">{fout}</p>}
          </div>
        );
      })}

      {state.status === "error" && state.message && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-600">
          {state.message}
          {state.bestaandeLeadId && (
            <Link
              href={`/admin/leads/${state.bestaandeLeadId}`}
              className="mt-1 flex items-center gap-1 underline underline-offset-2"
            >
              Naar het bestaande dossier <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Opslaan…" : "Klant opslaan en opdracht vastleggen"}
      </button>
    </form>
  );
}
