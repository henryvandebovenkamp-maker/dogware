import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-16 text-center">
      <BrandMark size={52} className="h-13 w-13" />
      <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.18em] text-brand">
        Pagina niet gevonden
      </p>
      <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        Deze pagina is er even vandoor.
      </h1>
      <p className="mt-3 max-w-md text-pretty text-ink-500">
        Misschien is de link verouderd of klopt er iets niet. Geen zorgen — we
        brengen je zo weer op de goede plek.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-brand px-6 py-3 text-[15px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600"
      >
        Terug naar de homepage
      </Link>
    </main>
  );
}
