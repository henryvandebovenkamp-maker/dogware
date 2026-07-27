"use client";

import { useActionState } from "react";
import { bereidVoor, type GroeiState } from "@/app/actions/groei";

const IDLE: GroeiState = { status: "idle" };

/** Website lezen, analyse maken en het concept schrijven. Kan even duren. */
export function VoorbereidKnop({
  prospectId,
  opnieuw,
  uitgeschakeld,
}: {
  prospectId: string;
  opnieuw: boolean;
  uitgeschakeld?: string;
}) {
  const [state, action, pending] = useActionState(bereidVoor, IDLE);

  if (uitgeschakeld) {
    return (
      <p className="rounded-xl bg-cream-100 px-4 py-3 text-[13px] font-semibold text-ink-500 ring-1 ring-ink/5">
        {uitgeschakeld}
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="id" value={prospectId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-ink px-5 py-3 text-[15px] font-semibold leading-[1.2] text-cream shadow-[0_1px_2px_rgba(28,21,15,0.08)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending
          ? "Ik lees hun website…"
          : opnieuw
            ? "Opnieuw bekijken"
            : "Bekijk hun website en bereid voor"}
      </button>
      {pending && (
        <p className="mt-2 text-[13px] text-ink-300">
          Dit duurt een halve minuut. Ik lees hun site, kijk wat er al goed gaat en
          schrijf een concept.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-3 text-[13px] font-semibold text-brand-600">{state.message}</p>
      )}
      {state.status === "ok" && (
        <p className="mt-3 text-[13px] font-semibold text-sage-600">{state.message}</p>
      )}
    </form>
  );
}
