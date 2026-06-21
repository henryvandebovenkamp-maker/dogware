import {
  Package,
  Boxes,
  Tags,
  Gift,
  Percent,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const FEATURES = [
  { icon: Package, label: "Producten" },
  { icon: Boxes, label: "Voorraad" },
  { icon: Tags, label: "Categorieën" },
  { icon: Gift, label: "Cadeaubonnen" },
  { icon: Percent, label: "Kortingscodes" },
  { icon: ShoppingCart, label: "Bestellingen" },
  { icon: Receipt, label: "Facturen" },
];

const PRODUCTS = [
  { name: "Trainingslijn 5m", price: "€ 24,95", emoji: "🦮" },
  { name: "Puppy starterpakket", price: "€ 39,00", emoji: "🐶" },
  { name: "Hondensnacks bio", price: "€ 8,50", emoji: "🦴" },
  { name: "Vachtshampoo", price: "€ 14,95", emoji: "🧴" },
];

export function Webshop() {
  return (
    <section id="webshop" className="py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow tone="sage">Webshop</Eyebrow>
            <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Verkoop producten vanuit hetzelfde systeem.
            </h2>
            <p className="mt-4 max-w-md text-pretty text-lg leading-relaxed text-ink-500">
              Geen losse webshop. Geen losse klantgegevens. Geen losse
              betalingen. Elke bestelling is automatisch gekoppeld aan de klant,
              de hond en de factuur.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {FEATURES.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 shadow-soft ring-1 ring-ink/5"
                >
                  <f.icon className="h-4 w-4 text-brand" />
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          <Reveal delay={0.05}>
            <div className="rounded-3xl bg-white p-5 shadow-lift ring-1 ring-ink/5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">Jouw webshop</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-1 text-[11px] font-semibold text-sage-600">
                  <ShoppingCart className="h-3 w-3" /> 3 in winkelmand
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PRODUCTS.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-2xl bg-cream/60 p-4 ring-1 ring-ink/5"
                  >
                    <div className="mb-3 flex h-16 items-center justify-center rounded-xl bg-white text-3xl ring-1 ring-ink/5">
                      {p.emoji}
                    </div>
                    <p className="text-[13px] font-semibold text-ink">{p.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-brand">{p.price}</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white">
                        <ShoppingCart className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
