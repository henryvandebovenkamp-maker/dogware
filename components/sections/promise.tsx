import { ShieldCheck, RefreshCw, Sprout, HeartHandshake } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { Reveal, RevealStagger, RevealItem } from "@/components/reveal";

/**
 * Het belofteblok: de kern van DogWare — één keer goed geregeld, daarna
 * onderhouden, beveiligd en meegroeiend. Warm en menselijk vormgegeven,
 * geen generieke witte SaaS-kaartjes. Draagt de merkwoorden: makkelijk,
 * simpel, veilig, persoonlijk.
 */
const BELOFTES = [
  {
    icon: RefreshCw,
    titel: "Wij houden alles up-to-date",
    tekst:
      "Geen updates, geen plugins, geen verouderde website. Wij bouwen en onderhouden je omgeving — jij merkt er niets van, behalve dat alles gewoon werkt.",
  },
  {
    icon: ShieldCheck,
    titel: "Veilig, zonder dat jij expert hoeft te zijn",
    tekst:
      "Beveiligingsupdates, betrouwbare betaaltechniek en zorgvuldig afgeschermde klantgegevens regelen wij. Jij hoeft geen technisch expert te worden om professioneel te werken.",
  },
  {
    icon: Sprout,
    titel: "Groeit mee met je bedrijf",
    tekst:
      "Begin met wat je vandaag nodig hebt — een website, planning of klantportaal. Wil je later meer? Dan zetten we het aan. Zonder verhuizen, zonder opnieuw beginnen.",
  },
];

export function PromiseSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-sage-100/60 blur-3xl" />
      </div>
      <Container>
        <SectionHeading
          eyebrow="De DogWare-belofte"
          eyebrowTone="sage"
          title="Eén keer goed geregeld. Daarna groeit DogWare gewoon met je mee."
          intro="Kies je voor DogWare, dan is dit de laatste keer dat je je druk hoeft te maken over je website en systemen. Wij zorgen dat alles blijft werken, veilig blijft en meebeweegt met je bedrijf."
        />

        <RevealStagger className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {BELOFTES.map((b) => (
            <RevealItem key={b.titel}>
              <div className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink/5 transition-transform hover:-translate-y-0.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-cream-100 text-sage ring-1 ring-sage/10">
                  <b.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-[17px] font-extrabold tracking-tight text-ink">
                  {b.titel}
                </h3>
                <p className="mt-2 text-pretty text-[14px] leading-relaxed text-ink-500">
                  {b.tekst}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        {/* Menselijke slotregel */}
        <Reveal delay={0.1}>
          <div className="mx-auto mt-12 flex max-w-2xl flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-[13px] font-bold text-brand">
              <HeartHandshake className="h-4 w-4" />
              Er zitten echte hondenmensen achter DogWare
            </span>
            <p className="text-balance text-xl font-bold text-ink sm:text-2xl">
              Minder tijd achter je laptop.
              <span className="text-brand"> Meer tijd tussen de dieren.</span>
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
