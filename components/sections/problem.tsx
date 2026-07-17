import {
  MessageCircle,
  Mail,
  FileText,
  CalendarX,
  Globe,
  Table2,
  FolderOpen,
  CreditCard,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";

const TOOLS = [
  { icon: Globe, text: "Een websitebouwer" },
  { icon: CalendarX, text: "Een losse agenda" },
  { icon: FileText, text: "Een apart factuurprogramma" },
  { icon: MessageCircle, text: "WhatsApp voor je klanten" },
  { icon: Table2, text: "Excel voor je administratie" },
  { icon: Mail, text: "Losse e-mails voor aanmeldingen" },
  { icon: FolderOpen, text: "Google Drive voor je bestanden" },
  { icon: CreditCard, text: "iDEAL via weer een ander systeem" },
];

export function Problem() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Herken je dit?"
          title="Zoveel losse systemen. En dat voelt normaal."
          intro="De meeste dierenondernemers werken elke dag met een handvol tools die niets van elkaar weten. Los van elkaar lijkt het te werken — samen kost het je elke avond opnieuw tijd."
        />

        <RevealStagger className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2">
          {TOOLS.map((f) => (
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
            Acht systemen, acht wachtwoorden, nul overzicht.
            <span className="block text-brand">Waarom doe je dit eigenlijk nog zo?</span>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
