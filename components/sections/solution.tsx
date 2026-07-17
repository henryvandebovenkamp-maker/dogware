import {
  UserPlus,
  Globe,
  CalendarCheck,
  CalendarDays,
  Receipt,
  CreditCard,
  LayoutDashboard,
  Mail,
  Star,
  CalendarPlus,
  RefreshCw,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";

/**
 * De complete bedrijfsflow — geen technische uitleg, maar het verhaal:
 * één nieuwe klant doorloopt je hele bedrijf, en alles gebeurt automatisch
 * op één plek. Verkoopt het gevoel "als ik hiervoor kies is alles geregeld".
 */
const FLOW = [
  { icon: UserPlus, label: "Nieuwe klant", tone: "brand" as const },
  { icon: Globe, label: "Jouw website" },
  { icon: CalendarCheck, label: "Boeking" },
  { icon: CalendarDays, label: "Planning" },
  { icon: Receipt, label: "Factuur" },
  { icon: CreditCard, label: "iDEAL-betaling" },
  { icon: LayoutDashboard, label: "Klantportaal" },
  { icon: Mail, label: "E-mail" },
  { icon: Star, label: "Review" },
  { icon: CalendarPlus, label: "Nieuwe afspraak", tone: "sage" as const },
];

export function Solution() {
  return (
    <section id="oplossing" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Zo draait jouw bedrijf"
          eyebrowTone="sage"
          title={
            <>
              Van eerste klik tot vaste klant.
              <br className="hidden sm:block" /> Alles op één plek.
            </>
          }
          intro="Geen losse programma's die je zelf aan elkaar moet knopen. Eén klant doorloopt je hele bedrijf, en elke stap gaat vanzelf in DogWare."
        />

        {/* De flow als doorlopende keten */}
        <RevealStagger
          className="mx-auto mt-14 flex max-w-4xl flex-wrap items-stretch justify-center gap-2.5 sm:gap-3"
          stagger={0.05}
        >
          {FLOW.map((step, i) => (
            <RevealItem key={step.label} className="flex items-center gap-2.5 sm:gap-3">
              <div
                className={`flex w-[7.5rem] flex-col items-center gap-2 rounded-2xl bg-white px-3 py-4 text-center shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift sm:w-32 ${
                  step.tone === "brand"
                    ? "ring-brand/20"
                    : step.tone === "sage"
                      ? "ring-sage/20"
                      : ""
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    step.tone === "brand"
                      ? "bg-brand text-white"
                      : step.tone === "sage"
                        ? "bg-sage text-white"
                        : "bg-brand-50 text-brand"
                  }`}
                >
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold leading-tight text-ink">
                  {step.label}
                </span>
              </div>
              {i < FLOW.length - 1 && (
                <span aria-hidden="true" className="text-ink-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                    <path
                      d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </RevealItem>
          ))}
        </RevealStagger>

        {/* De cirkel is rond: het herhaalt zich, vanzelf */}
        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-1.5 text-[13px] font-bold text-sage-600">
              <RefreshCw className="h-3.5 w-3.5" />
              En dan weer van voren af aan, helemaal vanzelf
            </span>
            <p className="text-balance text-xl font-bold text-ink sm:text-2xl">
              Geen dubbele invoer, geen losse abonnementen, geen gedoe.
              <span className="block text-brand">Gewoon jouw bedrijf, dat draait.</span>
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
