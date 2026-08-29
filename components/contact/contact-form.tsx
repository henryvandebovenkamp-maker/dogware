"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { submitContact, type ContactState } from "@/app/actions/contact";

const IDLE: ContactState = { status: "idle" };

const veldClasses =
  "w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-semibold text-ink-700"
    >
      {children}
    </label>
  );
}

/**
 * Vanaf welke eigen pagina kwam de bezoeker hierheen? Handig bij het
 * beantwoorden ("hij las over trimsalons"). Bewust pas bij het versturen
 * bepaald, en uitsluitend eigen paden — nooit een externe URL doorgeven.
 */
function eigenHerkomst(): string {
  try {
    const ref = document.referrer;
    if (!ref) return "";
    const url = new URL(ref);
    return url.origin === window.location.origin ? url.pathname : "";
  } catch {
    return "";
  }
}

/**
 * Het contactformulier. Vier velden, waarvan er één optioneel is — meer heeft
 * een gesprek niet nodig. De inzending loopt via de bestaande mailservice
 * (zie app/actions/contact.ts), dus hier zit geen eigen opslag of logica.
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, IDLE);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-ink/5 sm:p-8"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-sage">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-xl font-extrabold tracking-tight text-ink">
          Je bericht is binnen 🐾
        </h2>
        <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-500">
          Het komt rechtstreeks bij mij binnen, niet bij een helpdesk. Ik lees
          het zelf en reageer persoonlijk. Je krijgt ook een bevestiging in je
          mailbox.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("herkomst", eigenHerkomst());
        formAction(fd);
      }}
      className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-8"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-ink">
        Stuur me een bericht
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-500">
        Geen verplicht veld te veel. Je hoort van mij, niet van een
        automatische afhandeling.
      </p>

      {/* Honeypot: onzichtbaar voor mensen, aantrekkelijk voor bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="bedrijf">Bedrijf</label>
        <input id="bedrijf" name="bedrijf" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="naam">Je naam</Label>
          <input
            id="naam"
            name="naam"
            type="text"
            required
            autoComplete="name"
            placeholder="Bijvoorbeeld: Sanne Bakker"
            className={veldClasses}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">E-mailadres</Label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="jij@jouwbedrijf.nl"
              className={veldClasses}
            />
          </div>
          <div>
            <Label htmlFor="telefoon">
              Telefoonnummer{" "}
              <span className="font-medium text-ink-300">(optioneel)</span>
            </Label>
            <input
              id="telefoon"
              name="telefoon"
              type="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              className={veldClasses}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bericht">Waar gaat het over?</Label>
          <textarea
            id="bericht"
            name="bericht"
            required
            rows={5}
            maxLength={5000}
            placeholder="Vertel gerust kort wat voor bedrijf je hebt en waar je tegenaan loopt. Dan kan ik meteen iets zinnigs zeggen."
            className={`${veldClasses} resize-y leading-relaxed`}
          />
        </div>
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="mt-4 text-[14px] font-semibold text-brand-600">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-px hover:bg-brand-600 hover:shadow-[0_6px_16px_-6px_rgba(224,86,42,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 sm:w-auto"
      >
        {pending ? "Een moment…" : "Verstuur mijn bericht"}
        {!pending && (
          <Send className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        )}
      </button>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-300">
        Je gegevens gebruik ik alleen om je vraag te beantwoorden. Meer daarover
        in de{" "}
        <Link href="/privacy" className="font-semibold underline hover:text-ink-500">
          privacyverklaring
        </Link>
        .
      </p>
    </form>
  );
}
