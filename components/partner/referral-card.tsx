"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { GlyphCheck } from "@/components/demo/illustrations";

/**
 * Warme referral-kaart: persoonlijke link + code met kopieerknoppen, en een
 * QR-code (download + vergroten). QR wordt server-side als data-URL aangeleverd.
 */
export function ReferralCard({
  link,
  code,
  qrDataUrl,
}: {
  link: string;
  code: string;
  qrDataUrl: string;
  }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [zoom, setZoom] = useState(false);

  // Modal sluitbaar met Escape (toetsenbordtoegankelijkheid)
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  async function copy(value: string, which: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* stil */
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-ink/5">
      <div className="h-1.5 bg-gradient-to-r from-brand to-sage" />
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-7">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold text-ink">Mijn referral</h2>
          <p className="mt-1 text-[13px] text-ink-500">
            Deel deze link of code. Iedereen die zo binnenkomt, koppel ik
            persoonlijk aan jou.
          </p>

          {/* Link */}
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Persoonlijke partnerlink
          </p>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-xl bg-cream px-3.5 py-2.5 ring-1 ring-ink/5">
              <span className="truncate font-mono text-[13px] font-semibold text-brand">
                {link.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copy(link, "link")}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-cream transition hover:bg-ink-700"
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

          {/* Code */}
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Referralcode
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-xl bg-cream px-3.5 py-2 font-mono text-[15px] font-extrabold tracking-wider text-ink ring-1 ring-ink/5">
              {code}
            </span>
            <button
              type="button"
              onClick={() => copy(code, "code")}
              className="rounded-xl bg-cream-100 px-4 py-2 text-[13px] font-bold text-ink-700 transition hover:bg-cream-200"
            >
              {copied === "code" ? "Gekopieerd" : "Kopieer code"}
            </button>
          </div>
        </div>

        {/* QR-code */}
        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="rounded-2xl bg-white p-2.5 ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:shadow-lift"
            aria-label="QR-code groter openen"
          >
            <Image src={qrDataUrl} alt="QR-code van jouw partnerlink" width={128} height={128} unoptimized />
          </button>
          <div className="flex gap-2">
            <a
              href={qrDataUrl}
              download={`dogware-${code}.png`}
              className="rounded-full bg-cream-100 px-3 py-1.5 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200"
            >
              Download
            </a>
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="rounded-full bg-cream-100 px-3 py-1.5 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200"
            >
              Vergroot
            </button>
          </div>
        </div>
      </div>

      {/* Vergroot-overlay */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-xs overflow-auto rounded-3xl bg-white p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={qrDataUrl}
              alt="QR-code van jouw partnerlink"
              width={320}
              height={320}
              unoptimized
              className="h-auto w-full"
            />
            <p className="mt-3 text-center font-mono text-[13px] font-semibold text-ink-500">
              {code}
            </p>
            <button
              type="button"
              onClick={() => setZoom(false)}
              className="mt-3 w-full rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-cream hover:bg-ink-700"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
