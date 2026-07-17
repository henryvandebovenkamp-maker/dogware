import {
  CalendarDays,
  ClipboardList,
  Clock,
  Users,
  CheckSquare,
  UserPlus,
  CreditCard,
  FileText,
  Dog,
  ShoppingBag,
  GraduationCap,
  Download,
} from "lucide-react";
import { Container } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const TEAM = [
  { icon: CalendarDays, label: "Eigen agenda" },
  { icon: ClipboardList, label: "Eigen planning" },
  { icon: Clock, label: "Eigen beschikbaarheid" },
  { icon: Users, label: "Eigen klanten" },
  { icon: CheckSquare, label: "Eigen taken" },
];

const PORTAL = [
  { icon: UserPlus, label: "Inschrijven" },
  { icon: CreditCard, label: "Betalen" },
  { icon: FileText, label: "Facturen bekijken" },
  { icon: Dog, label: "Honden beheren" },
  { icon: ShoppingBag, label: "Producten bestellen" },
  { icon: GraduationCap, label: "Trainingen volgen" },
  { icon: Download, label: "Documenten downloaden" },
];

export function TeamPortal() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <Container>
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Medewerkers */}
          <Reveal>
            <div className="flex h-full flex-col rounded-3xl bg-gradient-to-br from-ink to-ink-700 p-7 text-cream shadow-lift sm:p-9">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cream/80 ring-1 ring-white/15">
                Medewerkers
              </span>
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Geef iedere medewerker zijn eigen omgeving.
              </h3>
              <p className="mt-3 text-pretty text-[15px] leading-relaxed text-cream/70">
                Iedereen werkt zelfstandig en jij houdt altijd het overzicht
                over het hele team.
              </p>
              <ul className="mt-6 grid gap-2.5">
                {TEAM.map((t) => (
                  <li
                    key={t.label}
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
                      <t.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[15px] font-semibold text-cream">{t.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Klantportaal */}
          <Reveal delay={0.08}>
            <div className="flex h-full flex-col rounded-3xl bg-gradient-to-br from-cream to-cream-100 p-7 shadow-lift ring-1 ring-ink/5 sm:p-9">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sage-600">
                Klantportaal
              </span>
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Een professionele ervaring voor jouw klanten.
              </h3>
              <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-500">
                Jouw klanten regelen alles zelf — 24 uur per dag, 7 dagen per
                week.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {PORTAL.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-100 text-sage">
                      <p.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] font-semibold text-ink-700">{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
