import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Logo } from "@/components/brand";
import { Container } from "@/components/ui";
import { branding } from "@/lib/branding";
import { BRANCHES } from "@/lib/branches";
import { NEEDS } from "@/lib/needs";

/**
 * De branche- en oplossingskolommen komen rechtstreeks uit lib/branches.ts en
 * lib/needs.ts, zodat een nieuwe branche automatisch in de footer verschijnt
 * en er nergens dubbele lijstjes ontstaan.
 */
const COLS = [
  {
    title: "Voor wie",
    links: BRANCHES.map((b) => ({ label: b.naam, href: b.path })),
  },
  {
    title: "Oplossingen",
    links: NEEDS.slice(0, 6).map((n) => ({ label: n.titel, href: n.path })),
  },
  {
    title: "DogWare",
    links: [
      { label: "Waarom DogWare", href: "/#verschil" },
      { label: "Alle branches", href: "/#branches" },
      { label: "Demo aanvragen", href: "/demo" },
      { label: "Partner inloggen", href: "/partner/login" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-cream-200 bg-cream py-14">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-ink-500">
              Het complete bedrijfsplatform voor de hondenbranche. Meer tijd voor
              honden. Minder tijd achter een scherm.
            </p>

            {/* Direct contact — geen formulier nodig als je liever gewoon belt. */}
            <div className="mt-5 flex flex-col gap-2">
              <a
                href={`mailto:${branding.contactEmail}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700 transition-colors hover:text-brand"
              >
                <Mail className="h-4 w-4 text-brand" />
                {branding.contactEmail}
              </a>
              <a
                href={`tel:${branding.phoneTel}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700 transition-colors hover:text-brand"
              >
                <Phone className="h-4 w-4 text-brand" />
                {branding.phone}
              </a>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-bold text-ink">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-ink-500 transition-colors hover:text-brand"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cream-200 pt-6 text-sm text-ink-300 sm:flex-row">
          <p>© {new Date().getFullYear()} DogWare. Werk met honden. Wij regelen de rest.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/voorwaarden" className="transition-colors hover:text-ink">
              Voorwaarden
            </Link>
            <Link href="/cookies" className="transition-colors hover:text-ink">
              Cookies
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
