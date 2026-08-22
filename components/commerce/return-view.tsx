"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Terug naar het overzicht, met een zachte automatische verversing zolang de
 * webhook nog niet binnen is.
 *
 * De pagina wacht bewust op de webhook in plaats van zelf een status te
 * verzinnen. Na een aantal pogingen stoppen we met verversen: eindeloos
 * doorpollen helpt niemand, en de klant krijgt sowieso een mail zodra de
 * betaling verwerkt is.
 */
export function TerugKnop({ token, verversen }: { token: string; verversen: boolean }) {
  const router = useRouter();
  const [pogingen, setPogingen] = useState(0);
  const nogProberen = verversen && pogingen < 10;

  useEffect(() => {
    if (!nogProberen) return;
    const t = setTimeout(() => {
      setPogingen((p) => p + 1);
      router.refresh();
    }, 3000);
    return () => clearTimeout(t);
  }, [nogProberen, pogingen, router]);

  return (
    <div className="mt-7 flex flex-wrap items-center gap-4">
      <a
        href={`/traject/${token}`}
        className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-600"
      >
        Terug naar je overzicht
      </a>
      {nogProberen && (
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          We kijken of de bevestiging al binnen is…
        </span>
      )}
    </div>
  );
}
