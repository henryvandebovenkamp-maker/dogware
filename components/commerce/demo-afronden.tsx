"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, ExternalLink, FileText, Loader2, RotateCcw, X } from "lucide-react";
import { heropen, verstuurAfsluitmail, type AfrondState } from "@/app/actions/demo-afronding";
import { cn } from "@/lib/cn";

const IDLE: AfrondState = { status: "idle" };

export type VoorbereideAfronding = {
  documentId: string;
  bestandsnaam: string;
  paginas: number;
  grootte: number;
  onderwerp: string;
  tekst: string;
};

type Klant = { naam: string; voornaam: string | null; email: string; bedrijfsnaam: string };

const STAPPEN = [
  "Website vastleggen als PDF",
  "PDF opslaan bij de aanvraag",
  "Laatste e-mail voorbereiden",
  "E-mail + PDF versturen",
  "Demo als afgerond markeren",
  "Alles registreren in de tijdlijn",
];

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/**
 * "Demo afronden": een rustige actie, geen primaire knop. Opent een venster
 * dat eerst uitlegt wat er gebeurt, dan de PDF maakt (er gaat nog niets naar
 * de klant), en daarna PDF en mail laat controleren — met een proef naar
 * jezelf — vóór er iets verstuurd wordt.
 */
export function DemoAfronden({
  leadId,
  klant,
  voorbereid,
  nadruk = false,
}: {
  leadId: string;
  klant: Klant;
  /** Een eerder gemaakte, nog niet verstuurde PDF: daar gaan we mee verder. */
  voorbereid: VoorbereideAfronding | null;
  /** Na lange stilte mag de knop iets meer opvallen. */
  nadruk?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-bold transition",
          nadruk
            ? "bg-ink text-cream hover:bg-ink-700"
            : "bg-white text-ink-700 ring-1 ring-ink/10 hover:bg-cream",
        )}
      >
        <Archive className="h-3.5 w-3.5" />
        Demo afronden
      </button>
      {open && <Venster leadId={leadId} klant={klant} voorbereid={voorbereid} onSluit={() => setOpen(false)} />}
    </>
  );
}

