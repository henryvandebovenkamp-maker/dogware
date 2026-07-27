import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { NieuwBedrijfForm } from "./nieuw-form";

export const metadata = { title: "Bedrijf toevoegen" };

export default async function NieuwBedrijfPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/groei/bedrijven"
        className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink"
      >
        ← Bedrijven
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">
        Een collega toevoegen
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-500">
        Eén tegelijk, met aandacht. Er zit bewust geen massale import in: dit systeem is
        gemaakt om tien bedrijven goed te benaderen, niet duizend slecht.
      </p>

      <NieuwBedrijfForm />
    </div>
  );
}
