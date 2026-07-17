"use client";

import { useState } from "react";
import {
  GraduationCap,
  Footprints,
  Brain,
  Scissors,
  Check,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";
import { cn } from "@/lib/cn";

const MODULES = [
  {
    id: "hondenschool",
    icon: GraduationCap,
    tab: "Hondenschool",
    title: "Van inschrijving tot diploma.",
    desc: "Je cursusadministratie houdt zichzelf bij, van de eerste aanmelding tot de laatste les.",
    features: [
      "Online inschrijven",
      "Wachtlijsten",
      "Cursusbeheer",
      "Agenda & lesplanning",
      "Automatische e-mails",
      "Huiswerk delen",
      "Eigen klantomgeving",
      "Automatische facturatie",
    ],
  },
  {
    id: "uitlaatservice",
    icon: Footprints,
    tab: "Uitlaatservice",
    title: "Beheer jouw complete uitlaatservice.",
    desc: "Routes, capaciteit en beschikbaarheid in één overzicht. Volledig geïntegreerd met klanten, honden en facturen.",
    features: [
      "Klantbeheer",
      "Hondenprofielen",
      "Routes",
      "Slimme planning",
      "Capaciteit per rit",
      "Beschikbaarheid",
      "Facturen",
      "Betalingen",
    ],
  },
  {
    id: "gedragstherapie",
    icon: Brain,
    tab: "Gedragstherapie",
    title: "Meer aandacht voor de hond. Minder administratie.",
    desc: "Leg trajecten zorgvuldig vast en volg ze op. Zonder papierwerk.",
    features: [
      "Intakeformulieren",
      "Verslagen",
      "Adviezen",
      "Volledige dossiers",
      "Rapportages",
      "Vervolgafspraken",
    ],
  },
  {
    id: "trimsalon",
    icon: Scissors,
    tab: "Trimsalon",
    title: "Minder telefoontjes. Meer behandelingen.",
    desc: "Laat klanten zelf online boeken en stuur automatisch herinneringen. Jij houdt je handen vrij voor de honden.",
    features: [
      "Online afspraken",
      "Klantbeheer",
      "Automatische herinneringen",
      "Behandelhistorie",
      "Facturen",
    ],
  },
] as const;

export function Modules() {
  const [active, setActive] = useState(0);
  const current = MODULES[active];

  return (
    <section id="modules" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Modules"
          title="Eén platform, gebouwd voor jouw vakgebied."
          intro="Kies de onderdelen die bij jouw bedrijf passen. Combineer er zoveel als je wilt. Ze werken gewoon samen in dezelfde omgeving."
        />

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {MODULES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
                i === active
                  ? "bg-brand text-white shadow-[0_10px_24px_-12px_rgba(224,86,42,0.8)]"
                  : "bg-cream text-ink-700 ring-1 ring-ink/5 hover:bg-cream-100",
              )}
            >
              <m.icon className="h-4 w-4" />
              {m.tab}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-cream to-cream-100 p-6 ring-1 ring-ink/5 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-glow">
                <current.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {current.title}
              </h3>
              <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-ink-500">
                {current.desc}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {current.features.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[14px] font-semibold text-ink-700">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
