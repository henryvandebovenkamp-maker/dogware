"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  savePartnerProfile,
  type ProfileInput,
} from "@/app/actions/partner-profile";
import { formatIban, isValidIban } from "@/lib/iban";
import { GlyphCheck } from "@/components/demo/illustrations";

/**
 * Warm profielformulier met autosave (debounced, direct naar de server —
 * bankgegevens komen nooit in localStorage). Toont subtiel "Concept opgeslagen".
 */
export function ProfileForm({
  email,
  initial,
}: {
  email: string;
  initial: ProfileInput;
}) {
  const [data, setData] = useState<ProfileInput>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [ibanError, setIbanError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(JSON.stringify(initial));

  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => {
    setData((d) => ({ ...d, [k]: v }));
  };

  const save = useCallback(async (payload: ProfileInput) => {
    if (payload.iban && !isValidIban(payload.iban)) {
      setIbanError(true);
      return;
    }
    setIbanError(false);
    setStatus("saving");
    const res = await savePartnerProfile(payload);
    if (res.ok) {
      lastSaved.current = JSON.stringify(payload);
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }, []);

  // Autosave: debounce bij elke wijziging
  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (serialized === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    const t = setTimeout(() => save(data), 900);
    timer.current = t;
    return () => clearTimeout(t);
  }, [data, save]);

  return (
    <div className="space-y-6">
      {/* Persoonlijke gegevens */}
      <Card titel="Persoonlijke gegevens">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Voornaam" value={data.voornaam} onChange={(v) => set("voornaam", v)} />
          <Field label="Achternaam" value={data.achternaam} onChange={(v) => set("achternaam", v)} />
          <Field label="Bedrijfsnaam (optioneel)" value={data.bedrijfsnaam} onChange={(v) => set("bedrijfsnaam", v)} />
          <Field label="E-mailadres" value={email} onChange={() => {}} readOnly />
          <Field label="Telefoonnummer" value={data.telefoon} onChange={(v) => set("telefoon", v)} type="tel" />
          <Field label="Website" value={data.website} onChange={(v) => set("website", v)} placeholder="www.jouwsite.nl" />
        </div>
      </Card>

      {/* Uitbetalingen */}
      <Card titel="Uitbetalingen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rekeninghouder" value={data.rekeninghouder} onChange={(v) => set("rekeninghouder", v)} />
          <Field label="Land" value={data.land} onChange={(v) => set("land", v)} placeholder="Nederland" />
          <div className="sm:col-span-2">
            <Field
              label="IBAN"
              value={data.iban}
              onChange={(v) => set("iban", v)}
              onBlur={() => set("iban", formatIban(data.iban))}
              placeholder="NL00 BANK 0123 4567 89"
              error={ibanError ? "Dit IBAN lijkt niet te kloppen." : undefined}
            />
          </div>
          <Field label="BIC (alleen indien nodig)" value={data.bic} onChange={(v) => set("bic", v)} />
        </div>
        <p className="mt-3 rounded-xl bg-cream/70 px-4 py-3 text-[13px] leading-relaxed text-ink-500">
          Zodra een referral definitief klant is geworden en de commissie
          beschikbaar komt, maken wij het bedrag automatisch over naar
          bovenstaande rekening.
        </p>
      </Card>

      {/* Facturatie */}
      <Card titel="Facturatie">
        <div className="space-y-2.5">
          <Radio
            checked={data.factuurType !== "zakelijk"}
            onSelect={() => set("factuurType", "particulier")}
            label="Ik ontvang mijn commissie als particulier."
          />
          <Radio
            checked={data.factuurType === "zakelijk"}
            onSelect={() => set("factuurType", "zakelijk")}
            label="Ik ontvang mijn commissie zakelijk."
          />
        </div>
        {data.factuurType === "zakelijk" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="KvK-nummer" value={data.kvkNummer} onChange={(v) => set("kvkNummer", v)} />
            <Field label="BTW-nummer" value={data.btwNummer} onChange={(v) => set("btwNummer", v)} />
          </div>
        )}
      </Card>

      {/* Opslaan + status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => save(data)}
          disabled={status === "saving"}
          className="rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:opacity-70"
        >
          {status === "saving" ? "Opslaan…" : "Gegevens opslaan"}
        </button>
        <span className="text-[12px] font-medium" aria-live="polite">
          {status === "saving" && <span className="text-ink-300">Concept opslaan…</span>}
          {status === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-sage-600">
              <GlyphCheck className="h-3.5 w-3.5" /> Concept opgeslagen
            </span>
          )}
          {status === "error" && <span className="text-brand-600">Opslaan mislukt — probeer opnieuw.</span>}
        </span>
      </div>

      {/* Vertrouwensblok */}
      <div className="rounded-2xl bg-sage-100/50 p-5 ring-1 ring-sage/10">
        <p className="text-[13px] font-extrabold text-sage-600">Je gegevens zijn veilig</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
          Je bankgegevens worden uitsluitend gebruikt voor commissie-uitbetalingen
          en veilig versleuteld opgeslagen.
        </p>
      </div>
    </div>
  );
}

/* ---------- Bouwstenen ---------- */

function Card({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-7">
      <h2 className="mb-4 text-[15px] font-extrabold text-ink">{titel}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  readOnly = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  error?: string;
}) {
  return (
    <label className="block text-[13px] font-semibold text-ink-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-1 w-full rounded-xl border bg-white px-4 py-2.5 text-[14px] font-normal text-ink outline-none transition placeholder:text-ink-300 focus:ring-2 focus:ring-brand/20 ${
          error ? "border-brand focus:border-brand" : "border-cream-200 focus:border-brand"
        } ${readOnly ? "cursor-not-allowed bg-cream/60 text-ink-500" : ""}`}
      />
      {error && <span className="mt-1 block text-[12px] font-semibold text-brand-600">{error}</span>}
    </label>
  );
}

function Radio({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14px] font-semibold transition ${
        checked ? "border-brand bg-brand-50 text-ink" : "border-cream-200 bg-white text-ink-700 hover:border-ink/20"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-brand" : "border-cream-200"
        }`}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
      </span>
      {label}
    </button>
  );
}
