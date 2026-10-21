"use client";

import Link from "next/link";
import { useActionState } from "react";
import { bevestigEmailActie, type EmailBevestigState } from "@/app/actions/email-wijziging";

const IDLE: EmailBevestigState = { status: "idle" };

export function BevestigEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(bevestigEmailActie, IDLE);

  if (state.status === "success") {
    return (
      <div>
        <p role="status" className="text-[14px] font-semibold text-sage-600">
          {state.message}
        </p>
        <Link
          href="/partner/login"
          className="mt-5 block w-full rounded-full bg-ink px-5 py-3 text-center text-[14px] font-bold text-cream hover:bg-ink-700"
        >
          Inloggen
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-5 py-3 text-[14px] font-bold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? "Bevestigen…" : "Bevestig mijn nieuwe e-mailadres"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-brand-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
