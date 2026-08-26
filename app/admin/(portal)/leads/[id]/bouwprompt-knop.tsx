"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, X } from "lucide-react";

/**
 * "Kopieer bouwprompt" — knop, voorvertoning en kopiëren.
 *
 * De prompt is op de server al samengesteld uit de aanvraag; dit component
 * toont hem en zet hem op het klembord. Verder gebeurt er niets: er wordt niets
 * aangemaakt, verstuurd of opgeslagen.
 *
 * De voorvertoning zit erin omdat je vóór het plakken wilt kunnen zien wat er
 * in staat — vooral welke velden "Niet aangeleverd" zijn.
 */
export function BouwpromptKnop({
  bedrijfsnaam,
  prompt,
}: {
  bedrijfsnaam: string;
  prompt: string;
}) {
  const [open, setOpen] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [mislukt, setMislukt] = useState(false);
  const dialoog = useRef<HTMLDivElement>(null);

  // Escape sluit, en zolang het paneel openstaat scrollt de pagina eronder niet
  // mee — anders raak je bij een prompt van deze lengte de knoppen kwijt.
  useEffect(() => {
    if (!open) return;
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", opToets);
    const vorige = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialoog.current?.focus();
    return () => {
      document.removeEventListener("keydown", opToets);
      document.body.style.overflow = vorige;
    };
  }, [open]);

  async function kopieer() {
    setMislukt(false);
    try {
      await navigator.clipboard.writeText(prompt);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      // Zonder klembord (geen https, geen toestemming) is de tekst nog altijd
      // met de hand te selecteren; dat is beter dan een knop die stil niets doet.
      setMislukt(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-cream transition hover:bg-ink-700"
      >
        <Copy className="h-4 w-4" />
        Kopieer bouwprompt
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialoog}
            role="dialog"
            aria-modal="true"
            aria-label={`Bouwprompt voor ${bedrijfsnaam}`}
            tabIndex={-1}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl outline-none sm:max-h-[85vh] sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-cream-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-wide text-ink-300">
                  Bouwprompt voor
                </p>
                <p className="truncate text-[16px] font-extrabold text-ink">{bedrijfsnaam}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sluiten"
                className="shrink-0 rounded-full p-1.5 text-ink-300 transition hover:bg-cream-100 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-5 py-4 text-[12px] leading-relaxed text-ink-700">
              {prompt}
            </pre>

            <div className="flex flex-wrap items-center gap-3 border-t border-cream-100 px-5 py-4">
              <button
                type="button"
                onClick={kopieer}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-600"
              >
                <Copy className="h-4 w-4" />
                Kopiëren
              </button>
              {gekopieerd && (
                <span className="text-[13px] font-bold text-sage-600">✓ Prompt gekopieerd</span>
              )}
              {mislukt && (
                <span className="text-[12.5px] font-semibold text-brand-600">
                  Kopiëren lukte niet — selecteer de tekst hierboven en kopieer met ⌘C.
                </span>
              )}
              <span className="ml-auto text-[11.5px] text-ink-300">
                Plak deze tekst in het nieuwe klantproject.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
