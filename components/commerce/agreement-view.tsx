"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import { signAgreement, type SignInput } from "@/app/actions/commerce";
import type { Chapter, ConsentKey } from "@/lib/agreement";
import { CONSENT_KEYS } from "@/lib/agreement";
import { BrandMark } from "@/components/brand";
import { legalEntity, legalFooterLine } from "@/lib/legal-entity";
import { cn } from "@/lib/cn";

type Klant = {
  bedrijfsnaam: string;
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  kvk: string;
  btw: string;
  functie: string;
};

/**
 * De overeenkomst zoals de klant hem leest en tekent.
 *
 * Alle akkoordpunten staan apart en moeten stuk voor stuk worden aangevinkt —
 * één vinkje "ik ga akkoord met alles" is juridisch zwakker en, belangrijker,
 * minder eerlijk: de klant hoort te zien dat er ook een maandbedrag bij hoort.
 */
export function AgreementView({
  token,
  chapters,
  versionName,
  versionDate,
  consents,
  getekend,
  getekendOp,
  getekendDoor,
  voorstelVersie,
  klant,
}: {
  token: string;
  chapters: Chapter[];
  versionName: string;
  versionDate: string;
  consents: Record<ConsentKey, string>;
  getekend: boolean;
  getekendOp: string | null;
  getekendDoor: string | null;
  voorstelVersie: number;
  klant: Klant;
}) {
  const [form, setForm] = useState<Klant>(klant);
  const [vinkjes, setVinkjes] = useState<Record<ConsentKey, boolean>>(
    Object.fromEntries(CONSENT_KEYS.map((k) => [k, false])) as Record<ConsentKey, boolean>,
  );
  const [fout, setFout] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const alleVinkjes = CONSENT_KEYS.every((k) => vinkjes[k]);
  const set = (k: keyof Klant) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function teken() {
    setFout(null);
    const input: SignInput = {
      naam: form.naam,
      functie: form.functie,
      email: form.email,
      telefoon: form.telefoon,
      bedrijfsnaam: form.bedrijfsnaam,
      adres: form.adres,
      postcode: form.postcode,
      plaats: form.plaats,
      kvk: form.kvk,
      btw: form.btw,
      agreesOpdracht: vinkjes.agreesOpdracht,
      agreesInvestering: vinkjes.agreesInvestering,
      agreesTermijnen: vinkjes.agreesTermijnen,
      agreesMaandbedrag: vinkjes.agreesMaandbedrag,
      agreesVoorwaarden: vinkjes.agreesVoorwaarden,
      agreesBevoegd: vinkjes.agreesBevoegd,
    };
    start(async () => {
      const res = await signAgreement(token, input);
      if (res.status === "error") setFout(res.message ?? "Ondertekenen lukte niet.");
      else window.location.href = `/traject/${token}`;
    });
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-cream-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
          <BrandMark size={34} className="h-[34px] w-[34px]" />
          <span className="text-[13px] font-bold text-ink-500">{klant.bedrijfsnaam}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
        <a
          href={`/traject/${token}`}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar je overzicht
        </a>

        <h1 className="mt-4 text-balance text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[32px]">
          Samenwerkingsovereenkomst
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ink-500">
          {versionName} · ingangsdatum {versionDate} · hoort bij voorstel versie {voorstelVersie}
        </p>

        {getekend && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-sage-100/70 p-4 ring-1 ring-sage/15">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage-600" />
            <div>
              <p className="text-[14px] font-extrabold text-ink">Deze overeenkomst is getekend</p>
              <p className="mt-0.5 text-[13px] text-ink-500">
                {getekendDoor && `Door ${getekendDoor}`}
                {getekendOp &&
                  ` op ${new Date(getekendOp).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}`}
                . Je kunt hem hier altijd teruglezen.
              </p>
            </div>
          </div>
        )}

        {/* De partijen */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-300">
              Opdrachtnemer
            </p>
            <p className="mt-1 text-[14px] font-extrabold text-ink">{legalEntity.name}</p>
            <p className="text-[13px] leading-relaxed text-ink-500">
              {legalEntity.address}
              <br />
              {legalEntity.postcode} {legalEntity.city}
              <br />
              {legalEntity.email}
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-300">
              DogWare is het platform van {legalEntity.name}.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-300">
              Opdrachtgever
            </p>
            <p className="mt-1 text-[14px] font-extrabold text-ink">{form.bedrijfsnaam}</p>
            <p className="text-[13px] leading-relaxed text-ink-500">
              {form.naam}
              <br />
              {form.email}
              {form.kvk && (
                <>
                  <br />
                  KvK {form.kvk}
                </>
              )}
            </p>
          </div>
        </section>

        {/* De tekst */}
        <article className="mt-6 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-8">
          {chapters.map((c) => (
            <section key={c.n} className="mt-8 first:mt-0">
              <h2 className="text-[16px] font-extrabold tracking-tight text-ink">
                {c.n}. {c.title}
              </h2>
              {c.articles.map((a) => (
                <div key={a.n} className="mt-4">
                  <h3 className="text-[13.5px] font-bold text-ink-700">
                    {a.n} {a.title}
                  </h3>
                  {a.paragraphs.map((p, i) => (
                    <p key={i} className="mt-1.5 text-pretty text-[14px] leading-relaxed text-ink-500">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </article>

        {!getekend && (
          <>
            {/* Gegevens */}
            <section className="mt-8 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-7">
              <h2 className="text-[16px] font-extrabold tracking-tight text-ink">Je gegevens</h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Deze komen op de overeenkomst en op je facturen te staan.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Veld label="Bedrijfsnaam" value={form.bedrijfsnaam} onChange={set("bedrijfsnaam")} />
                <Veld label="Je naam" value={form.naam} onChange={set("naam")} />
                <Veld
                  label="Je functie"
                  value={form.functie}
                  onChange={set("functie")}
                  hint="Bijvoorbeeld: eigenaar"
                />
                <Veld label="E-mailadres" value={form.email} onChange={set("email")} type="email" />
                <Veld label="Telefoonnummer" value={form.telefoon} onChange={set("telefoon")} type="tel" />
                <Veld label="Adres" value={form.adres} onChange={set("adres")} />
                <Veld label="Postcode" value={form.postcode} onChange={set("postcode")} />
                <Veld label="Plaats" value={form.plaats} onChange={set("plaats")} />
                <Veld label="KvK-nummer" value={form.kvk} onChange={set("kvk")} />
                <Veld
                  label="Btw-nummer"
                  value={form.btw}
                  onChange={set("btw")}
                  hint="Optioneel"
                  optioneel
                />
              </div>
            </section>

            {/* Akkoordverklaringen */}
            <section className="mt-4 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-7">
              <h2 className="text-[16px] font-extrabold tracking-tight text-ink">
                Waar je akkoord op gaat
              </h2>
              <p className="mt-1 text-[13px] text-ink-500">
                Lees ze even door en vink ze stuk voor stuk aan.
              </p>
              <ul className="mt-5 space-y-3">
                {CONSENT_KEYS.map((k) => (
                  <li key={k}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition hover:bg-cream-100/70">
                      <span
                        className={cn(
                          "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition",
                          vinkjes[k]
                            ? "border-sage bg-sage text-white"
                            : "border-cream-200 bg-white",
                        )}
                      >
                        {vinkjes[k] && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={vinkjes[k]}
                        onChange={(e) => setVinkjes((v) => ({ ...v, [k]: e.target.checked }))}
                      />
                      <span className="text-[14px] leading-relaxed text-ink-700">{consents[k]}</span>
                    </label>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={teken}
                disabled={pending || !alleVinkjes}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-[15px] font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? "Een moment…" : "Onderteken de overeenkomst"}
              </button>
              {!alleVinkjes && (
                <p className="mt-2 text-[12.5px] text-ink-300">
                  Vink alle punten aan om te kunnen tekenen.
                </p>
              )}
              {fout && (
                <p className="mt-3 rounded-xl bg-brand-50 px-4 py-2.5 text-[13px] font-semibold text-brand-600">
                  {fout}
                </p>
              )}
              <p className="mt-4 text-[11.5px] leading-relaxed text-ink-300">
                Bij het ondertekenen leggen we je naam, de datum en tijd, de versie van dit voorstel
                en deze voorwaarden vast, samen met een versleutelde weergave van je IP-adres. Zo is
                later te herleiden wat er precies is afgesproken.
              </p>
            </section>
          </>
        )}

        <footer className="mt-12 border-t border-cream-200 pt-6">
          <p className="text-[11.5px] leading-relaxed text-ink-300">{legalFooterLine()}</p>
        </footer>
      </main>
    </div>
  );
}

function Veld({
  label,
  value,
  onChange,
  hint,
  type = "text",
  optioneel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  optioneel?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-bold text-ink-700">
        {label}
        {!optioneel && <span className="ml-0.5 text-brand">*</span>}
      </span>
      {hint && <span className="mt-0.5 block text-[11.5px] text-ink-300">{hint}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  );
}
