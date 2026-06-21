import { GraduationCap, CalendarCheck, ShoppingBag, ArrowRight, FileCheck2 } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const TRIGGERS = [
  { icon: GraduationCap, label: "Cursus geboekt" },
  { icon: CalendarCheck, label: "Training gereserveerd" },
  { icon: ShoppingBag, label: "Product gekocht" },
  { icon: CalendarCheck, label: "Afspraak gemaakt" },
];

export function Invoicing() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Facturatie"
          eyebrowTone="sage"
          title="Automatische facturen. Zonder dat je er naar omkijkt."
          intro="Zodra er iets gebeurt in jouw bedrijf, maakt DogWare automatisch de juiste factuur aan. Inclusief PDF en betalingsregistratie."
        />

        <Reveal delay={0.1}>
          <div className="mt-12 grid items-center gap-6 rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-9 lg:grid-cols-[1fr_auto_1fr]">
            {/* Triggers */}
            <div className="grid grid-cols-2 gap-2.5">
              {TRIGGERS.map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col gap-2 rounded-2xl bg-cream/60 p-4 ring-1 ring-ink/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-semibold text-ink-700">{t.label}</span>
                </div>
              ))}
            </div>

            {/* Pijl */}
            <div className="flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-glow">
                <ArrowRight className="h-5 w-5" />
              </span>
            </div>

            {/* Factuur mock */}
            <div className="rounded-2xl border border-cream-200 bg-cream/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-sage" />
                  <span className="text-sm font-bold text-ink">Factuur 2026-0481</span>
                </div>
                <span className="rounded-full bg-sage-100 px-2.5 py-1 text-[11px] font-semibold text-sage-600">
                  Betaald
                </span>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between text-ink-500">
                  <span>Puppycursus — 6 lessen</span>
                  <span className="font-semibold text-ink">€ 149,00</span>
                </div>
                <div className="flex justify-between text-ink-500">
                  <span>Trainingslijn 5m</span>
                  <span className="font-semibold text-ink">€ 24,95</span>
                </div>
                <div className="my-2 h-px bg-cream-200" />
                <div className="flex justify-between text-base font-extrabold text-ink">
                  <span>Totaal</span>
                  <span className="text-brand">€ 173,95</span>
                </div>
              </div>
              <button className="mt-4 w-full rounded-xl bg-ink py-2.5 text-[13px] font-semibold text-cream">
                PDF downloaden
              </button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
