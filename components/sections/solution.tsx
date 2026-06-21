import {
  Users,
  Dog,
  CalendarDays,
  CreditCard,
  ShoppingBag,
  GraduationCap,
  UserCog,
  Receipt,
  MessageSquare,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { RevealStagger, RevealItem } from "@/components/reveal";

const PILLARS = [
  { icon: Users, label: "Klanten" },
  { icon: Dog, label: "Honden" },
  { icon: CalendarDays, label: "Planning" },
  { icon: CreditCard, label: "Betalingen" },
  { icon: ShoppingBag, label: "Webshop" },
  { icon: GraduationCap, label: "Trainingen" },
  { icon: UserCog, label: "Medewerkers" },
  { icon: Receipt, label: "Facturen" },
  { icon: MessageSquare, label: "Communicatie" },
];

export function Solution() {
  return (
    <section id="oplossing" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="De oplossing"
          eyebrowTone="sage"
          title={
            <>
              Eén platform voor jouw
              <br className="hidden sm:block" /> complete hondenbedrijf.
            </>
          }
          intro="DogWare brengt alles samen. Geen losse tools, geen dubbele invoer, geen versnipperde gegevens. Alles vanuit één centrale omgeving — en alles werkt automatisch met elkaar samen."
        />

        <RevealStagger className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <RevealItem key={p.label}>
              <div className="group flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-cream-100 text-brand ring-1 ring-brand/10 transition-colors group-hover:from-brand group-hover:to-brand-400 group-hover:text-white">
                  <p.icon className="h-5 w-5" />
                </span>
                <span className="text-base font-bold text-ink">{p.label}</span>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </Container>
    </section>
  );
}
