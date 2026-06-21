import {
  MessageCircle,
  Mail,
  FileText,
  CalendarX,
  ShoppingCart,
  Users,
  EyeOff,
  Moon,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";

const FRUSTRATIONS = [
  { icon: MessageCircle, text: "Klanten appen je de hele dag." },
  { icon: Mail, text: "Aanmeldingen komen binnen via e-mail." },
  { icon: FileText, text: "Facturen maak je handmatig." },
  { icon: CalendarX, text: "De planning staat ergens anders." },
  { icon: ShoppingCart, text: "De webshop draait los van de rest." },
  { icon: Users, text: "Je medewerkers gebruiken verschillende systemen." },
  { icon: EyeOff, text: "Je hebt nergens echt overzicht." },
  { icon: Moon, text: "Je bent iedere avond administratie aan het doen." },
];

export function Problem() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Herken je dit?"
          title="De dag voorbij, en nog niets aan honden gedaan."
          intro="Tien losse systemen, een telefoon die roodgloeiend staat en een berg administratie die elke avond op je wacht. Klinkt bekend?"
        />

        <RevealStagger className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2">
          {FRUSTRATIONS.map((f) => (
            <RevealItem key={f.text}>
              <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-soft ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
                  <f.icon className="h-5 w-5" />
                </span>
                <p className="text-[15px] font-medium text-ink-700">{f.text}</p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-12 max-w-2xl text-balance text-center text-xl font-bold text-ink sm:text-2xl">
            Je bent meer tijd kwijt aan organiseren dan aan honden.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
