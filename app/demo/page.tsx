import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { DemoExperience } from "@/components/demo/experience";

export const metadata: Metadata = {
  title: "Bouw jouw DogWare",
  description:
    "Bouw in een paar minuten jouw eigen DogWare-omgeving en ontvang binnen 24 uur een kosteloos voorbeeld. Geen offerte — je zit nergens aan vast.",
};

export default function DemoPage() {
  return (
    <div className="relative min-h-screen">
      {/* Rustige achtergrond — geen afleiding */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[480px] w-[640px] rounded-full bg-brand-50 blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[520px] rounded-full bg-sage-100/50 blur-3xl" />
      </div>

      {/* Minimale topbalk: alleen logo en een stille uitgang */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-7 sm:px-8">
        <Link href="/" aria-label="Terug naar de homepage">
          <Logo />
        </Link>
        <Link
          href="/"
          className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-500"
        >
          terug naar de site
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <DemoExperience />
      </main>
    </div>
  );
}
