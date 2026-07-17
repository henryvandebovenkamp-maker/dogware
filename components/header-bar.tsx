"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, LogOut } from "lucide-react";
import { Logo } from "@/components/brand";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { label: "Platform", href: "#oplossing" },
  { label: "Modules", href: "#modules" },
  { label: "Webshop", href: "#webshop" },
  { label: "Betalingen", href: "#betalingen" },
  { label: "Waarom DogWare", href: "#verschil" },
];

export type HeaderUser = {
  naam: string;
  roleLabel: string;
  homeHref: string;
  homeLabel: string;
};

export function HeaderBar({
  user,
  loginHref,
}: {
  user: HeaderUser | null;
  loginHref: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false); // mobiel menu
  const [account, setAccount] = useState(false); // desktop dropdown
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobiel menu: achtergrond niet laten scrollen
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Dropdown sluit bij klik buiten en bij Escape
  useEffect(() => {
    if (!account) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccount(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccount(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [account]);

  const voornaam = user?.naam.split(" ")[0] ?? "";
  const initiaal = (voornaam || "?").charAt(0).toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-300 sm:px-5",
          scrolled
            ? "mx-3 bg-cream/85 shadow-lift ring-1 ring-ink/5 backdrop-blur-xl sm:mx-auto"
            : "bg-transparent",
        )}
      >
        <Link href="/" aria-label="DogWare home" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-white/70 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Rechterkant desktop */}
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccount((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={account}
                className="flex items-center gap-2.5 rounded-full bg-white/70 py-1.5 pl-1.5 pr-3 ring-1 ring-ink/10 transition hover:bg-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[13px] font-extrabold text-white">
                  {initiaal}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[13px] font-bold text-ink">{voornaam}</span>
                  <span className="block text-[11px] font-semibold text-ink-300">{user.roleLabel}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 text-ink-300 transition-transform", account && "rotate-180")} />
              </button>

              {account && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink/5"
                >
                  <div className="border-b border-cream-100 px-4 py-3">
                    <p className="truncate text-[13px] font-bold text-ink">{user.naam}</p>
                    <p className="text-[12px] font-semibold text-ink-300">{user.roleLabel}</p>
                  </div>
                  <Link
                    href={user.homeHref}
                    role="menuitem"
                    onClick={() => setAccount(false)}
                    className="block px-4 py-2.5 text-[14px] font-semibold text-ink transition hover:bg-cream"
                  >
                    {user.homeLabel}
                  </Link>
                  <form action={logout}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] font-semibold text-ink-500 transition hover:bg-cream hover:text-brand-600"
                    >
                      <LogOut className="h-4 w-4" /> Uitloggen
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={loginHref}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:text-ink"
            >
              Inloggen
            </Link>
          )}
          <Link
            href="/demo"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(224,86,42,0.85)] transition-all hover:-translate-y-0.5 hover:bg-brand-600"
          >
            Vraag een demo aan
          </Link>
        </div>

        {/* Hamburger mobiel */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menu sluiten" : "Menu openen"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink ring-1 ring-ink/10 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobiel menu */}
      {open && (
        <div className="fixed inset-0 top-0 z-40 overflow-y-auto bg-cream/98 px-5 pb-10 pt-24 backdrop-blur-xl lg:hidden">
          {/* Ingelogd: accountblok bovenaan */}
          {user && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-[15px] font-extrabold text-white">
                {initiaal}
              </span>
              <span className="leading-tight">
                <span className="block text-[15px] font-extrabold text-ink">{user.naam}</span>
                <span className="block text-[12px] font-semibold text-ink-300">{user.roleLabel}</span>
              </span>
            </div>
          )}

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-4 text-lg font-semibold text-ink transition-colors hover:bg-white"
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <>
                <Link
                  href={user.homeHref}
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-2xl bg-ink px-4 py-4 text-center text-base font-bold text-cream"
                >
                  {user.homeLabel}
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold text-ink-500"
                  >
                    <LogOut className="h-5 w-5" /> Uitloggen
                  </button>
                </form>
              </>
            ) : (
              <Link
                href={loginHref}
                onClick={() => setOpen(false)}
                className="mt-2 rounded-2xl px-4 py-4 text-center text-lg font-semibold text-ink ring-1 ring-ink/10"
              >
                Inloggen
              </Link>
            )}

            <Link
              href="/demo"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-brand px-6 py-4 text-center text-base font-semibold text-white shadow-glow"
            >
              Vraag een demo aan
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
