"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";

/**
 * Nette, menselijke foutpagina. Toont nooit technische details aan de bezoeker;
 * de echte fout gaat naar de serverlogs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        evt: "client_error",
        at: new Date().toISOString(),
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-16 text-center">
      <BrandMark size={52} className="h-13 w-13" />
      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-brand">
        Er ging iets mis
      </p>
      <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        Sorry, hier liep het even vast.
      </h1>
      <p className="mt-3 max-w-md text-pretty text-ink-500">
        We konden deze pagina even niet laden. Probeer het opnieuw — lukt het
        daarna nog niet, laat het ons dan gerust weten.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600"
        >
          Probeer opnieuw
        </button>
        <Link
          href="/"
          className="rounded-full px-6 py-3 text-[15px] font-semibold text-ink-500 ring-1 ring-ink/10 transition hover:ring-ink/25"
        >
          Naar de homepage
        </Link>
      </div>
    </main>
  );
}
