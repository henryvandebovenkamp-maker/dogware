import type { Metadata } from "next";
import Link from "next/link";
import { requirePartner } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/partner", label: "Overzicht" },
  { href: "/partner/aanvragen", label: "Aanvragen" },
  { href: "/partner/materialen", label: "Materialen" },
  { href: "/partner/profiel", label: "Profiel" },
];

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePartner();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-cream-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/partner" className="flex items-center gap-2.5">
            <BrandMark size={32} className="h-8 w-8" />
            <span className="text-[15px] font-extrabold tracking-tight text-ink">
              Dog<span className="text-brand">Ware</span>{" "}
              <span className="font-semibold text-ink-300">Partner</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] font-semibold text-ink-500 sm:block">
              {user.naam}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-brand-600"
              >
                Uitloggen
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-semibold text-ink-500 transition-colors hover:bg-cream hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-8">{children}</main>
    </div>
  );
}
