"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createPartner, type PartnerActionState } from "@/app/actions/partners";

const IDLE: PartnerActionState = { status: "idle" };

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-brand"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {hint && <p className="mt-1 text-[11px] text-ink-300">{hint}</p>}
    </div>
  );
}

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
            Nog één toevoegen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Naam contactpersoon" name="naam" required placeholder="Sanne Bakker" />
        <Field label="Bedrijfsnaam" name="bedrijfsnaam" required placeholder="Hondenschool De Vrije Loop" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mailadres" name="email" type="email" required placeholder="sanne@bedrijf.nl" />
        <Field label="Telefoonnummer" name="telefoon" placeholder="06 12 34 56 78" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" name="website" placeholder="www.bedrijf.nl" />
        <Field label="Adres" name="adres" placeholder="Straat 1, Plaats" />
      </div>
      <Field
        label="Eigen referralcode (optioneel)"
        name="referralCode"
        placeholder="HONDENSCHOOL-JANSEN"
        hint="Leeg laten voor een automatisch gegenereerde code (DW-XXXXXX). Niet hoofdlettergevoelig."
      />
      <div>
        <label htmlFor="notitie" className="mb-1.5 block text-[13px] font-semibold text-ink-700">
          Interne notitie
        </label>
        <textarea
          id="notitie"
          name="notitie"
          rows={2}
          placeholder="Alleen zichtbaar voor beheer"
          className="w-full resize-y rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {state.status === "error" && (
        <p className="text-[13px] font-semibold text-brand-600">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {pending ? "Aanmaken en uitnodigen…" : "Maak partner aan en verstuur uitnodiging"}
      </button>
    </form>
  );
}
