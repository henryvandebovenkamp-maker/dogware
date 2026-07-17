"use client";

import "@uploadthing/react/styles.css";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { submitIntake } from "@/app/actions/intake";
import { UploadDropzone } from "@/lib/uploadthing";
import { useAutosave } from "@/lib/drafts/use-autosave";
import { SaveIndicator } from "@/components/drafts/save-indicator";
import { RestoreBanner } from "@/components/drafts/restore-banner";
import {
  DISCOVERY,
  ENERGY,
  MODULES,
  REACTIONS,
  SERVICES,
  type DiscoveryKey,
  type EnergyKey,
  type ModuleKey,
  type ServiceKey,
} from "@/lib/demo-flow";
import { EMPTY_INTAKE } from "@/lib/intake";
import {
  IlluBehavior,
  IlluDaycare,
  IlluGrooming,
  IlluPension,
  IlluSchool,
  IlluShop,
  IlluSitter,
  IlluSocial,
  IlluWalk,
  IlluWebsite,
  IlluWordOfMouth,
} from "./illustrations";
import { LivePreview } from "./preview";
import { PartnerWelcome } from "./partner-welcome";
import {
  BackButton,
  ChoiceCard,
  EASE,
  ExpandCard,
  GhostInput,
  NextButton,
  Reaction,
  StepRoute,
} from "./ui";

const SERVICE_ART: Record<ServiceKey, React.ComponentType<{ className?: string }>> = {
  hondenschool: IlluSchool,
  uitlaatservice: IlluWalk,
  dagopvang: IlluDaycare,
  pension: IlluPension,
  trimsalon: IlluGrooming,
  gedragstherapie: IlluBehavior,
  oppas: IlluSitter,
  webshop: IlluShop,
};

const DISCOVERY_ART: Record<DiscoveryKey, React.ComponentType<{ className?: string }>> = {
  mond: IlluWordOfMouth,
  website: IlluWebsite,
  social: IlluSocial,
};

type StepId =
  | "naam"
  | "diensten"
  | "route"
  | "routeDetail"
  | "energie"
  | "modules"
  | "droom"
  | "contact"
  | "finale";

const ROUTE_LABELS = [
  "Jouw naam",
  "Jouw dagen",
  "Jouw klanten",
  "Jouw tijd",
  "Jouw omgeving",
  "Jouw droom",
  "Bijna klaar",
];

