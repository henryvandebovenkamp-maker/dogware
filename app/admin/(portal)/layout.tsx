import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand";
import {
  GlyphAgenda,
  GlyphCard,
  GlyphClients,
  GlyphPaw,
  GlyphPay,
  GlyphPortal,
  GlyphSpark,
  GlyphTeam,
} from "@/components/demo/illustrations";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Overzicht", Icon: GlyphPaw },
  { href: "/admin/leads", label: "Demo-aanvragen", Icon: GlyphClients },
  { href: "/admin/partners", label: "Partners", Icon: GlyphTeam },
  { href: "/admin/referrals", label: "Referrals", Icon: GlyphSpark },
  { href: "/admin/klanten", label: "Klanten", Icon: GlyphPortal },
  { href: "/admin/facturen", label: "Facturen", Icon: GlyphPay },
  { href: "/admin/test-email", label: "E-mails", Icon: GlyphCard },
  { href: "/admin/activiteit", label: "Activiteit", Icon: GlyphAgenda },
  { href: "/admin/instellingen", label: "Instellingen", Icon: GlyphPortal },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Zijbalk */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-cream-200 bg-white/70 px-4 py-6 backdrop-blur md:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-2">
          <BrandMark size={32} className="h-8 w-8" />
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            Dog<span className="text-brand">Ware</span>{" "}
            <span className="font-semibold text-ink-300">Beheer</span>
          </span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-ink-500 transition-colors hover:bg-cream hover:text-ink"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-cream-200 pt-4">
          <p className="truncate px-3 text-[12px] font-semibold text-ink-500">
            {user.naam}
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 px-3 text-[12px] font-semibold text-ink-300 transition-colors hover:text-brand-600"
            >
              Uitloggen
            </button>
          </form>
        </div>
      </aside>

      {/* Mobiele topbalk */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-cream-200 bg-white/70 px-5 py-3 backdrop-blur md:hidden">
          <Link href="/admin" className="flex items-center gap-2">
            <BrandMark size={28} className="h-7 w-7" />
            <span className="text-sm font-extrabold text-ink">Beheer</span>
          </Link>
          <form action={logout}>
            <button type="submit" className="text-[12px] font-semibold text-ink-300">
              Uitloggen
            </button>
          </form>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-cream-200 bg-white/60 px-3 py-2 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-500 hover:bg-cream"
            >
              {label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
