import Link from "next/link";
import { ArrowRight, CalendarRange, Check, FileText, HeartHandshake } from "lucide-react";
import { Button, Container, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import {
  INBEGREPEN,
  MAANDKOSTEN_DEKKEN,
  MAX_TERMIJNEN_PUBLIEK,
  PLATFORM_PRIJS,
  PRIJS_KORT,
} from "@/lib/tarieven";
import { cn } from "@/lib/cn";

/**
 * De prijs van DogWare, zonder kleine lettertjes.
 *
 * Bewust géén pricing table met pakketten: DogWare is één platform dat we
 * voor een bedrijf inrichten. Eén centrale kaart met het bedrag en wat erin
 * zit, de termijnen zichtbaar maar ondergeschikt, en de maandelijkse kosten
 * in een eigen, even goed leesbaar blok — niet verstopt onder de streep.
 *
 * Alle bedragen en beloftes komen uit lib/tarieven.ts.
 */

/** Het bedrag en wat erin zit — het hart van de prijscommunicatie. */
export function PrijsKaart() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink/5">
      <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
        {/* Het bedrag */}
        <div className="relative flex flex-col justify-center gap-5 bg-gradient-to-br from-brand-50 via-white to-cream-100 p-7 sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-600">
            Jouw complete DogWare-platform
          </p>
          <div>
            <p className="text-[3.4rem] font-extrabold leading-none tracking-tight text-ink sm:text-7xl">
              {PLATFORM_PRIJS.label}
            </p>
            <p className="mt-2 text-lg font-bold text-ink-700">eenmalige investering</p>
          </div>
          <p className="max-w-md text-pretty text-[15px] leading-relaxed text-ink-500">
            Een professionele website én het complete DogWare-platform voor jouw bedrijf. We
            richten alles samen met je in, zodat je website, klanten, planning, betalingen en
            communicatie vanuit één omgeving samenwerken.
          </p>
          <div className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-sage/15">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-600">
              <CalendarRange className="h-4.5 w-4.5" />
            </span>
            <p className="text-[14px] leading-relaxed text-ink-700">
              <span className="font-bold text-ink">Liever gespreid betalen?</span> Geen probleem. In
              overleg verdelen we de investering over maximaal {MAX_TERMIJNEN_PUBLIEK} termijnen.
            </p>
          </div>
        </div>

        {/* Wat erin zit */}
        <div className="p-7 sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-300">
            Dit zit erin
          </p>
          <ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {INBEGREPEN.map((i) => (
              <li key={i.titel} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span>
                  <span className="block text-[15px] font-bold leading-snug text-ink">{i.titel}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-500">{i.tekst}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13.5px] leading-relaxed text-ink-500">
            Welke onderdelen je gebruikt, stemmen we af op jouw diensten. Je betaalt niet voor
            dingen die je niet nodig hebt.
          </p>
        </div>
      </div>
    </div>
  );
}

/** De maandelijkse kosten: eerlijk benoemd, met waarom er geen vast bedrag staat. */
export function MaandKosten({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-ink p-7 text-cream sm:p-9", className)}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-400 ring-1 ring-white/10">
          <FileText className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-2xl font-extrabold tracking-tight">En daarna?</h3>
          <p className="mt-3 max-w-2xl text-pretty text-[15.5px] leading-relaxed text-cream/80">
            Naast de eenmalige investering zijn er maandelijkse kosten voor het gebruik en beheer
            van DogWare. Daarin zitten {MAANDKOSTEN_DEKKEN}. Omdat ieder hondenbedrijf anders werkt,
            hangt het bedrag af van de diensten en onderdelen die jij gebruikt.
          </p>
          <p className="mt-4 text-pretty text-[17px] font-bold leading-snug text-cream">
            De exacte maandelijkse kosten staan vooraf in je persoonlijke voorstel.{" "}
            <span className="text-brand-400">Geen verrassingen achteraf.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** De twee knoppen onder de prijs, met wat er na de klik gebeurt. */
export function PrijsCta({ secundair }: { secundair: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Button href="/demo" variant="primary" size="lg">
          Ontvang mijn persoonlijke voorstel
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
        </Button>
        <Button href={secundair.href} variant="ghost" size="lg">
          {secundair.label}
        </Button>
      </div>
      <p className="max-w-lg text-pretty text-[13.5px] leading-relaxed text-ink-500">
        Je begint met een kosteloos voorbeeld van jouw eigen omgeving. Daarna ontvang je je
        persoonlijke voorstel, met alle bedragen vooraf op een rij.
      </p>
    </div>
  );
}

/** De volledige prijssectie op de homepage. */
export function Pricing() {
  return (
    <section id="tarieven" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-brand-100/50 blur-3xl" />
      </div>
      <Container>
        <SectionHeading
          eyebrow="Helder over de investering"
          title="Een compleet platform. Vooraf duidelijk wat het kost."
          intro="Geen losse websitebouwer, boekingssysteem, facturatiepakket en klantportaal die je zelf aan elkaar moet knopen. We bouwen jouw complete DogWare-omgeving en richten hem samen met jou in."
        />

        <Reveal className="mx-auto mt-12 max-w-5xl">
          <PrijsKaart />
        </Reveal>

        <Reveal delay={0.05} className="mx-auto mt-5 max-w-5xl">
          <MaandKosten />
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-5xl">
          <PrijsCta secundair={{ href: "/#oplossingen", label: "Bekijk wat DogWare voor mij kan doen" }} />
          <p className="mt-5 text-center">
            <Link
              href="/tarieven"
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-brand transition hover:text-brand-600"
            >
              Alles over de tarieven en veelgestelde vragen
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/**
 * Compact, voor pagina's waar iemand de prijs verwacht maar waar het verhaal
 * over iets anders gaat. Eén regel met het bedrag en een link naar /tarieven —
 * nooit nog een keer de hele kaart.
 */
export function PrijsKort({
  className,
  opDonker = false,
  href = "/tarieven",
}: {
  className?: string;
  opDonker?: boolean;
  /** Waar "Bekijk de tarieven" heen gaat — op de homepage de sectie verderop. */
  href?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6",
        opDonker ? "bg-white/5 ring-1 ring-white/10" : "bg-white shadow-soft ring-1 ring-ink/5",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            opDonker ? "bg-white/10 text-brand-400" : "bg-brand-100 text-brand",
          )}
        >
          <HeartHandshake className="h-5 w-5" />
        </span>
        <p className={cn("text-2xl font-extrabold tracking-tight", opDonker ? "text-cream" : "text-ink")}>
          {PLATFORM_PRIJS.label}
        </p>
      </div>
      <p className={cn("flex-1 text-pretty text-[14.5px] leading-relaxed", opDonker ? "text-cream/80" : "text-ink-700")}>
        {PRIJS_KORT}{" "}
        <Link
          href={href}
          className={cn("font-bold underline-offset-4 hover:underline", opDonker ? "text-brand-400" : "text-brand")}
        >
          Bekijk de tarieven
        </Link>
      </p>
    </div>
  );
}
