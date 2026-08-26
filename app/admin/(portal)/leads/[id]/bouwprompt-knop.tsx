"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Eye, X } from "lucide-react";
import { haalBouwprompt } from "./actions";

/**
 * De bouwprompt bekijken en kopiëren.
 *
 * Twee knoppen, met opzet. "Bekijk" omdat je vóór het plakken wilt kunnen zien
 * wat erin staat — vooral welke velden "Niet aangeleverd" zijn, want dat is
 * precies wat je nog bij de klant moet ophalen. "Kopieer" omdat je die stap na
 * de eerste keer niet meer nodig hebt.
 *
 * De tekst wordt bij het klikken opgehaald, niet bij het laden van de pagina:
 * zo is hij altijd van de aanvraag zoals die op dát moment is.
 *
 * Er gebeurt hier verder niets. Geen map, geen repository, geen database, geen
 * mail. Dit levert tekst op; wat ermee gebeurt bepaal je zelf.
 */
export function BouwpromptKnop({
  leadId,
  bedrijfsnaam,
}: {
  leadId: string;
  bedrijfsnaam: string;
}) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);
  const dialoog = useRef<HTMLDivElement>(null);

  /**
   * Eén keer ophalen per keer dat je erop klikt. Het resultaat blijft daarna
   * staan: binnen hetzelfde bezoek verandert de aanvraag niet vanzelf, en twee
   * keer wachten voor dezelfde tekst is onnodig.
   */
  const ophalen = useCallback(async (): Promise<string | null> => {
    if (prompt) return prompt;
    setBezig(true);
    setFout(null);
    try {
      const resultaat = await haalBouwprompt(leadId);
      if (!resultaat.ok) {
        setFout(resultaat.message);
        return null;
      }
      setPrompt(resultaat.prompt);
      return resultaat.prompt;
    } catch {
      setFout("Ophalen mislukt. Probeer het opnieuw.");
      return null;
    } finally {
      setBezig(false);
    }
  }, [leadId, prompt]);

  async function bekijk() {
    if (await ophalen()) setOpen(true);
  }

  async function kopieer() {
    const tekst = await ophalen();
    if (!tekst) return;
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      // Zonder klembord (geen https, geen toestemming) is de tekst nog altijd
      // met de hand te selecteren; dat is beter dan een knop die stil niets doet.
      setFout("Kopiëren lukte niet — open de prompt en kopieer met ⌘C.");
      setOpen(true);
    }
  }

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

  return (
    <>
      <button
        type="button"
        onClick={bekijk}
        disabled={bezig}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-50"
      >
        <Eye className="h-4 w-4" />
        Bekijk bouwprompt
      </button>

      <button
        type="button"
        onClick={kopieer}
        disabled={bezig}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-ink-500 ring-1 ring-ink/10 transition hover:bg-cream-100 hover:text-ink disabled:opacity-50"
      >
        <Copy className="h-4 w-4" />
        Kopieer prompt
      </button>

      {gekopieerd && (
        <span className="text-[13px] font-bold text-sage-600">✓ Prompt gekopieerd</span>
      )}
      {fout && !open && (
        <span className="text-[12.5px] font-semibold text-brand-600">{fout}</span>
      )}

      {open && prompt && (
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
                Kopieer prompt
              </button>
              {gekopieerd && (
                <span className="text-[13px] font-bold text-sage-600">✓ Prompt gekopieerd</span>
              )}
              {fout && (
                <span className="text-[12.5px] font-semibold text-brand-600">{fout}</span>
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
