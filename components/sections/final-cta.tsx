"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Heart } from "lucide-react";
import { Container } from "@/components/ui";
import { PawMark } from "@/components/brand";

const IMAGINE = [
  "Nog een hond helpen?",
  "Een extra training geven?",
  "Eerder naar huis?",
  "Meer tijd voor je eigen hond?",
];

export function FinalCta() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <section id="demo" className="relative overflow-hidden bg-ink py-20 text-cream sm:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-sage/20 blur-3xl" />
      </div>

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          {/* Emotionele afsluiter */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream/80 ring-1 ring-white/15">
              <Heart className="h-3.5 w-3.5 text-brand-400" />
              Waarom DogWare bestaat
            </span>
            <h2 className="mt-6 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-[2.7rem]">
              Stel je voor dat je morgen een uur minder administratie hebt.
            </h2>
            <p className="mt-5 text-lg text-cream/70">Wat zou je doen?</p>
            <ul className="mt-5 space-y-2.5">
              {IMAGINE.map((q) => (
                <li key={q} className="flex items-center gap-3 text-cream/90">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" />
                  <span className="text-[15px] font-medium">{q}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xl font-extrabold text-cream">
                Doe weer wat je leuk vindt. Werk met honden.
              </p>
              <p className="mt-1 text-lg font-semibold text-brand-400">
                Wij regelen de rest.
              </p>
            </div>
          </div>

          {/* Demo formulier */}
          <div className="rounded-3xl bg-cream p-7 text-ink shadow-lift sm:p-8">
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-sage">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h3 className="text-2xl font-extrabold text-ink">Bedankt! 🐾</h3>
                <p className="max-w-xs text-pretty text-ink-500">
                  We nemen snel contact met je op om een demo van DogWare in te
                  plannen. Tot snel!
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
                    <PawMark className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-xl font-extrabold text-ink">
                      Vraag een demo aan
                    </h3>
                    <p className="text-[13px] text-ink-500">
                      Vrijblijvend · binnen 1 werkdag reactie
                    </p>
                  </div>
                </div>
                <form onSubmit={onSubmit} className="space-y-3.5">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field label="Naam" name="naam" placeholder="Jouw naam" />
                    <Field
                      label="Bedrijf"
                      name="bedrijf"
                      placeholder="Bedrijfsnaam"
                    />
                  </div>
                  <Field
                    label="E-mailadres"
                    name="email"
                    type="email"
                    placeholder="jij@bedrijf.nl"
                  />
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-ink-700">
                      Type bedrijf
                    </label>
                    <select
                      name="type"
                      className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Kies je vakgebied
                      </option>
                      <option>Hondenschool</option>
                      <option>Uitlaatservice</option>
                      <option>Gedragstherapie</option>
                      <option>Trimsalon</option>
                      <option>Hondenopvang / pension</option>
                      <option>Osteopathie / fysiotherapie</option>
                      <option>Detectie & speuren</option>
                      <option>Anders</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600"
                  >
                    Vraag een demo aan
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <p className="text-center text-xs text-ink-300">
                    Ontdek hoe DogWare jouw hondenbedrijf overzichtelijker,
                    professioneler en vooral een stuk leuker maakt.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-[13px] font-semibold text-ink-700"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
