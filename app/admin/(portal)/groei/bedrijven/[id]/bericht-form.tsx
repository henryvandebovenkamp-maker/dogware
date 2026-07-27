"use client";

import { useActionState, useState } from "react";
import { verstuurBericht, type GroeiState } from "@/app/actions/groei";

const IDLE: GroeiState = { status: "idle" };

/**
 * Het conceptbericht. Henry leest, past aan waar hij wil, en beslist.
 * De knop gaat alleen open als het verzendslot dat toestaat.
 */
export function BerichtForm({
  berichtId,
  onderwerp,
  tekst,
  voorstelLink,
  mag,
  reden,
  uitleg,
}: {
  berichtId: string;
  onderwerp: string;
  tekst: string;
  voorstelLink: string | null;
  mag: boolean;
  reden?: string;
  uitleg?: string;
}) {
  const [state, action, pending] = useActionState(verstuurBericht, IDLE);
  const [body, setBody] = useState(tekst);
  const aangepast = body !== tekst;

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="berichtId" value={berichtId} />

      <label className="block text-[12px] font-bold text-ink-500" htmlFor="onderwerp">
        Onderwerp
      </label>
      <input
        id="onderwerp"
        name="onderwerp"
        defaultValue={onderwerp}
        className="mt-1.5 w-full rounded-xl bg-cream px-4 py-2.5 text-[15px] font-semibold text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-brand/40"
      />

      <label className="mt-4 block text-[12px] font-bold text-ink-500" htmlFor="tekst">
        Bericht
      </label>
      <textarea
        id="tekst"
        name="tekst"
        rows={16}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-1.5 w-full resize-y rounded-xl bg-cream px-4 py-3 font-sans text-[15px] leading-relaxed text-ink outline-none ring-1 ring-ink/10 focus:ring-2 focus:ring-brand/40"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-300">
        <span>
          {aangepast ? "Je hebt dit bericht aangepast." : "Nog niet aangepast."}
        </span>
        {voorstelLink && (
          <span>
            <code className="rounded bg-cream-100 px-1.5 py-0.5 font-mono">
              {"{{voorstel}}"}
            </code>{" "}
            wordt vervangen door de link naar het voorstel.
          </span>
        )}
      </div>

      {state.status === "error" && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-600 ring-1 ring-brand/15">
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p className="mt-4 rounded-xl bg-sage-100 px-4 py-3 text-[13px] font-semibold text-sage-600">
          {state.message}
        </p>
      )}

      {mag ? (
        <button
          type="submit"
          disabled={pending}
          className="mt-5 rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold leading-[1.2] text-white shadow-[0_1px_2px_rgba(28,21,15,0.08)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Versturen…" : "Versturen namens jou"}
        </button>
      ) : (
        <div className="mt-5 rounded-xl bg-cream-100 px-4 py-3.5 ring-1 ring-ink/5">
          <p className="text-[13px] font-bold text-ink">Verzenden is geblokkeerd</p>
          <p className="text-[13px] font-semibold text-brand-600">{reden}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{uitleg}</p>
        </div>
      )}
    </form>
  );
}
