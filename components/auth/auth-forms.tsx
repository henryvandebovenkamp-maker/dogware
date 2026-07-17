"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  acceptInvite,
  loginWithCode,
  requestLogin,
  type AuthFormState,
} from "@/app/actions/auth";
import { AuthField } from "./auth-shell";

const IDLE: AuthFormState = { status: "idle" };
const RESEND_SECONDS = 60;

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
    >
      {pending ? "Een moment…" : children}
    </button>
  );
}

/**
 * Wachtwoordloze login in twee stappen:
 * 1. e-mailadres → inlogmail met Magic Link + Magic Code
 * 2. code invoeren (of de link in de mail aanklikken)
 */
export function LoginForm() {
  const [reqState, reqAction, reqPending] = useActionState(requestLogin, IDLE);
  const [codeState, codeAction, codePending] = useActionState(loginWithCode, IDLE);
  const [cooldown, setCooldown] = useState(0);
  const [andereEmail, setAndereEmail] = useState(false);

  // Afteller voor opnieuw versturen (gestart bij submit, zie de forms)
  const sent = reqState.status === "sent" && !andereEmail;
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ---------- Stap 2: controleer je e-mail ---------- */
  if (sent && reqState.email) {
    return (
      <div>
        <h2 className="text-[15px] font-extrabold text-ink">Controleer je e-mail</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          We hebben een veilige inloglink en eenmalige code gestuurd naar{" "}
          <span className="font-semibold text-ink">{reqState.maskedEmail}</span>
          {" "}— als dit adres bij ons bekend is.
        </p>

        <form action={codeAction} className="mt-5 space-y-4">
          <input type="hidden" name="email" value={reqState.email} />
          <CodeInput name="code" />
          {codeState.message && (
            <p role="status" className="text-[13px] font-semibold text-brand-600">
              {codeState.message}
            </p>
          )}
          <SubmitButton pending={codePending}>Log in met deze code</SubmitButton>
        </form>

        <div className="mt-5 flex items-center justify-between">
          <form
            action={(fd) => {
              setCooldown(RESEND_SECONDS);
              reqAction(fd);
            }}
          >
            <input type="hidden" name="email" value={reqState.email} />
            <button
              type="submit"
              disabled={cooldown > 0 || reqPending}
              className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-500 disabled:cursor-not-allowed"
            >
              {cooldown > 0
                ? `Opnieuw versturen (${cooldown}s)`
                : "Verstuur de e-mail opnieuw"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setAndereEmail(true)}
            className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-500"
          >
            Ander e-mailadres
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Stap 1: e-mailadres ---------- */
  return (
    <form
      action={(fd) => {
        setAndereEmail(false);
        setCooldown(RESEND_SECONDS);
        reqAction(fd);
      }}
      className="space-y-4"
    >
      <p className="text-[13px] leading-relaxed text-ink-500">
        Vul je e-mailadres in. Je ontvangt direct een veilige inloglink en een
        eenmalige code — zonder wachtwoord.
      </p>
      <AuthField
        label="E-mailadres"
        name="email"
        type="email"
        placeholder="jij@bedrijf.nl"
        autoComplete="email"
      />
      {reqState.status === "error" && (
        <p role="status" className="text-[13px] font-semibold text-brand-600">
          {reqState.message}
        </p>
      )}
      <SubmitButton pending={reqPending}>Stuur mijn inloglink</SubmitButton>
    </form>
  );
}

/** Toegankelijk 6-cijferig code-invoerveld. */
function CodeInput({ name }: { name: string }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-[13px] font-semibold text-ink-700"
      >
        Eenmalige code
      </label>
      <input
        ref={ref}
        id={name}
        name={name}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
          setValue(digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits);
        }}
        placeholder="123 456"
        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-center text-2xl font-extrabold tracking-[0.35em] text-ink outline-none transition placeholder:text-ink-300/50 placeholder:tracking-[0.35em] focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

/** Uitnodiging bevestigen — zonder wachtwoord, direct ingelogd. */
export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, IDLE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-[13px] leading-relaxed text-ink-500">
        Eén klik en je partneromgeving staat klaar. Wachtwoorden bestaan niet
        bij DogWare — voortaan log je in met een veilige link of code per
        e-mail.
      </p>
      {state.status === "error" && (
        <p role="status" className="text-[13px] font-semibold text-brand-600">
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending}>Bevestig en activeer mijn account</SubmitButton>
    </form>
  );
}