function Venster({
  leadId,
  klant,
  voorbereid,
  onSluit,
}: {
  leadId: string;
  klant: Klant;
  voorbereid: VoorbereideAfronding | null;
  onSluit: () => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<"bevestigen" | "bezig" | "controleren">(voorbereid ? "controleren" : "bevestigen");
  const [data, setData] = useState<VoorbereideAfronding | null>(voorbereid);
  const [fout, setFout] = useState<string | null>(null);
  const [state, action, pending] = useActionState(verstuurAfsluitmail, IDLE);
  const klaar = state.status === "success" && !state.proef;
  const naam = klant.voornaam ?? klant.naam;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !pending && fase !== "bezig" && onSluit();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [pending, fase, onSluit]);

  useEffect(() => {
    if (klaar) router.refresh();
  }, [klaar, router]);

  async function maakPdf() {
    setFout(null);
    setFase("bezig");
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/demo-afronden`, { method: "POST" });
      // Een time-out of storing van de server geeft geen JSON terug maar een foutpagina.
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setFout(
          json?.reden ??
            (res.status === 504 || res.status === 502
              ? "De demo kon niet op tijd worden vastgelegd. Er is niets verstuurd en de aanvraag is niet afgerond. Probeer het opnieuw of controleer de demo."
              : "De PDF kon niet worden gemaakt. Er is niets verstuurd en de aanvraag is niet afgerond."),
        );
        setFase(data ? "controleren" : "bevestigen");
        return;
      }
      setData(json);
      setFase("controleren");
      router.refresh();
    } catch {
      // Het verzoek kwam niet eens terug. Er is niets verstuurd; een eventueel toch gemaakte PDF verschijnt na vernieuwen.
      setFout("De server gaf geen antwoord. Er is niets verstuurd en de aanvraag is niet afgerond. Vernieuw de pagina en probeer het opnieuw.");
      setFase(data ? "controleren" : "bevestigen");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="afronden-titel">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="afronden-titel" className="text-xl font-extrabold tracking-tight text-ink">
            {klaar ? "Demo afgerond" : `Demo van ${naam} afronden?`}
          </h2>
          <button
            type="button"
            onClick={onSluit}
            disabled={pending || fase === "bezig"}
            className="rounded-full p-1.5 text-ink-300 transition hover:bg-cream hover:text-ink disabled:opacity-40"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {fase === "bevestigen" && (
          <>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
              Voordat we de demo afsluiten, bewaren we een PDF van de voorbeeldwebsite en sturen we{" "}
              {naam} een laatste vriendelijke e-mail. De aanvraag blijft in DogWare bewaard en kan
              later altijd opnieuw worden geopend.
            </p>
            <ol className="mt-5 space-y-2">
              {STAPPEN.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-[13.5px] text-ink-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[11.5px] font-extrabold text-ink-500">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl bg-cream-100/70 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
              Je controleert de PDF en de mail eerst zelf. Er gaat niets naar {naam} voordat je op
              &quot;Afsluitmail versturen&quot; klikt. De online demo zelf wordt niet verwijderd.
            </p>
            {fout && <Fout tekst={fout} />}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onSluit} className="rounded-full px-4 py-2.5 text-[13px] font-bold text-ink-500 transition hover:bg-cream">
                Annuleren
              </button>
              <button type="button" onClick={maakPdf} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-600">
                PDF maken &amp; e-mail voorbereiden
              </button>
            </div>
          </>
        )}

        {fase === "bezig" && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
            <p className="mt-4 text-[14px] font-bold text-ink">De voorbeeldwebsite wordt vastgelegd…</p>
            <p className="mt-1 text-[12.5px] text-ink-500">
              We openen de belangrijkste pagina&apos;s en maken er een PDF van. Dit duurt meestal een
              halve tot een hele minuut. Er wordt nog niets verstuurd.
            </p>
          </div>
        )}

        {fase === "controleren" && data && (
          <>
            {klaar ? (
              <div className="mt-4 rounded-2xl bg-sage-100/70 p-5 ring-1 ring-sage/15">
                <p className="text-[14px] font-bold text-ink">{state.message}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                  De aanvraag staat nu onder &quot;Afgerond&quot; en blijft volledig bewaard. De
                  online demo is klaar om offline te halen.
                </p>
                <button type="button" onClick={onSluit} className="mt-4 rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-cream">
                  Sluiten
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-ink/10">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-cream-100/70 px-4 py-2.5 text-[12.5px]">
                    <span className="inline-flex min-w-0 items-center gap-2 font-bold text-ink">
                      <FileText className="h-4 w-4 shrink-0 text-brand" />
                      <span className="truncate">{data.bestandsnaam}</span>
                    </span>
                    <span className="flex items-center gap-3 text-ink-500">
                      {data.paginas} pagina&apos;s · {mb(data.grootte)}
                      <a href={`/api/admin/documenten/${data.documentId}/bestand`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-bold text-brand">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                      <a href={`/api/admin/documenten/${data.documentId}/bestand?download=1`} className="inline-flex items-center gap-1 font-bold text-brand">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </span>
                  </div>
                  <iframe
                    title="Voorbeeld van de PDF"
                    src={`/api/admin/documenten/${data.documentId}/bestand#view=FitH`}
                    className="hidden h-[360px] w-full bg-cream-100 sm:block"
                  />
                </div>

                <form action={action} className="mt-5">
                  <input type="hidden" name="leadId" value={leadId} />
                  <input type="hidden" name="documentId" value={data.documentId} />
                  <dl className="space-y-1 text-[13px]">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-ink-500">Aan</dt>
                      <dd className="min-w-0 text-ink">
                        {klant.naam} — {klant.email}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-bold text-ink-500">Bijlage</dt>
                      <dd className="min-w-0 truncate text-ink">{data.bestandsnaam}</dd>
                    </div>
                  </dl>
                  <label className="mt-4 block">
                    <span className="text-[12.5px] font-bold text-ink-700">Onderwerp</span>
                    <input name="onderwerp" defaultValue={data.onderwerp} className={invoer} />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-[12.5px] font-bold text-ink-700">Bericht</span>
                    <span className="block text-[11.5px] text-ink-300">
                      Een lege regel begint een nieuwe alinea. De ondertekening en de bijlage komen er
                      automatisch bij.
                    </span>
                    <textarea name="tekst" defaultValue={data.tekst} rows={13} className={cn(invoer, "leading-relaxed")} />
                  </label>

                  {state.status !== "idle" && state.message && (
                    <p className={cn("mt-3 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold", state.status === "error" ? "bg-brand-50 text-brand-600" : "bg-sage-100/70 text-sage-600")}>
                      {state.message}
                    </p>
                  )}
                  {fout && <Fout tekst={fout} />}

                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={maakPdf}
                      disabled={pending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold text-ink-500 transition hover:bg-cream disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> PDF opnieuw maken
                    </button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button
                        type="submit"
                        name="proef"
                        value="1"
                        disabled={pending}
                        className="rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-ink ring-1 ring-ink/15 transition hover:bg-cream disabled:opacity-50"
                      >
                        Proef naar mezelf
                      </button>
                      <button
                        type="submit"
                        name="proef"
                        value="0"
                        disabled={pending}
                        className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                      >
                        {pending ? "Bezig…" : "Afsluitmail versturen"}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Fout({ tekst }: { tekst: string }) {
  return <p className="mt-4 rounded-xl bg-brand-50 px-4 py-2.5 text-[12.5px] font-semibold text-brand-600">{tekst}</p>;
}

const invoer =
  "mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

/** De afgeronde (of afgevallen) aanvraag: wat er gebeurde, de PDF, en heropenen. */
export function AfgerondPanel({
  leadId,
  afgerond,
  demoUrl,
}: {
  leadId: string;
  /** Null bij een aanvraag die met de hand op afgevallen is gezet. */
  afgerond: {
    op: string;
    pdf: { id: string; bestandsnaam: string } | null;
    mail: { naar: string; op: string } | null;
  } | null;
  demoUrl: string | null;
}) {
  const [state, action, pending] = useActionState(heropen, IDLE);
  const [bevestigen, setBevestigen] = useState(false);
  const datum = (iso: string) =>
    new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
  return (
    <div className="rounded-2xl bg-cream-100/70 p-5 ring-1 ring-ink/5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-200 text-ink-500">
          <Archive className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-snug text-ink">
            {afgerond ? "Demo afgerond" : "Aanvraag afgevallen"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            {afgerond
              ? `Afgerond op ${datum(afgerond.op)}. De aanvraag, mails, documenten en tijdlijn blijven bewaard.`
              : "Deze aanvraag is als afgevallen gemarkeerd. Alles blijft bewaard."}
          </p>
          {afgerond?.mail && (
            <p className="mt-1 text-[12.5px] text-ink-500">
              <span className="font-bold text-ink-700">Afsluitmail:</span> verstuurd aan {afgerond.mail.naar} op{" "}
              {datum(afgerond.mail.op)}, met de PDF als bijlage.
            </p>
          )}
          {afgerond?.pdf && (
            <a
              href={`/api/admin/documenten/${afgerond.pdf.id}/bestand`}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-brand"
            >
              <FileText className="h-3.5 w-3.5" /> {afgerond.pdf.bestandsnaam}
            </a>
          )}
          {afgerond && demoUrl && (
            <p className="mt-2 text-[12.5px] text-ink-500">
              <span className="font-bold text-ink-700">Klaar om offline te halen:</span> {demoUrl}
              <span className="block text-[11.5px] text-ink-300">
                DogWare haalt de demo niet zelf offline — dat doe je bewust in Vercel.
              </span>
            </p>
          )}
          {!bevestigen ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setBevestigen(true)}
                className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream"
              >
                Aanvraag heropenen
              </button>
            </div>
          ) : (
          <form action={action} className="mt-4 rounded-xl bg-white p-4 ring-1 ring-ink/10">
            <input type="hidden" name="leadId" value={leadId} />
            <p className="text-[13px] font-bold text-ink">Aanvraag weer actief maken?</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
              De aanvraag gaat terug naar Aanvragen en de journey gaat verder waar hij stond. De PDF,
              de afsluitmail en de tijdlijn blijven gewoon bewaard.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-60">
                {pending ? "Een moment…" : "Ja, heropenen"}
              </button>
              <button type="button" onClick={() => setBevestigen(false)} disabled={pending} className="rounded-full px-3 py-2 text-[12.5px] font-bold text-ink-500 transition hover:bg-cream">
                Annuleren
              </button>
            </div>
            {state.message && (
              <span className={cn("text-[12px] font-semibold", state.status === "error" ? "text-brand-600" : "text-sage-600")}>
                {state.message}
              </span>
            )}
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
