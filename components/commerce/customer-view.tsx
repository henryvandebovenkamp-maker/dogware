"use client";

import { useState, useTransition } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import { acceptProposal, startPayment } from "@/app/actions/commerce";
import type { JourneyStage } from "@/lib/db/schema";
import { JourneyBar } from "@/components/commerce/journey-bar";
import { BrandMark } from "@/components/brand";
import { legalFooterLine } from "@/lib/legal-entity";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ types -- */

export type Prijzen = {
  subtotal: string;
  discount: string;
  netExVat: string;
  vat: string;
  total: string;
  deposit: string;
  final: string;
  depositPercent: number;
  finalPercent: number;
  monthlyExVat: string;
  monthlyInclVat: string;
  vatPercent: number;
  freeMonths: number;
  startLabel: string;
};

export type VoorstelData = {
  token: string;
  version: number;
  titel: string;
  intro: string | null;
  omschrijving: string | null;
  werkzaamheden: string[];
  modules: string[];
  bijzonderheden: string | null;
  geldigTot: string | null;
  verlopen: boolean;
  geaccepteerd: boolean;
  geaccepteerdOp: string | null;
  geaccepteerdDoor: string | null;
  prijzen: Prijzen;
};

export type StatusData = {
  getekend: boolean;
  getekendOp: string | null;
  aanbetalingBetaald: boolean;
  opleveringKlaar: boolean;
  volledigBetaald: boolean;
  live: boolean;
  openstaand: string;
  mollieKlaar: boolean;
  mandaatActief: boolean;
  heeftAbonnement: boolean;
};

export type DocumentRij = {
  id: string;
  nummer: string;
  titel: string;
  bedrag: string | null;
  issuedAt: string;
  /** Alleen facturen zijn te openen; een voorstel staat al op de pagina zelf. */
  isFactuur: boolean;
};

export type TijdlijnRij = { id: string; label: string; actor: string; createdAt: string };

const datum = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

/* ------------------------------------------------------------------ shell -- */

/**
 * De klantomgeving. Eén rustige pagina, mobiel-first.
 *
 * De opbouw is bewust: eerst waar we staan, dan de ene stap die van de klant
 * gevraagd wordt, dan pas de details. Nooit meer dan één primaire knop.
 */
