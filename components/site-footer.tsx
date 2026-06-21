import Link from "next/link";
import { Logo } from "@/components/brand";
import { Container } from "@/components/ui";

const COLS = [
  {
    title: "Platform",
    links: [
      { label: "Klant- & hondenbeheer", href: "#oplossing" },
      { label: "Planning", href: "#oplossing" },
      { label: "Betalingen", href: "#betalingen" },
      { label: "Facturatie", href: "#betalingen" },
      { label: "Webshop", href: "#webshop" },
    ],
  },
  {
    title: "Modules",
    links: [
      { label: "Hondenschool", href: "#modules" },
      { label: "Uitlaatservice", href: "#modules" },
      { label: "Gedragstherapie", href: "#modules" },
      { label: "Trimsalon", href: "#modules" },
      { label: "Opvang & pension", href: "#modules" },
    ],
  },
  {
    title: "DogWare",
    links: [
      { label: "Waarom DogWare", href: "#verschil" },
      { label: "Demo aanvragen", href: "#demo" },
      { label: "Inloggen", href: "#demo" },
      { label: "Contact", href: "#demo" },
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
            <Link href="#" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="#" className="transition-colors hover:text-ink">
              Voorwaarden
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
