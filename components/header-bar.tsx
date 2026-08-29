"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X, ChevronDown, LogOut } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui";
import { logout } from "@/app/actions/auth";
import { HOOFDNAV, type NavGroep } from "@/lib/nav";
import { cn } from "@/lib/cn";

/**
 * Eén item uit de bovenste rij. Zonder `items` is het een gewone link; mét
 * `items` klapt er een rustige lijst onder uit.
 *
 * De uitklap opent op hover én op klik, en sluit op Escape, bij een klik
 * buiten en zodra de muis het hele blok verlaat. Die drie samen voorkomen het
 * klassieke euvel dat een menu blijft hangen nadat je er langs bent gegaan.
 */
function NavGroepItem({
  groep,
  open,
  onOpen,
  onSluit,
}: {
  groep: NavGroep;
  open: boolean;
  onOpen: () => void;
  onSluit: () => void;
}) {
  const panelId = useId();

  if (!groep.items) {
    return (
      <Link
        href={groep.href}
        onClick={onSluit}
        className="whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium text-ink-700 transition-colors hover:bg-white/70 hover:text-ink xl:text-sm"
      >
        {groep.label}
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onSluit}
      onFocus={onOpen}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onSluit() : onOpen())}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors hover:bg-white/70 hover:text-ink xl:text-sm",
          open ? "bg-white/70 text-ink" : "text-ink-700",
        )}
      >
        {groep.label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 text-ink-300 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2"
        >
          <div
            className={cn(
              "overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink/5",
              groep.items.length > 5 ? "w-[30rem]" : "w-[17rem]",
            )}
          >
            <div
              className={cn(
                "p-2",
                // Eén kolom bij een kort lijstje, twee zodra het er meer zijn —
                // zo blijft het een menu en wordt het nooit een megamenu.
                groep.items.length > 5
                  ? "grid grid-cols-2 gap-0.5"
                  : "flex flex-col gap-0.5",
              )}
            >
              {groep.items.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={onSluit}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-cream hover:text-ink"
                >
                  {item.icon && (
                    <item.icon className="h-4 w-4 shrink-0 text-brand" />
                  )}
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              ))}
            </div>

            {groep.meer && (
              <Link
                href={groep.meer.href}
                onClick={onSluit}
                className="block border-t border-cream-200 bg-cream/50 px-5 py-2.5 text-[12px] font-bold text-brand transition-colors hover:bg-cream hover:text-brand-600"
              >
                {groep.meer.label} →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  // Label van de uitgeklapte navigatiegroep; er staat er altijd hoogstens één
  // open, anders overlappen twee panelen elkaar bij snel langsbewegen.
  const [navOpen, setNavOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

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

  // Navigatie-uitklap sluit bij klik buiten en bij Escape. Zonder dit blijft
  // een op klik geopend paneel staan zodra de muis er niet meer overheen ging.
  useEffect(() => {
    if (!navOpen) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

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

        {/* Het breekpunt is opgemeten en niet gegokt: vijf items plus
            "Inloggen" en de demoknop vragen ~1057px en passen daarmee pas
            vanaf ongeveer 1100px viewport. Daaronder neemt de hamburger het
            over — de demoknop blijft daar wél gewoon staan, zodat de
            conversieroute nergens verdwijnt. Tussen 1100 en 1280 staan de
            items wat krapper; vanaf xl krijgen ze lucht. */}
        <nav
          ref={navRef}
          aria-label="Hoofdnavigatie"
          className="hidden items-center gap-0 min-[1100px]:flex xl:gap-0.5"
        >
          {HOOFDNAV.map((groep) => (
            <NavGroepItem
              key={groep.label}
              groep={groep}
              open={navOpen === groep.label}
              onOpen={() => setNavOpen(groep.label)}
              onSluit={() => setNavOpen(null)}
            />
          ))}
        </nav>

        {/* Rechterkant desktop */}
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <div className="relative" ref={accountRef}>
              {/* Alleen de initiaal, geen naam en rol ernaast. De balk is
                  afgetopt op max-w-6xl, dus de ruimte groeit niet mee met het
                  scherm: mét naam erbij loopt de rij op élke breedte over de
                  demoknop heen. Naam en rol staan gewoon bovenin de uitklap
                  hieronder, dus er gaat niets verloren. */}
              <button
                type="button"
                onClick={() => setAccount((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={account}
                aria-label={`Account van ${voornaam}`}
                className="flex items-center gap-1.5 rounded-full bg-white/70 py-1.5 pl-1.5 pr-2 ring-1 ring-ink/10 transition hover:bg-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[13px] font-extrabold text-white">
                  {initiaal}
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
              className="whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:text-ink xl:px-4 xl:text-sm"
            >
              Inloggen
            </Link>
          )}
          <Button
            href="/demo"
            variant="primary"
            size="md"
            className="whitespace-nowrap"
          >
            Vraag een demo aan
          </Button>
        </div>

        {/* Hamburger mobiel */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menu sluiten" : "Menu openen"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink ring-1 ring-ink/10 min-[1100px]:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobiel menu */}
      {open && (
        <div className="fixed inset-0 top-0 z-40 overflow-y-auto bg-cream/98 px-5 pb-10 pt-24 backdrop-blur-xl min-[1100px]:hidden">
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

          {/* Mobiel klapt niets uit: alles staat meteen uitgeschreven, zodat
              dezelfde onderwerpen in één blik bereikbaar zijn zonder tikken op
              een chevron. De groepskop is zelf ook gewoon een link. */}
          <nav aria-label="Hoofdnavigatie" className="flex flex-col gap-1">
            {HOOFDNAV.map((groep) => (
              <div key={groep.label}>
                <Link
                  href={groep.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3.5 text-lg font-semibold text-ink transition-colors hover:bg-white"
                >
                  {groep.label}
                </Link>

                {groep.items && (
                  <div className="mb-2 ml-4 flex flex-wrap gap-1.5 px-0 pb-1">
                    {groep.items.map((item) => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-700 ring-1 ring-ink/5 transition-colors hover:text-ink"
                      >
                        {item.icon && (
                          <item.icon className="h-3.5 w-3.5 shrink-0 text-brand" />
                        )}
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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

            <Button
              href="/demo"
              variant="primary"
              size="lg"
              onClick={() => setOpen(false)}
              className="mt-3 w-full"
            >
              Vraag een demo aan
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
