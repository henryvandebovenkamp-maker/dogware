"use client";

import { useActionState, useState } from "react";
import { Loader2, Mail, RotateCcw, Send } from "lucide-react";
import {
  crediteerFactuur,
  verstuurFactuur,
  verstuurFactuurKopie,
  type FactuurState,
} from "../actions";

const LEEG: FactuurState = { status: "idle" };

/**
 * De handelingen op een factuur.
 *
 * Versturen is één klik; crediteren niet. Een creditnota is een echte
 * boekhoudkundige handeling, dus die zit achter een uitklap met een verplichte
 * reden — die reden komt in het auditlogboek en op de klanttijdlijn te staan.
 */
export function FactuurActies({
  documentId,
  klantEmail,
  eerderVerstuurdAan,
  crediteerbaar,
}: {
  documentId: string;
  klantEmail: string;
  eerderVerstuurdAan: string | null;
  crediteerbaar: boolean;
}) {
  const [mailState, mailAction, mailBezig] = useActionState(verstuurFactuur, LEEG);
  const [kopieState, kopieAction, kopieBezig] = useActionState(verstuurFactuurKopie, LEEG);
  const [creditState, creditAction, creditBezig] = useActionState(crediteerFactuur, LEEG);
  const [creditOpen, setCreditOpen] = useState(false);
  const [kopieOpen, setKopieOpen] = useState(false);
  const [publiek, setPubliek] = useState(false);

  return (
    <div className="space-y-3">
      <form action={mailAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="documentId" value={documentId} />
        <button
          type="submit"
          disabled={mailBezig}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-60"
        >
          {mailBezig ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : eerderVerstuurdAan ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          {eerderVerstuurdAan ? "Opnieuw naar de klant" : "Versturen naar de klant"}
        </button>
        <span className="text-[12px] text-ink-300">naar {klantEmail}</span>
        <Melding state={mailState} />
      </form>

      {/* Kopie naar een ander adres — jezelf, je boekhouder. */}
      <div>
        {!kopieOpen ? (
          <button
            type="button"
            onClick={() => setKopieOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink shadow-soft ring-1 ring-ink/5 transition hover:shadow-lift"
          >
            <Send className="h-3.5 w-3.5" />
            Versturen naar een ander adres…
          </button>
        ) : (
          <form action={kopieAction} className="rounded-xl bg-cream-100 p-3 ring-1 ring-ink/5">
            <input type="hidden" name="documentId" value={documentId} />
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-300">
                Stuur een kopie naar
              </span>
              <input
                type="email"
                name="naar"
                required
                autoFocus
                placeholder="jij@voorbeeld.nl"
                className="w-full rounded-lg bg-white px-3 py-2 text-[13px] text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink-300 focus:ring-brand/40"
              />
            </label>

            <label className="mt-2.5 flex items-start gap-2">
              <input
                type="checkbox"
                name="publiekeLink"
                checked={publiek}
                onChange={(e) => setPubliek(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#e0562a]"
              />
              <span className="text-[12.5px] leading-relaxed text-ink-500">
                De ontvanger kan de factuur openen zonder in te loggen.
              </span>
            </label>

            {/*
              Geen verstopte waarschuwing: de persoonlijke link van de klant
              opent het hele traject, niet alleen deze factuur. Wie dat aanzet
              hoort te weten wat hij weggeeft.
            */}
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                publiek
                  ? "bg-brand-50 text-brand-600 ring-1 ring-brand/10"
                  : "bg-white/70 text-ink-500"
              }`}
            >
              {publiek ? (
                <>
                  <span className="font-bold">Let op:</span> de mail bevat dan de persoonlijke
                  link van de klant. Die geeft zonder inloggen toegang tot het hele traject —
                  voorstel, overeenkomst en betalingen. Stuur hem alleen naar jezelf of iemand
                  die dat mag zien.
                </>
              ) : (
                <>De knop in de mail wijst naar de beheeromgeving en vraagt om een login. Veilig
                voor elk adres, maar alleen te openen door een beheerder.</>
              )}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={kopieBezig}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-60"
              >
                {kopieBezig ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Kopie versturen
              </button>
              <button
                type="button"
                onClick={() => setKopieOpen(false)}
                className="text-[12.5px] font-semibold text-ink-300 transition hover:text-ink"
              >
                Annuleren
              </button>
              <Melding state={kopieState} />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-300">
              Een kopie verandert niets aan de administratie: de factuur blijft gelden als niet
              verstuurd aan de klant. Hij komt wel in het e-maillogboek en als interne regel op
              de tijdlijn.
            </p>
          </form>
        )}
      </div>

      {crediteerbaar && (
        <div>
          {!creditOpen ? (
            <button
              type="button"
              onClick={() => setCreditOpen(true)}
              className="text-[12.5px] font-semibold text-ink-300 underline-offset-2 transition hover:text-brand-600 hover:underline"
            >
              Deze factuur crediteren…
            </button>
          ) : (
            <form action={creditAction} className="rounded-xl bg-cream-100 p-3 ring-1 ring-ink/5">
              <input type="hidden" name="documentId" value={documentId} />
              <p className="text-[12.5px] leading-relaxed text-ink-500">
                Er komt een aparte creditnota met een eigen nummer en spiegelbeeldige bedragen.
                Deze factuur blijft ongewijzigd bestaan — dat hoort zo.
              </p>
              <input
                name="reden"
                required
                minLength={5}
                placeholder="Waarom crediteren we deze factuur?"
                className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-[13px] text-ink ring-1 ring-ink/5 outline-none placeholder:text-ink-300 focus:ring-brand/40"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={creditBezig}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {creditBezig && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Creditnota aanmaken
                </button>
                <button
                  type="button"
                  onClick={() => setCreditOpen(false)}
                  className="text-[12.5px] font-semibold text-ink-300 transition hover:text-ink"
                >
                  Annuleren
                </button>
                <Melding state={creditState} />
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Melding({ state }: { state: FactuurState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <span
      className={`text-[12.5px] font-semibold ${
        state.status === "ok" ? "text-sage-600" : "text-brand-600"
      }`}
    >
      {state.message}
    </span>
  );
}
