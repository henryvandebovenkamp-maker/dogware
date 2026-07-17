"use client";

import { AnimatePresence, motion } from "motion/react";
import type { EnergyKey, ModuleKey, ServiceKey } from "@/lib/demo-flow";
import { ENERGY } from "@/lib/demo-flow";
import {
  GlyphAgenda,
  GlyphCard,
  GlyphCheck,
  GlyphClients,
  GlyphPaw,
  GlyphPay,
  GlyphPortal,
  GlyphShopSmall,
  GlyphTeam,
} from "./illustrations";

/**
 * Live preview: terwijl de bezoeker kiest, bouwt zijn eigen DogWare zich op.
 * Puur transform/opacity-animaties voor 60fps; rustige tweens, geen springs.
 */

export type PreviewState = {
  bedrijfsnaam: string;
  services: ServiceKey[];
  modules: ModuleKey[];
  energy: EnergyKey[];
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

const appear = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.25 } },
  transition: { duration: 0.5, ease: EASE },
};

/** Agenda-items per gekozen dienst — zo verandert de agenda mee. */
const SERVICE_AGENDA: Record<
  ServiceKey,
  { tijd: string; titel: string; meta: string }
> = {
  hondenschool: { tijd: "09:00", titel: "Puppycursus — groep 3", meta: "8 pups · veld A" },
  uitlaatservice: { tijd: "10:30", titel: "Groepswandeling bos", meta: "6 honden · route Noord" },
  dagopvang: { tijd: "07:45", titel: "Ochtendopvang", meta: "12 honden aangemeld" },
  pension: { tijd: "11:00", titel: "Check-in logeergast Moos", meta: "t/m zondag" },
  trimsalon: { tijd: "13:15", titel: "Trimafspraak — Doodle Bo", meta: "volledige vacht" },
  gedragstherapie: { tijd: "15:00", titel: "Gedragsconsult — Nala", meta: "vervolgafspraak 2/4" },
  oppas: { tijd: "17:30", titel: "Huisbezoek — kat & hond", meta: "Ramona · sleuteladres" },
  webshop: { tijd: "—", titel: "3 nieuwe bestellingen", meta: "verzendlabels klaar" },
};

const MODULE_NAV: Record<ModuleKey, { label: string; Icon: typeof GlyphAgenda }> = {
  boeken: { label: "Boekingen", Icon: GlyphAgenda },
  portaal: { label: "Klantportaal", Icon: GlyphPortal },
  betalen: { label: "Betalingen", Icon: GlyphPay },
  personeel: { label: "Team", Icon: GlyphTeam },
  strippenkaart: { label: "Strippenkaarten", Icon: GlyphCard },
  nieuwsbrief: { label: "Berichten", Icon: GlyphClients },
};

