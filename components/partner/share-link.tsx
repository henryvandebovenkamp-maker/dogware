"use client";

import { useState } from "react";
import { GlyphArrow, GlyphCheck } from "@/components/demo/illustrations";

/** Standaarddeeltekst — kopieerbaar, niet aanpasbaar. */
export function shareText(link: string): string {
  return `Benieuwd hoeveel tijd DogWare jouw hondenbedrijf kan besparen? Vraag via mijn persoonlijke link een vrijblijvende demo aan en ontdek hoe jouw website, planning, administratie en klantcontact in één omgeving kunnen samenwerken: ${link}`;
}

export function ShareLink({ link }: { link: string }) {
  const [copied, setCopied] = useState<"link" | "tekst" | null>(null);

  async function copy(value: string, which: "link" | "tekst") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // stil falen — selectie blijft mogelijk
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "DogWare — Meer tijd voor wat telt",
          text: shareText(link),
          url: link,
        });
      } catch {
        // gebruiker annuleerde — geen actie nodig
      }
    } else {
      copy(link, "link");
    }
  }

  const encoded = encodeURIComponent(shareText(link));

  return (
    <div>
      {/* De link zelf, prominent */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5">
          <span className="truncate font-mono text-[14px] font-semibold text-brand">
            {link.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => copy(link, "link")}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-[14px] font-bold text-cream transition-all hover:bg-ink-700"
        >
          {copied === "link" ? (
            <>
              <GlyphCheck className="h-4 w-4" /> Gekopieerd
            </>
          ) : (
            "Kopieer link"
          )}
        </button>
      </div>

      {/* Deelknoppen */}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5"
        >
          WhatsApp
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5"
        >
          LinkedIn
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent("Tip: DogWare voor jouw hondenbedrijf")}&body=${encoded}`}
          className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5"
        >
          E-mail
        </a>
        <button
          type="button"
          onClick={nativeShare}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5"
        >
          Delen <GlyphArrow className="h-3.5 w-3.5" />
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full px-4 py-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
        >
          Bekijk de demopagina →
        </a>
      </div>

      {/* Deeltekst */}
      <div className="mt-4 rounded-2xl bg-cream/70 p-4 ring-1 ring-ink/5">
        <p className="text-[13px] leading-relaxed text-ink-500">{shareText(link)}</p>
        <button
          type="button"
          onClick={() => copy(shareText(link), "tekst")}
          className="mt-2 text-[12px] font-bold text-brand hover:text-brand-600"
        >
          {copied === "tekst" ? "✓ Tekst gekopieerd" : "Kopieer deeltekst"}
        </button>
      </div>
    </div>
  );
}