export function DemoExperience({
  uploadEnabled = false,
  partner = null,
}: {
  uploadEnabled?: boolean;
  /** Alleen gevuld bij binnenkomst via een partner/affiliate. */
  partner?: {
    name: string | null;
    firstName?: string | null;
    avatarUrl?: string | null;
    perks: string[];
  } | null;
}) {
  const [step, setStep] = useState<StepId>("naam");
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [services, setServices] = useState<ServiceKey[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryKey | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteGoed, setSiteGoed] = useState("");
  const [siteMist, setSiteMist] = useState("");
  const [energy, setEnergy] = useState<EnergyKey[]>([]);
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [droom, setDroom] = useState("");
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [plaats, setPlaats] = useState("");
  const [uploads, setUploads] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [restoreApplied, setRestoreApplied] = useState(false);

  // Autosave gaat aan zodra er ergens inhoud is — afgeleid, geen effect nodig.
  const interacted =
    Boolean(bedrijfsnaam) ||
    services.length > 0 ||
    Boolean(discovery) ||
    Boolean(naam) ||
    Boolean(email) ||
    Boolean(plaats) ||
    Boolean(droom) ||
    Boolean(siteUrl) ||
    Boolean(siteGoed) ||
    Boolean(siteMist) ||
    energy.length > 0 ||
    modules.length > 0;

  // Volledige, herstelbare momentopname van het formulier voor autosave.
  const draftValue = useMemo(
    () => ({
      step,
      bedrijfsnaam,
      services,
      discovery,
      siteUrl,
      siteGoed,
      siteMist,
      energy,
      modules,
      droom,
      naam,
      email,
      plaats,
      uploads,
    }),
    [step, bedrijfsnaam, services, discovery, siteUrl, siteGoed, siteMist, energy, modules, droom, naam, email, plaats, uploads],
  );

  const {
    status: saveStatus,
    lastSavedAt,
    restored,
    dismissRestored,
    discardDraft,
    flushNow,
    markSubmitted,
  } = useAutosave({
    formType: "demo-intake",
    value: draftValue,
    step,
    enabled: interacted,
  });

  // Herstel een teruggevonden concept precies zoals het was.
  function applyRestored() {
    if (!restored) return;
    const p = restored.payload as Partial<typeof draftValue>;
    if (p.bedrijfsnaam !== undefined) setBedrijfsnaam(p.bedrijfsnaam);
    if (p.services) setServices(p.services);
    if (p.discovery !== undefined) setDiscovery(p.discovery);
    if (p.siteUrl !== undefined) setSiteUrl(p.siteUrl);
    if (p.siteGoed !== undefined) setSiteGoed(p.siteGoed);
    if (p.siteMist !== undefined) setSiteMist(p.siteMist);
    if (p.energy) setEnergy(p.energy);
    if (p.modules) setModules(p.modules);
    if (p.droom !== undefined) setDroom(p.droom);
    if (p.uploads) setUploads(p.uploads);
    if (p.naam !== undefined) setNaam(p.naam);
    if (p.email !== undefined) setEmail(p.email);
    if (p.plaats !== undefined) setPlaats(p.plaats);
    if (p.step && p.step !== "finale") setStep(p.step);
    setRestoreApplied(true);
    dismissRestored();
  }

  const stepIndex: Record<Exclude<StepId, "finale">, number> = {
    naam: 0,
    diensten: 1,
    route: 2,
    routeDetail: 2,
    energie: 3,
    modules: 4,
    droom: 5,
    contact: 6,
  };

  const previewState = useMemo(
    () => ({ bedrijfsnaam, services, modules, energy }),
    [bedrijfsnaam, services, modules, energy],
  );

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function chooseDiscovery(key: DiscoveryKey) {
    setDiscovery(key);
    // Rustig automatisch verder — één keuze, geen extra klik nodig
    setTimeout(() => setStep("routeDetail"), 550);
  }

  function submit() {
    if (!naam.trim() || !plaats.trim()) {
      setError("Vertel me nog even je naam en plaats, dan weet ik wie ik mag verrassen.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Dat e-mailadres lijkt nog niet helemaal te kloppen.");
      return;
    }
    if (pending) return; // dubbele submit voorkomen
    setError(null);
    startTransition(async () => {
      // 1. Forceer een laatste autosave zodat niets verloren gaat.
      await flushNow();

      const gekozenDiscovery = DISCOVERY.find((d) => d.key === discovery);
      const result = await submitIntake({
        ...EMPTY_INTAKE,
        bedrijfsnaam: bedrijfsnaam.trim() || naam.trim(),
        naam: naam.trim(),
        email: email.trim(),
        plaats: plaats.trim(),
        website: siteUrl.trim(),
        diensten: SERVICES.filter((s) => services.includes(s.key)).map((s) => s.value),
        heeftWebsite: gekozenDiscovery?.heeftWebsite ?? "",
        websiteGoed: siteGoed.trim(),
        websiteMist: siteMist.trim(),
        tijdvreters: ENERGY.filter((e) => energy.includes(e.key)).map((e) => e.value),
        functies: MODULES.filter((m) => modules.includes(m.key)).map((m) => m.value),
        droomscenario: droom.trim(),
        uploads,
      });
      if (result.status === "success") {
        // Concept afronden en lokaal vangnet opruimen.
        await markSubmitted();
        setStep("finale");
      } else {
        setError(result.message ?? "Er ging iets mis. Probeer het nog eens.");
      }
    });
  }

  /* ---------- Finale ---------- */
  if (step === "finale") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto max-w-3xl"
      >
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-1.5 text-[13px] font-bold text-sage-600"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
            </span>
            Jouw persoonlijke DogWare wordt nu voorbereid
          </motion.span>
          <h1 className="mt-6 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {bedrijfsnaam.trim() || "Jouw bedrijf"}, maar dan met rust in je hoofd.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-ink-500">
            Dit is een eerste indruk, gebouwd op jouw keuzes. Ik werk hem nu
            persoonlijk voor je uit —{" "}
            <span className="font-semibold text-ink">
              binnen 24 uur ontvang je geen offerte, maar een kosteloos
              voorbeeld
            </span>{" "}
            van hoe jouw eigen omgeving eruit kan zien. Je zit nergens aan vast.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
          className="mt-10"
        >
          <LivePreview state={previewState} hero />
        </motion.div>

        {partner && (
          <p className="mx-auto mt-6 max-w-lg text-center text-[14px] leading-relaxed text-ink-500">
            Je aanvraag is binnengekomen via{" "}
            <span className="font-semibold text-ink">
              {partner.firstName || partner.name}
            </span>
            . Je voordelen —{" "}
            {partner.perks.length > 0
              ? partner.perks.join(" en ").toLowerCase()
              : "je korting en gratis eerste maand"}{" "}
            — zijn geregistreerd.
          </p>
        )}

        <p className="mt-8 text-center text-[13px] text-ink-300">
          Check je inbox — de bevestiging is al onderweg.
        </p>
      </motion.div>
    );
  }

  /* ---------- Experience ---------- */
  return (
    <>
      {/* Persoonlijke introductie bij binnenkomst via een partner.
          Alleen tijdens de vragen; de finale is voor iedereen identiek. */}
      {partner && (
        <PartnerWelcome
          perks={partner.perks}
          partnerName={partner.name}
          firstName={partner.firstName}
          avatarUrl={partner.avatarUrl}
        />
      )}

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
      {/* Vragenkant */}
      <div className="flex min-h-[26rem] flex-col">
        <div className="flex items-center justify-between gap-4">
          <StepRoute labels={ROUTE_LABELS} current={stepIndex[step]} />
          <SaveIndicator
            status={saveStatus}
            lastSavedAt={lastSavedAt}
            onRetry={flushNow}
          />
        </div>

        {restored && !restoreApplied && (
          <div className="mt-6">
            <RestoreBanner onResume={applyRestored} onDiscard={discardDraft} />
          </div>
        )}

        <div className="mt-12 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)", transition: { duration: 0.3 } }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              {step === "naam" && (
                <div>
                  <StepHeading
                    kicker="Laten we bouwen"
                    titel="Hoe heet jouw bedrijf?"
                    intro="Kijk daarna even rechts. Dit wordt jóuw omgeving."
                  />
                  <div className="mt-10 max-w-md">
                    <GhostInput
                      value={bedrijfsnaam}
                      onChange={setBedrijfsnaam}
                      placeholder="Bijv. De Vrije Loop"
                      autoFocus
                      onEnter={() => bedrijfsnaam.trim() && setStep("diensten")}
                    />
                  </div>
                  {bedrijfsnaam.trim().length > 2 && (
                    <div className="mt-6">
                      <Reaction>{REACTIONS.naam}</Reaction>
                    </div>
                  )}
                </div>
              )}

              {step === "diensten" && (
                <div>
                  <StepHeading
                    kicker="Jouw dagen"
                    titel="Waar word jij iedere dag enthousiast van?"
                    intro="Kies alles wat bij jouw bedrijf hoort. Je omgeving groeit mee."
                  />
                  <div className="mt-8 grid gap-3.5 sm:grid-cols-2">
                    {SERVICES.map((s) => {
                      const Art = SERVICE_ART[s.key];
                      return (
                        <ChoiceCard
                          key={s.key}
                          compact
                          illustration={<Art className="h-full w-full" />}
                          titel={s.titel}
                          verhaal={s.verhaal}
                          selected={services.includes(s.key)}
                          onSelect={() => toggle(services, s.key, setServices)}
                        />
                      );
                    })}
                  </div>
                  {services.length > 0 && (
                    <div className="mt-6">
                      <Reaction>
                        {services.length === 1 ? REACTIONS.dienstenEen : REACTIONS.dienstenMeer}
                      </Reaction>
                    </div>
                  )}
                </div>
              )}

              {step === "route" && (
                <div>
                  <StepHeading
                    kicker="Jouw klanten"
                    titel="Hoe ontdekken nieuwe klanten jouw bedrijf vandaag?"
                  />
                  <div className="mt-8 grid gap-3.5 sm:grid-cols-3">
                    {DISCOVERY.map((d) => {
                      const Art = DISCOVERY_ART[d.key];
                      return (
                        <ChoiceCard
                          key={d.key}
                          compact
                          illustration={<Art className="h-full w-full" />}
                          titel={d.titel}
                          verhaal={d.verhaal}
                          selected={discovery === d.key}
                          onSelect={() => chooseDiscovery(d.key)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {step === "routeDetail" && discovery === "website" && (
                <div>
                  <StepHeading
                    kicker="Jouw klanten"
                    titel="Vertel me over je huidige website."
                    intro={REACTIONS.websiteJa}
                  />
                  <div className="mt-8 max-w-md">
                    <GhostInput
                      size="md"
                      value={siteUrl}
                      onChange={setSiteUrl}
                      placeholder="www.jouwsite.nl (mag ook later)"
                    />
                  </div>
                  <div className="mt-6 grid gap-3.5">
                    <ExpandCard
                      uitnodiging="Wat mag zeker niet verloren gaan?"
                      placeholder="Bijv. de sfeer, de foto's, teksten waar je trots op bent…"
                      value={siteGoed}
                      onChange={setSiteGoed}
                    />
                    <ExpandCard
                      uitnodiging="En wat mag echt beter?"
                      placeholder="Bijv. zelf kunnen aanpassen, boekingen, uitstraling…"
                      value={siteMist}
                      onChange={setSiteMist}
                    />
                  </div>
                </div>
              )}

              {step === "routeDetail" && discovery !== "website" && (
                <div>
                  <StepHeading
                    kicker="Jouw klanten"
                    titel="Dan bouwen we een thuisbasis voor je."
                    intro={REACTIONS.websiteNee}
                  />
                  <div className="mt-8 max-w-lg">
                    <ExpandCard
                      uitnodiging="Wat zou jouw eigen plek online voor je moeten doen?"
                      placeholder="Bijv. dat mensen zelf een proefles boeken, dat alles er warm en professioneel uitziet…"
                      value={siteMist}
                      onChange={setSiteMist}
                    />
                  </div>
                </div>
              )}

              {step === "energie" && (
                <div>
                  <StepHeading
                    kicker="Jouw tijd"
                    titel="Wat kost jou nu de meeste energie?"
                    intro="Wees eerlijk, want dit is precies wat DogWare van je overneemt."
                  />
                  <div className="mt-8 grid gap-3.5 sm:grid-cols-2">
                    {ENERGY.map((e) => (
                      <SmallStoryCard
                        key={e.key}
                        titel={e.titel}
                        verhaal={e.verhaal}
                        selected={energy.includes(e.key)}
                        onSelect={() => toggle(energy, e.key, setEnergy)}
                      />
                    ))}
                  </div>
                  {energy.length > 0 && (
                    <div className="mt-6">
                      <Reaction>{REACTIONS.energie}</Reaction>
                    </div>
                  )}
                </div>
              )}

              {step === "modules" && (
                <div>
                  <StepHeading
                    kicker="Jouw omgeving"
                    titel="Wat mag er in jouw DogWare zeker niet ontbreken?"
                    intro="Elke keuze bouwt rechts verder aan jouw omgeving."
                  />
                  <div className="mt-8 grid gap-3.5 sm:grid-cols-2">
                    {MODULES.map((m) => (
                      <SmallStoryCard
                        key={m.key}
                        titel={m.titel}
                        verhaal={m.verhaal}
                        selected={modules.includes(m.key)}
                        onSelect={() => toggle(modules, m.key, setModules)}
                      />
                    ))}
                  </div>
                  {modules.length > 1 && (
                    <div className="mt-6">
                      <Reaction>{REACTIONS.modules}</Reaction>
                    </div>
                  )}
                </div>
              )}

              {step === "droom" && (
                <div>
                  <StepHeading
                    kicker="Jouw droom"
                    titel="Stel: alles regelt zichzelf. Hoe ziet jouw dag eruit?"
                    intro="Alles mag. Dit is waar we naartoe bouwen."
                  />
                  <div className="mt-8 max-w-lg">
                    <ExpandCard
                      uitnodiging="Beschrijf je ideale dag…"
                      placeholder="Bijv. 's ochtends het veld op, 's middags een wandeling, en 's avonds gewoon vrij."
                      value={droom}
                      onChange={setDroom}
                    />
                  </div>

                  {uploadEnabled && (
                    <div className="mt-6 max-w-lg">
                      <DemoUploads
                        uploads={uploads}
                        onAdd={(urls) => setUploads((u) => [...u, ...urls])}
                        onRemove={(url) => setUploads((u) => u.filter((x) => x !== url))}
                      />
                    </div>
                  )}

                  {droom.trim().length > 10 && (
                    <div className="mt-6">
                      <Reaction>{REACTIONS.droom}</Reaction>
                    </div>
                  )}
                </div>
              )}

              {step === "contact" && (
                <div>
                  <StepHeading
                    kicker="Bijna klaar"
                    titel="Waar mag ik jouw voorbeeld naartoe sturen?"
                    intro="Binnen 24 uur. Geen offerte, maar een kosteloos voorbeeld. Je zit nergens aan vast."
                  />
                  <div className="mt-10 grid max-w-md gap-8">
                    <GhostInput
                      size="md"
                      value={naam}
                      onChange={setNaam}
                      placeholder="Jouw naam"
                      autoFocus
                    />
                    <GhostInput
                      size="md"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="jij@bedrijf.nl"
                    />
                    <GhostInput
                      size="md"
                      value={plaats}
                      onChange={setPlaats}
                      placeholder="Jouw plaats"
                      onEnter={submit}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-[14px] font-semibold text-brand-600"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Mobiele preview */}
        <div className="mt-10 lg:hidden">
          <PreviewFrame state={previewState} />
        </div>

        {/* Navigatie */}
        <div className="mt-10 flex items-center justify-between">
          {step !== "naam" ? (
            <BackButton
              onClick={() =>
                setStep(
                  step === "diensten"
                    ? "naam"
                    : step === "route"
                      ? "diensten"
                      : step === "routeDetail"
                        ? "route"
                        : step === "energie"
                          ? discovery
                            ? "routeDetail"
                            : "route"
                          : step === "modules"
                            ? "energie"
                            : step === "droom"
                              ? "modules"
                              : "droom",
                )
              }
            />
          ) : (
            <span />
          )}

          {step !== "route" && (
            <NextButton
              pending={pending}
              disabled={
                (step === "naam" && !bedrijfsnaam.trim()) ||
                (step === "diensten" && services.length === 0)
              }
              onClick={() => {
                if (step === "naam") setStep("diensten");
                else if (step === "diensten") setStep("route");
                else if (step === "routeDetail") setStep("energie");
                else if (step === "energie") setStep("modules");
                else if (step === "modules") setStep("droom");
                else if (step === "droom") setStep("contact");
                else if (step === "contact") submit();
              }}
            >
              {step === "contact" ? "Bouw mijn DogWare" : "Verder"}
            </NextButton>
          )}
        </div>
      </div>

      {/* Live preview — desktop */}
      <div className="sticky top-28 hidden lg:block">
        <PreviewFrame state={previewState} />
      </div>
      </div>
    </>
  );
}

/* ---------- Hulpcomponenten ---------- */

function StepHeading({
  kicker,
  titel,
  intro,
}: {
  kicker: string;
  titel: string;
  intro?: string;
}) {
  return (
    <div className="max-w-xl">
      <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand">
        {kicker}
      </p>
      <h1 className="mt-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        {titel}
      </h1>
      {intro && (
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-ink-500">
          {intro}
        </p>
      )}
    </div>
  );
}

function SmallStoryCard({
  titel,
  verhaal,
  selected,
  onSelect,
}: {
  titel: string;
  verhaal: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={`flex w-full flex-col items-start rounded-[1.2rem] bg-white p-5 text-left transition-shadow duration-300 ${
        selected
          ? "shadow-lift ring-2 ring-brand"
          : "shadow-soft ring-1 ring-ink/[0.06] hover:shadow-lift"
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[15px] font-extrabold tracking-tight text-ink">
          {titel}
        </span>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300 ${
            selected ? "bg-brand shadow-[0_0_0_4px_rgba(224,86,42,0.15)]" : "bg-ink/10"
          }`}
        />
      </span>
      <span className="mt-1 text-[13px] leading-relaxed text-ink-500">{verhaal}</span>
    </motion.button>
  );
}

function PreviewFrame({ state }: { state: Parameters<typeof LivePreview>[0]["state"] }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-50 via-transparent to-sage-100/60 blur-2xl" />
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-ink-300">
        Jouw DogWare — bouwt zichzelf op
      </p>
      <LivePreview state={state} />
    </div>
  );
}

/** Optionele upload van logo/huisstijl/foto's tijdens de demo-aanvraag. */
function DemoUploads({
  uploads,
  onAdd,
  onRemove,
}: {
  uploads: string[];
  onAdd: (urls: string[]) => void;
  onRemove: (url: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink-700">
        Heb je een logo of mooie foto&apos;s? Voeg ze gerust toe (mag ook later).
      </p>
      <UploadDropzone
        endpoint="intakeUploader"
        config={{ mode: "auto" }}
        onClientUploadComplete={(files) =>
          onAdd(files.map((f) => f.ufsUrl).filter(Boolean))
        }
        onUploadError={() => {}}
        appearance={{
          container:
            "rounded-2xl border-2 border-dashed border-cream-200 bg-white ut-uploading:opacity-70",
          label: "text-[13px] font-semibold text-ink-500 hover:text-brand",
          allowedContent: "text-[11px] text-ink-300",
          button:
            "ut-ready:bg-brand ut-uploading:bg-brand/70 rounded-full text-[13px] font-bold px-5 h-auto py-2 after:bg-ink",
        }}
      />
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {uploads.map((url) => (
            <li
              key={url}
              className="flex items-center justify-between gap-2 rounded-xl bg-sage-100 px-3.5 py-2 text-[12px] font-semibold text-sage-600"
            >
              <span className="truncate">
                {decodeURIComponent(url.split("/").pop() ?? url)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(url)}
                aria-label="Verwijder upload"
                className="shrink-0 rounded-full px-1.5 text-sage-600 hover:bg-white/60"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