export function LivePreview({
  state,
  hero = false,
}: {
  state: PreviewState;
  /** Finale-modus: groter, rijker */
  hero?: boolean;
}) {
  const naam = state.bedrijfsnaam.trim() || "Jouw bedrijf";
  const agenda = state.services.slice(0, hero ? 5 : 3).map((s) => SERVICE_AGENDA[s]);
  const beloften = ENERGY.filter((e) => state.energy.includes(e.key)).slice(0, hero ? 4 : 2);
  const heeftShop = state.services.includes("webshop");
  const navModules = state.modules.slice(0, hero ? 6 : 4);

  return (
    <motion.div
      layout
      transition={{ duration: 0.5, ease: EASE }}
      className="overflow-hidden rounded-[1.4rem] bg-white shadow-lift ring-1 ring-ink/5"
    >
      {/* Vensterbalk */}
      <div className="flex items-center gap-2 border-b border-cream-200 bg-cream px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-cream-200" />
        <span className="h-2 w-2 rounded-full bg-cream-200" />
        <span className="h-2 w-2 rounded-full bg-cream-200" />
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-white/80 px-2.5 py-1 text-[10px] font-medium text-ink-300 ring-1 ring-ink/5">
          <span className="truncate">
            {naam.toLowerCase().replace(/[^a-z0-9]+/g, "")}.dogware.nl
          </span>
        </div>
      </div>

      <div className="flex">
        {/* Zijbalk */}
        <div className="hidden w-[8.5rem] shrink-0 flex-col gap-1 border-r border-cream-100 bg-cream/60 p-3 sm:flex">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand text-white">
              <GlyphPaw className="h-3 w-3" />
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={naam}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="truncate text-[10px] font-extrabold text-ink"
              >
                {naam}
              </motion.span>
            </AnimatePresence>
          </div>

          <NavItem Icon={GlyphAgenda} label="Agenda" active />
          <NavItem Icon={GlyphClients} label="Klanten & honden" />
          <AnimatePresence initial={false}>
            {navModules.map((m) => {
              const { label, Icon } = MODULE_NAV[m];
              return (
                <motion.div key={m} layout {...appear}>
                  <NavItem Icon={Icon} label={label} />
                </motion.div>
              );
            })}
            {heeftShop && (
              <motion.div key="shop" layout {...appear}>
                <NavItem Icon={GlyphShopSmall} label="Webshop" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hoofdvlak */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <AnimatePresence mode="wait">
            <motion.p
              key={naam}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="truncate text-sm font-extrabold text-ink"
            >
              Goedemorgen, {naam}
            </motion.p>
          </AnimatePresence>
          <p className="text-[10px] text-ink-300">
            {agenda.length > 0
              ? "Vandaag staat alles al voor je klaar."
              : "Jouw dag vult zich zodra je kiest."}
          </p>

          {/* Beloften — wat automatisch wordt */}
          <AnimatePresence initial={false}>
            {beloften.length > 0 && (
              <motion.div layout {...appear} className="mt-3 flex flex-wrap gap-1.5">
                {beloften.map((b) => (
                  <span
                    key={b.key}
                    className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[9px] font-bold text-sage-600"
                  >
                    <GlyphCheck className="h-2.5 w-2.5" />
                    {b.belofte}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agenda */}
          <div className="mt-3.5 space-y-1.5">
            <AnimatePresence initial={false}>
              {agenda.length === 0 && (
                <motion.div
                  key="leeg"
                  {...appear}
                  className="rounded-xl border border-dashed border-cream-200 px-3 py-4 text-center text-[10px] text-ink-300"
                >
                  Hier verschijnt straks jouw dag
                </motion.div>
              )}
              {agenda.map((item) => (
                <motion.div
                  key={item.titel}
                  layout
                  {...appear}
                  className="flex items-center gap-2.5 rounded-xl bg-cream/70 px-3 py-2 ring-1 ring-ink/[0.03]"
                >
                  <span className="w-8 shrink-0 text-[9px] font-bold text-brand">
                    {item.tijd}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-ink">
                      {item.titel}
                    </span>
                    <span className="block truncate text-[9px] text-ink-300">
                      {item.meta}
                    </span>
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Webshop-kaartjes */}
          <AnimatePresence initial={false}>
            {heeftShop && (
              <motion.div layout {...appear} className="mt-3 grid grid-cols-3 gap-1.5">
                {["Lange lijn", "Snacks", "Tuigje"].map((p, i) => (
                  <div
                    key={p}
                    className="rounded-lg bg-white p-2 ring-1 ring-ink/5"
                  >
                    <div
                      className={`h-7 rounded-md ${
                        i === 1 ? "bg-sage-100" : "bg-brand-50"
                      }`}
                    />
                    <p className="mt-1 truncate text-[9px] font-bold text-ink">{p}</p>
                    <p className="text-[8px] text-ink-300">€ {12 + i * 7},95</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Teamregel */}
          <AnimatePresence initial={false}>
            {state.modules.includes("personeel") && (
              <motion.div
                layout
                {...appear}
                className="mt-3 flex items-center gap-2 rounded-xl bg-cream/70 px-3 py-2 ring-1 ring-ink/[0.03]"
              >
                <div className="flex -space-x-1.5">
                  {["S", "M", "J"].map((l) => (
                    <span
                      key={l}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-100 text-[8px] font-extrabold text-sage-600 ring-2 ring-white"
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <span className="text-[9px] font-semibold text-ink-500">
                  Team ingeroosterd — iedereen weet wat vandaag brengt
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function NavItem({
  Icon,
  label,
  active = false,
}: {
  Icon: typeof GlyphAgenda;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
        active ? "bg-white text-ink shadow-soft" : "text-ink-500"
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
