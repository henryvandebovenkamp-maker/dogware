"use client";

import { useActionState, useState } from "react";
import {
  changeStage,
  saveDemoLinks,
  sendDemo,
  type JourneyActionState,
} from "@/app/actions/journey";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { STAGE_META } from "@/lib/journey-stages";

const IDLE: JourneyActionState = { status: "idle" };

function Feedback({ state }: { state: JourneyActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p className={`mt-2 text-[12px] font-semibold ${state.status === "error" ? "text-brand-600" : "text-sage-600"}`}>
      {state.message}
    </p>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* stil */
        }
      }}
      className="rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "Gekopieerd" : label}
    </button>
  );
}

/**
 * Extreem eenvoudig "Voorbeeld versturen"-scherm:
 * drie velden, kopieerknoppen en één verstuurknop. Meer niet.
 */
export function DemoPanel({
  leadId,
  website,
  portaal,
  loginEmail,
  klantEmail,
  alSent,
}: {
  leadId: string;
  website: string;
  portaal: string;
  loginEmail: string;
  klantEmail: string;
  alSent: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(saveDemoLinks, IDLE);
  const [sendState, sendAction, sending] = useActionState(sendDemo, IDLE);

  // Gecontroleerde velden zodat de kopieerknoppen de actuele waarde pakken
  const [w, setW] = useState(website);
  const [p, setP] = useState(portaal);
  const [e, setE] = useState(loginEmail || klantEmail);

  return (
    <div className="space-y-4">
      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="leadId" value={leadId} />
        <Field label="Voorbeeldwebsite URL" name="website" value={w} onChange={setW} placeholder="https://voorbeeld.example.nl" />
        <Field label="Demoportaal URL" name="portaal" value={p} onChange={setP} placeholder="https://portaal.example.nl" />
        <Field label="Login e-mailadres" name="loginEmail" value={e} onChange={setE} placeholder={klantEmail} type="email" />

        <div className="flex flex-wrap gap-2">
          <CopyButton value={w} label="Kopieer website-link" />
          <CopyButton value={p} label="Kopieer portaal-link" />
          <CopyButton value={e} label="Kopieer login" />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
        >
          {saving ? "Opslaan…" : "Links opslaan"}
        </button>
        <Feedback state={saveState} />
      </form>

      <form action={sendAction} className="border-t border-cream-100 pt-4">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="website" value={w} />
        <input type="hidden" name="loginEmail" value={e} />
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-full bg-brand px-5 py-3 text-[14px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {sending ? "Versturen…" : alSent ? "Voorbeeld opnieuw versturen" : "Verstuur e-mail"}
        </button>
        <Feedback state={sendState} />
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-[12px] font-semibold text-ink-700">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand"
      />
    </label>
  );
}

/** Stage handmatig aanpassen — compact. */
export function StageControl({ leadId, current }: { leadId: string; current: JourneyStage }) {
  const [state, action, pending] = useActionState(changeStage, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="stage"
        defaultValue={current}
        className="rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
      >
        {JOURNEY_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_META[s].label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
      >
        {pending ? "…" : "Stap zetten"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
