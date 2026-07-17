"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/cn";

const NAV = [
  { label: "Platform", href: "#oplossing" },
  { label: "Modules", href: "#modules" },
  { label: "Webshop", href: "#webshop" },
  { label: "Betalingen", href: "#betalingen" },
  { label: "Waarom DogWare", href: "#verschil" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto mt-3 flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-300 sm:px-5",
          scrolled
            ? "bg-cream/85 shadow-lift ring-1 ring-ink/5 backdrop-blur-xl mx-3 sm:mx-auto"
            : "bg-transparent",
        )}
      >
        <Link href="#top" aria-label="DogWare home" className="shrink-0">
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

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/demo"
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:text-ink"
          >
            Inloggen
          </Link>
          <Link
            href="/demo"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_-12px_rgba(224,86,42,0.85)] transition-all hover:-translate-y-0.5 hover:bg-brand-600"
          >
            Vraag een demo aan
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menu sluiten" : "Menu openen"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink ring-1 ring-ink/10 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 top-0 z-40 bg-cream/98 px-5 pt-24 backdrop-blur-xl lg:hidden">
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
            <Link
              href="/demo"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-full bg-brand px-6 py-4 text-center text-base font-semibold text-white shadow-glow"
            >
              Vraag een demo aan
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
