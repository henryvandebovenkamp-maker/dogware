"use client";

import { useActionState } from "react";
import {
  addTask,
  changeStage,
  saveDemoSetup,
  sendDemo,
  toggleTask,
  type JourneyActionState,
} from "@/app/actions/journey";
import { JOURNEY_STAGES, type JourneyStage, type JourneyTask } from "@/lib/db/schema";
import { STAGE_META } from "@/lib/journey-stages";

const IDLE: JourneyActionState = { status: "idle" };
const TEMPLATES = ["Hondenschool", "Uitlaatservice", "Dierenarts", "Trimsalon", "Dierenopvang", "Anders"];

function Feedback({ state }: { state: JourneyActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p className={`mt-2 text-[12px] font-semibold ${state.status === "error" ? "text-brand-600" : "text-sage-600"}`}>
      {state.message}
    </p>
  );
}

/* ---------- Voorbeeldwebsite klaarzetten ---------- */
export function DemoSetupForm({
  leadId,
  template,
  domein,
  primair,
  secundair,
}: {
  leadId: string;
  template: string | null;
  domein: string | null;
  primair: string | null;
  secundair: string | null;
}) {
  const [state, action, pending] = useActionState(saveDemoSetup, IDLE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-ink-700">
          Template
          <select
            name="template"
            defaultValue={template ?? ""}
            className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand"
          >
            <option value="">— kies —</option>
            {TEMPLATES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold text-ink-700">
          Domein / subdomein
          <input
            name="domein"
            defaultValue={domein ?? ""}
            placeholder="voorbeeld.dogware.nl"
            className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-ink-700">
          Primaire kleur
          <input
            name="primair"
            defaultValue={primair ?? ""}
            placeholder="#e0562a"
            className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand"
          />
        </label>
        <label className="text-[12px] font-semibold text-ink-700">
          Secundaire kleur
          <input
            name="secundair"
            defaultValue={secundair ?? ""}
            placeholder="#3f6b53"
            className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
      >
        {pending ? "Opslaan…" : "Voorbeeldwebsite opslaan"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/* ---------- Demo versturen ---------- */
export function SendDemoButton({ leadId, alSent }: { leadId: string; alSent: boolean }) {
  const [state, action, pending] = useActionState(sendDemo, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-5 py-3 text-[14px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
      >
        {pending ? "Versturen…" : alSent ? "Demo opnieuw versturen" : "Demo versturen"}
      </button>
      <p className="mt-2 text-[11px] text-ink-300">
        Maakt een passwordless demo-account aan en stuurt een warme,
        persoonlijke mail met magic login.
      </p>
      <Feedback state={state} />
    </form>
  );
}

/* ---------- Stage handmatig aanpassen ---------- */
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
        {pending ? "…" : "Status zetten"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/* ---------- Interne taken ---------- */
export function TaskList({ leadId, tasks }: { leadId: string; tasks: JourneyTask[] }) {
  const [, action, pending] = useActionState(addTask, IDLE);
  return (
    <div>
      <ul className="space-y-1.5">
        {tasks.length === 0 && (
          <li className="text-[13px] text-ink-300">Nog geen taken.</li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2.5">
            <form action={toggleTask}>
              <input type="hidden" name="taskId" value={t.id} />
              <input type="hidden" name="leadId" value={leadId} />
              <input type="hidden" name="done" value={(!t.done).toString()} />
              <button
                type="submit"
                aria-label={t.done ? "Markeer als open" : "Markeer als gedaan"}
                className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                  t.done ? "border-sage bg-sage text-white" : "border-cream-200 bg-white hover:border-brand"
                }`}
              >
                {t.done && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </form>
            <span className={`text-[13px] ${t.done ? "text-ink-300 line-through" : "text-ink-700"}`}>
              {t.label}
            </span>
          </li>
        ))}
      </ul>
      <form action={action} className="mt-3 flex gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <input
          name="label"
          placeholder="Nieuwe taak…"
          className="flex-1 rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-300 focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-cream-100 px-3 py-1.5 text-[12px] font-bold text-ink-700 hover:bg-cream-200 disabled:opacity-60"
        >
          +
        </button>
      </form>
    </div>
  );
}
