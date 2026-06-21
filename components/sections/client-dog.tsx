import {
  User,
  Receipt,
  CalendarCheck,
  CreditCard,
  ShoppingBag,
  MessageSquare,
  Dog,
  Stethoscope,
  GraduationCap,
  Brain,
  History,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/reveal";

const CLIENT = [
  { icon: User, label: "Gegevens" },
  { icon: Receipt, label: "Facturen" },
  { icon: CalendarCheck, label: "Boekingen" },
  { icon: CreditCard, label: "Betalingen" },
  { icon: ShoppingBag, label: "Aankopen" },
  { icon: MessageSquare, label: "Communicatie" },
];

const DOG = [
  { icon: Dog, label: "Gegevens" },
  { icon: Stethoscope, label: "Medische informatie" },
  { icon: GraduationCap, label: "Trainingen" },
  { icon: Brain, label: "Gedragstrajecten" },
  { icon: ShoppingBag, label: "Productaankopen" },
  { icon: History, label: "Volledige historie" },
];

function Panel({
  title,
  badge,
  items,
  accent,
}: {
  title: string;
  badge: string;
  items: { icon: typeof User; label: string }[];
  accent: "brand" | "sage";
}) {
  const accentBg = accent === "brand" ? "bg-brand-50 text-brand" : "bg-sage-100 text-sage";
  return (
    <div className="rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-extrabold text-ink">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accentBg}`}>
          {badge}
        </span>
      </div>
      <ul className="grid gap-2.5">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-3 rounded-xl bg-cream/60 px-4 py-3 ring-1 ring-ink/5"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentBg}`}>
              <item.icon className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold text-ink-700">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClientDog() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Klant- & hondenbeheer"
          title="Iedere hond en iedere klant perfect georganiseerd."
          intro="Eén compleet dossier per klant én per hond. Nooit meer zoeken, nooit meer dubbel invoeren — alles overzichtelijk op één plek."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <Panel title="Per klant" badge="Klantdossier" items={CLIENT} accent="brand" />
          </Reveal>
          <Reveal delay={0.08}>
            <Panel title="Per hond" badge="Hondendossier" items={DOG} accent="sage" />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
