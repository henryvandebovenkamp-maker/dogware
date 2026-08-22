"use client";

import { Printer } from "lucide-react";

/**
 * Afdrukken of opslaan als PDF.
 *
 * Bewust de printfunctie van de browser in plaats van een eigen PDF-generator:
 * dat scheelt een afhankelijkheid die we alleen voor opmaak zouden binnenhalen,
 * en het werkt overal, ook op een telefoon.
 */
export function PrintKnop() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-cream transition hover:bg-ink-700"
    >
      <Printer className="h-3.5 w-3.5" />
      Afdrukken of opslaan als PDF
    </button>
  );
}