export function TrajectShell({
  voornaam,
  bedrijfsnaam,
  stage,
  kop,
  tekst,
  voorstel,
  status,
  documenten,
  tijdlijn,
}: {
  voornaam: string;
  bedrijfsnaam: string;
  stage: JourneyStage;
  kop?: string;
  tekst?: string;
  voorstel?: VoorstelData;
  status?: StatusData;
  documenten: DocumentRij[];
  tijdlijn: TijdlijnRij[];
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-cream-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
          <BrandMark size={34} className="h-[34px] w-[34px]" />
          <span className="text-[13px] font-bold text-ink-500">{bedrijfsnaam}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-20 pt-8 sm:pt-12">
        <h1 className="text-balance text-[28px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[36px]">
          Jouw nieuwe website met DogWare
        </h1>
        <p className="mt-2 text-[15px] text-ink-500">
          Hoi {voornaam} — hier zie je precies waar we staan.
        </p>

        <div className="mt-7 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5 sm:p-5">
          <JourneyBar current={stage} toon="klant" />
        </div>

        {kop && (
          <Kaart>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">{kop}</h2>
            {tekst && <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{tekst}</p>}
          </Kaart>
        )}

        {voorstel && status && (
          <>
            <VolgendeStap voorstel={voorstel} status={status} />
            <VoorstelDetails voorstel={voorstel} />
          </>
        )}

        {documenten.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-300">
              Jouw documenten
            </h2>
            <ul className="mt-3 space-y-2">
              {documenten.map((d) => {
                const inhoud = (
                  <>
                    <FileText className="h-4 w-4 shrink-0 text-ink-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {d.titel}
                      </span>
                      <span className="block font-mono text-[11px] text-ink-300">
                        {d.nummer} · {datum(d.issuedAt)}
                      </span>
                    </span>
                    {d.bedrag && (
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">
                        {d.bedrag}
                      </span>
                    )}
                  </>
                );
                const klas =
                  "flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5";
                return (
                  <li key={d.id}>
                    {d.isFactuur && voorstel ? (
                      <a
                        href={`/traject/${voorstel.token}/factuur/${d.nummer}`}
                        className={`${klas} transition hover:-translate-y-0.5 hover:shadow-lift`}
                      >
                        {inhoud}
                      </a>
                    ) : (
                      <span className={klas}>{inhoud}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tijdlijn.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-300">
              Wat er tot nu toe gebeurde
            </h2>
            <ol className="mt-4 space-y-3 border-l-2 border-cream-200 pl-5">
              {tijdlijn.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-sage ring-4 ring-cream" />
                  <p className="text-[13.5px] leading-relaxed text-ink-700">{e.label}</p>
                  <p className="text-[11.5px] text-ink-300">
                    {datum(e.createdAt)}
                    {e.actor === "klant" && " · door jou"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-14 border-t border-cream-200 pt-6">
          <p className="text-[11.5px] leading-relaxed text-ink-300">
            Vragen? Bel of mail Henry — je krijgt gewoon een mens aan de lijn.
            <br />
            {legalFooterLine()}
          </p>
        </footer>
      </main>
    </div>
  );
}

/* -------------------------------------------------------- de volgende stap */

function VolgendeStap({ voorstel, status }: { voorstel: VoorstelData; status: StatusData }) {
  const [pending, start] = useTransition();
  const [naam, setNaam] = useState("");
  const [fout, setFout] = useState<string | null>(null);

  function accepteer() {
    setFout(null);
    start(async () => {
      const res = await acceptProposal(voorstel.token, naam);
      if (res.status === "error") setFout(res.message ?? "Er ging iets mis.");
      else window.location.reload();
    });
  }

  function betaal(kind: "deposit" | "final") {
    setFout(null);
    start(async () => {
      const res = await startPayment(voorstel.token, kind);
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else setFout(res.message ?? "Betalen lukt nu even niet.");
    });
  }

  /* Alles live en betaald */
  if (status.live) {
    return (
      <Kaart tint="sage">
        <Kop>Je website staat live 🎉</Kop>
        <Tekst>
          Alles is geregeld: je project is opgeleverd, volledig betaald
          {status.heeftAbonnement && " en je abonnement loopt automatisch"}. Fijn dat je erbij bent.
        </Tekst>
      </Kaart>
    );
  }

  /* Volledig betaald, wacht op livegang */
  if (status.volledigBetaald) {
    return (
      <Kaart tint="sage">
        <Kop>Helemaal rond 🐾</Kop>
        <Tekst>
          Je laatste termijn is binnen
          {status.heeftAbonnement &&
            (status.mandaatActief
              ? " en je automatische incasso staat klaar"
              : ". We regelen je automatische incasso nu")}
          . We zetten je website live en laten het je weten.
        </Tekst>
      </Kaart>
    );
  }

  /* Oplevering klaar → laatste termijn */
  if (status.opleveringKlaar) {
    return (
      <Kaart tint="brand">
        <Kop>Je omgeving is klaar!</Kop>
        <Tekst>
          Wat leuk om je dit te laten zien. Om alles definitief te maken staat de laatste termijn van{" "}
          <strong className="font-extrabold text-ink">{status.openstaand}</strong> klaar.
        </Tekst>
        {voorstel.prijzen.monthlyExVat !== "€ 0,00" && (
          <div className="mt-4 rounded-xl bg-cream-100/80 p-4">
            <p className="text-[12.5px] font-bold text-ink">Daarna: je DogWare-abonnement</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
              {voorstel.prijzen.monthlyExVat} excl. btw per maand ({voorstel.prijzen.monthlyInclVat}{" "}
              incl. btw).
              {voorstel.prijzen.freeMonths > 0 &&
                ` De eerste ${voorstel.prijzen.freeMonths === 1 ? "maand is" : `${voorstel.prijzen.freeMonths} maanden zijn`} gratis.`}
            </p>
            <p className="mt-1 text-[12px] text-ink-300">{voorstel.prijzen.startLabel}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              Met deze betaling regelen we meteen de automatische incasso, zoals afgesproken in je
              overeenkomst.
            </p>
          </div>
        )}
        <Primair
          onClick={() => betaal("final")}
          pending={pending}
          label={`Betaal ${status.openstaand} en activeer DogWare`}
          disabled={!status.mollieKlaar}
        />
        <Fout tekst={fout} />
        {!status.mollieKlaar && <Wacht />}
      </Kaart>
    );
  }

  /* Aanbetaling gedaan → bouwfase */
  if (status.aanbetalingBetaald) {
    return (
      <Kaart tint="sage">
        <Kop>We bouwen aan jouw website</Kop>
        <Tekst>
          Je eerste termijn is binnen — dank je wel! Vanaf nu zijn wij aan zet. Je hoort van ons
          zodra er iets te zien is, en je hoeft nu even niets te doen.
        </Tekst>
      </Kaart>
    );
  }

  /* Getekend → eerste termijn */
  if (status.getekend) {
    return (
      <Kaart tint="brand">
        <Kop>Nog één stap en we beginnen</Kop>
        <Tekst>
          De overeenkomst is getekend
          {status.getekendOp && ` op ${datum(status.getekendOp)}`}. Om te starten met bouwen vragen
          we de eerste termijn van{" "}
          <strong className="font-extrabold text-ink">{voorstel.prijzen.deposit}</strong>.
        </Tekst>
        <Primair
          onClick={() => betaal("deposit")}
          pending={pending}
          label={`Betaal eerste termijn — ${voorstel.prijzen.deposit}`}
          disabled={!status.mollieKlaar}
        />
        <Fout tekst={fout} />
        {!status.mollieKlaar && <Wacht />}
      </Kaart>
    );
  }

  /* Geaccepteerd → overeenkomst tekenen */
  if (voorstel.geaccepteerd) {
    return (
      <Kaart tint="brand">
        <Kop>Nu de overeenkomst</Kop>
        <Tekst>
          Bedankt voor je akkoord
          {voorstel.geaccepteerdOp && ` op ${datum(voorstel.geaccepteerdOp)}`}. In de
          samenwerkingsovereenkomst staat precies wat we afspreken. Lees hem rustig door en teken
          hem digitaal — daarna kunnen we echt beginnen.
        </Tekst>
        <a
          href={`/traject/${voorstel.token}/overeenkomst`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand px-6 py-3.5 text-[15px] font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-600 sm:w-auto"
        >
          Bekijk en teken de overeenkomst
        </a>
      </Kaart>
    );
  }

  /* Verlopen voorstel */
  if (voorstel.verlopen) {
    return (
      <Kaart>
        <Kop>Dit voorstel is verlopen</Kop>
        <Tekst>
          De geldigheidsdatum van {voorstel.geldigTot ? datum(voorstel.geldigTot) : "dit voorstel"}{" "}
          is verstreken. Geen probleem — laat het even weten, dan maken we een verse versie voor je.
        </Tekst>
      </Kaart>
    );
  }

  /* Voorstel ligt er → accepteren */
  return (
    <Kaart tint="brand">
      <Kop>Je voorstel staat klaar</Kop>
      <Tekst>
        Hieronder lees je precies wat we voor je maken en wat het kost. Klopt alles? Vul dan je naam
        in en geef akkoord — daarna volgt de overeenkomst.
      </Tekst>
      <div className="mt-5">
        <label className="block text-[12.5px] font-bold text-ink-700">
          Je naam
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Voor- en achternaam"
            className="mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <p className="mt-1.5 text-[11.5px] text-ink-300">
          We leggen je naam, het moment en de versie van dit voorstel vast, zodat later duidelijk is
          waar je akkoord op gaf.
        </p>
      </div>
      <Primair
        onClick={accepteer}
        pending={pending}
        label="Ja, ik ga akkoord met dit voorstel"
        disabled={naam.trim().length < 2}
      />
      <Fout tekst={fout} />
    </Kaart>
  );
}

/* ------------------------------------------------------ voorstel in detail */

function VoorstelDetails({ voorstel }: { voorstel: VoorstelData }) {
  const p = voorstel.prijzen;
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-300">
          Het voorstel
        </h2>
        <span className="text-[11.5px] font-semibold text-ink-300">
          Versie {voorstel.version}
          {voorstel.geldigTot && ` · geldig t/m ${datum(voorstel.geldigTot)}`}
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-7">
        <h3 className="text-balance text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {voorstel.titel}
        </h3>
        {voorstel.intro && (
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-700">
            {voorstel.intro}
          </p>
        )}
        {voorstel.omschrijving && (
          <p className="mt-4 whitespace-pre-line text-pretty text-[15px] leading-relaxed text-ink-500">
            {voorstel.omschrijving}
          </p>
        )}

        {voorstel.werkzaamheden.length > 0 && (
          <Lijst titel="Wat we gaan doen" items={voorstel.werkzaamheden} />
        )}
        {voorstel.modules.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[12.5px] font-bold uppercase tracking-wide text-ink-300">
              Wat je krijgt
            </h4>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {voorstel.modules.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-sage-100 px-3 py-1 text-[12.5px] font-semibold text-sage-600"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {voorstel.bijzonderheden && (
          <div className="mt-6 rounded-xl bg-cream-100/80 p-4">
            <h4 className="text-[12.5px] font-bold text-ink">Afspraken op maat</h4>
            <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-500">
              {voorstel.bijzonderheden}
            </p>
          </div>
        )}
      </div>

      {/* De bedragen, groot en zonder verrassingen */}
      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-ink/5">
        <div className="border-b border-cream-100 p-6 sm:p-7">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-ink-300">
            Eenmalige investering
          </p>
          <p className="mt-1 text-[30px] font-extrabold leading-none tracking-tight text-ink sm:text-[36px]">
            {p.netExVat}
          </p>
          <p className="mt-1 text-[13px] text-ink-500">
            excl. btw · {p.total} incl. {p.vatPercent}% btw
          </p>

          <dl className="mt-5 space-y-1.5 text-[13.5px]">
            <Rij label="Subtotaal" value={p.subtotal} />
            {p.discount !== "€ 0,00" && <Rij label="Korting" value={`− ${p.discount}`} />}
            <Rij label="Netto excl. btw" value={p.netExVat} />
            <Rij label={`Btw ${p.vatPercent}%`} value={p.vat} />
            <Rij label="Totaal incl. btw" value={p.total} sterk />
          </dl>
        </div>

        <div className="grid gap-px bg-cream-100 sm:grid-cols-2">
          <div className="bg-white p-6 sm:p-7">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-ink-300">
              Betaling bij start
            </p>
            <p className="mt-1 text-[24px] font-extrabold text-brand">{p.depositPercent}%</p>
            <p className="text-[14px] font-semibold text-ink">{p.deposit}</p>
            <p className="mt-0.5 text-[12px] text-ink-300">incl. btw, na ondertekening</p>
          </div>
          <div className="bg-white p-6 sm:p-7">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-ink-300">
              Betaling bij oplevering
            </p>
            <p className="mt-1 text-[24px] font-extrabold text-brand">{p.finalPercent}%</p>
            <p className="text-[14px] font-semibold text-ink">{p.final}</p>
            <p className="mt-0.5 text-[12px] text-ink-300">incl. btw, vóór livegang</p>
          </div>
        </div>

        {p.monthlyExVat !== "€ 0,00" && (
          <div className="bg-sage-100/60 p-6 sm:p-7">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-sage-600">
              DogWare abonnement
            </p>
            <p className="mt-1 text-[24px] font-extrabold leading-none text-ink">
              {p.monthlyExVat}{" "}
              <span className="text-[14px] font-semibold text-ink-500">excl. btw per maand</span>
            </p>
            <p className="mt-1 text-[13px] text-ink-500">
              {p.monthlyInclVat} incl. btw
              {p.freeMonths > 0 &&
                ` · de eerste ${p.freeMonths === 1 ? "maand" : `${p.freeMonths} maanden`} van ons cadeau`}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">{p.startLabel}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
              Hierin zit hosting, onderhoud, beveiligingsupdates en persoonlijke ondersteuning.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- bouwstenen */

function Kaart({
  children,
  tint,
}: {
  children: React.ReactNode;
  tint?: "brand" | "sage";
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink/5">
      <div
        className={cn(
          "h-1.5",
          tint === "sage"
            ? "bg-sage"
            : tint === "brand"
              ? "bg-gradient-to-r from-brand to-brand-400"
              : "bg-cream-200",
        )}
      />
      <div className="p-6 sm:p-7">{children}</div>
    </div>
  );
}

function Kop({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-balance text-xl font-extrabold tracking-tight text-ink sm:text-[26px]">
      {children}
    </h2>
  );
}

function Tekst({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-pretty text-[15px] leading-relaxed text-ink-500">{children}</p>;
}

function Lijst({ titel, items }: { titel: string; items: string[] }) {
  return (
    <div className="mt-6">
      <h4 className="text-[12.5px] font-bold uppercase tracking-wide text-ink-300">{titel}</h4>
      <ul className="mt-2.5 space-y-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5">
            <Check className="mt-[3px] h-4 w-4 shrink-0 text-sage" />
            <span className="text-[14.5px] leading-relaxed text-ink-700">{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rij({ label, value, sterk }: { label: string; value: string; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-ink-500", sterk && "font-bold text-ink")}>{label}</dt>
      <dd className={cn("tabular-nums text-ink-700", sterk && "font-extrabold text-ink")}>
        {value}
      </dd>
    </div>
  );
}

function Primair({
  onClick,
  pending,
  label,
  disabled,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-[15px] font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? "Een moment…" : label}
    </button>
  );
}

function Fout({ tekst }: { tekst: string | null }) {
  if (!tekst) return null;
  return (
    <p className="mt-3 rounded-xl bg-brand-50 px-4 py-2.5 text-[13px] font-semibold text-brand-600">
      {tekst}
    </p>
  );
}

function Wacht() {
  return (
    <p className="mt-2 text-[12.5px] text-ink-300">
      Betalen wordt zo geactiveerd — je hoort van ons.
    </p>
  );
}
