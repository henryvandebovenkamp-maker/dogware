import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { NieuweKlantForm } from "./nieuwe-klant-form";

export const metadata: Metadata = {
  title: "Nieuwe klant",
  robots: { index: false, follow: false },
};

/**
 * Nieuwe klant toevoegen — voor wie al akkoord is en geen voorbeeldwebsite
 * hoeft te zien. Bewust kort: na opslaan ga je meteen door naar de
 * opdrachtbevestiging.
 */
export default async function NieuweKlantPage() {
  await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-xl pb-20">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" /> Alle aanvragen
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Nieuwe klant toevoegen</h1>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">
        Voor een klant met wie je al gesproken hebt en die geen voorbeeldwebsite nodig heeft. Na
        opslaan leg je meteen de opdrachtbevestiging vast en verstuur je die ter ondertekening.
      </p>
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <NieuweKlantForm />
      </div>
    </main>
  );
}
