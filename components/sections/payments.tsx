import {
  Smartphone,
  Landmark,
  CreditCard,
  Link2,
  FileText,
  Users,
  Dog,
  Receipt,
  Package,
  GraduationCap,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";

const METHODS = [
  { icon: Smartphone, label: "iDEAL" },
  { icon: Landmark, label: "Bancontact" },
  { icon: CreditCard, label: "Creditcard" },
  { icon: Link2, label: "Betaallink" },
  { icon: FileText, label: "Factuur" },
];

const LINKED = [
  { icon: Users, label: "Klanten" },
  { icon: Dog, label: "Honden" },
  { icon: Receipt, label: "Facturen" },
  { icon: Package, label: "Producten" },
  { icon: GraduationCap, label: "Trainingen" },
];

export function Payments() {
  return (
    <section id="betalingen" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Betalingen"
          title="Eenvoudig betaald krijgen."
          intro="Laat klanten betalen zoals zij dat willen — online én op locatie. Geen ingewikkelde systemen, geen losse oplossingen. Elke betaling wordt automatisch gekoppeld."
        />

        <RevealStagger className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
          {METHODS.map((m) => (
            <RevealItem key={m.label}>
              <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-cream/60 p-5 text-center shadow-soft ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
                  <m.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-ink">{m.label}</span>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-gradient-to-br from-cream to-cream-100 p-6 text-center ring-1 ring-ink/5 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-300">
              Automatisch gekoppeld aan
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {LINKED.map((l) => (
                <span
                  key={l.label}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft ring-1 ring-ink/5"
                >
                  <l.icon className="h-4 w-4 text-sage" />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
