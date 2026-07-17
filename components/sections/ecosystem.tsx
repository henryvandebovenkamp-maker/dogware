import {
  GraduationCap,
  Footprints,
  Brain,
  Scissors,
  Home,
  Hotel,
  HandHeart,
  Activity,
  Search,
  Baby,
  ShoppingBag,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { BrandMark } from "@/components/brand";
import { Reveal } from "@/components/reveal";

const NODES = [
  { icon: GraduationCap, label: "Hondenschool" },
  { icon: Footprints, label: "Uitlaatservice" },
  { icon: Brain, label: "Gedragstherapie" },
  { icon: Scissors, label: "Trimsalon" },
  { icon: Home, label: "Hondenopvang" },
  { icon: Hotel, label: "Hondenpension" },
  { icon: HandHeart, label: "Osteopathie" },
  { icon: Activity, label: "Fysiotherapie" },
  { icon: Search, label: "Detectie & Speuren" },
  { icon: Baby, label: "Puppytraining" },
  { icon: ShoppingBag, label: "Webshop" },
];

// Posities op een cirkel berekenen (alleen desktop)
const RADIUS = 43;
const positioned = NODES.map((node, i) => {
  const angle = (-90 + (360 / NODES.length) * i) * (Math.PI / 180);
  return {
    ...node,
    left: 50 + RADIUS * Math.cos(angle),
    top: 50 + RADIUS * Math.sin(angle),
  };
});

export function Ecosystem() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-cream-100 to-cream py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Het DogWare ecosysteem"
          title="Alles gekoppeld. Alles automatisch. Alles centraal."
          intro="Alles wat je doet in je hondenbedrijf werkt vanuit één plek. Wat je ook oppakt, het hangt samen."
        />

        {/* Desktop orbit */}
        <Reveal delay={0.1}>
          <div className="relative mx-auto mt-14 hidden aspect-square w-full max-w-2xl md:block">
            {/* Ringen */}
            <div className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ink/10" />
            <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ink/10" />

            {/* Verbindingslijnen */}
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              {positioned.map((n) => (
                <line
                  key={n.label}
                  x1="50%"
                  y1="50%"
                  x2={`${n.left}%`}
                  y2={`${n.top}%`}
                  stroke="currentColor"
                  className="text-brand/15"
                  strokeWidth="1.5"
                />
              ))}
            </svg>

            {/* Center */}
            <div className="absolute left-1/2 top-1/2 z-10 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white shadow-glow ring-8 ring-cream">
              <BrandMark size={44} className="h-11 w-11" />
              <span className="mt-1 text-sm font-extrabold tracking-tight text-ink">Dog<span className="text-brand">Ware</span></span>
            </div>

            {/* Nodes */}
            {positioned.map((n, i) => (
              <div
                key={n.label}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${n.left}%`, top: `${n.top}%` }}
              >
                <div
                  className={`flex items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-lift ring-1 ring-ink/5 ${
                    i % 2 === 0 ? "animate-float-slow" : "animate-float-slower"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand">
                    <n.icon className="h-4 w-4" />
                  </span>
                  <span className="whitespace-nowrap text-[13px] font-semibold text-ink">
                    {n.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Mobiel: center + grid */}
        <div className="mt-12 md:hidden">
          <div className="mx-auto mb-6 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-glow ring-8 ring-cream">
            <BrandMark size={36} className="h-9 w-9" />
            <span className="mt-1 text-xs font-extrabold text-ink">Dog<span className="text-brand">Ware</span></span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {NODES.map((n) => (
              <div
                key={n.label}
                className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 shadow-soft ring-1 ring-ink/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <n.icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-semibold text-ink">{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
