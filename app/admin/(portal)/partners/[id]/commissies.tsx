"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  bereidUitbetalingVoorActie,
  controleerCommissieActie,
  keurUitbetalingGoedActie,
  markeerUitbetaaldActie,
  trekVoorbereidingInActie,
  verstuurCommissieMailOpnieuw,
  type CommissieActieState,
} from "@/app/actions/partner-commissies";
import type { CommissieStatus } from "@/lib/db/schema";

/**
 * Commissies en uitbetalingen van één partner — per aanbreng één kaart, met
 * precies de actie die bij de huidige status hoort. De server bepaalt wat er
 * mag; deze component laat alleen zien wat er kan.
 */

export type CommissieKaart = {
  leadId: string;
  bedrijfsnaam: string;
  commissieId: string | null;
  status: CommissieStatus | null;
  statusLabel: string;
  bedrag: string;
  /** Bedrag als invoerwaarde ("500,00") voor het uitbetaalformulier. */
  bedragInvoer: string;
  betaling: {
    tekst: string;
    volledig: boolean;
  };
  feiten: { label: string; waarde: string }[];
  payableMailVerstuurd: boolean;
  paidMailVerstuurd: boolean;
  /** Begunstigde zoals bevroren bij het voorbereiden. */
  begunstigde: { naam: string; ibanGemaskeerd: string; ibanVoluit: string | null } | null;
};

const IDLE: CommissieActieState = { status: "idle" };

const KNOP =
  "rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60";
const VELD =
  "w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand";

function Feedback({ state }: { state: CommissieActieState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={`mt-2 text-[12px] font-semibold ${
        state.status === "error" ? "text-brand-600" : "text-sage-600"
      }`}
    >
      {state.message}
    </p>
  );
}

const TINT: Record<CommissieStatus | "geen", string> = {
  geen: "bg-cream-100 text-ink-700",
  WACHT_OP_BETALING: "bg-gold/10 text-ink-700",
  UITBETAALBAAR: "bg-brand/10 text-brand-600",
  VOORBEREID: "bg-[#2f6bed]/10 text-[#2f6bed]",
  GOEDGEKEURD: "bg-[#2f6bed]/10 text-[#2f6bed]",
  UITBETAALD: "bg-sage-100 text-sage-600",
  VERVALLEN: "bg-cream-100 text-ink-300",
};

export function PartnerCommissies({
  kaarten,
  financieelBevoegd,
  bankBekend,
}: {
  kaarten: CommissieKaart[];
  financieelBevoegd: boolean;
  /** Heeft de partner zelf al bankgegevens ingevuld? (gemaskeerd) */
  bankBekend: { naam: string; ibanGemaskeerd: string } | null;
}) {
  if (kaarten.length === 0) {
    return (
      <p className="py-4 text-center text-[13px] text-ink-300">
        Nog geen aanbrengingen met een commissie. Een commissie ontstaat zodra
        een aangebrachte klant het voorstel accepteert.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {kaarten.map((k) => (
        <li key={k.leadId} className="rounded-xl bg-cream/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/admin/leads/${k.leadId}`}
                className="block truncate text-[14px] font-extrabold text-ink hover:underline"
              >
                {k.bedrijfsnaam}
              </Link>
              <p className="text-[12px] text-ink-500">
                Commissie <span className="font-bold text-ink">{k.bedrag}</span>
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${TINT[k.status ?? "geen"]}`}>
              {k.statusLabel}
            </span>
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:col-span-2">
              <dt className="text-ink-500">Betaling klant</dt>
              <dd className={`text-right font-bold ${k.betaling.volledig ? "text-sage-600" : "text-ink"}`}>
                {k.betaling.tekst}
              </dd>
            </div>
            {k.feiten.map((f) => (
              <div key={f.label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-ink-500">{f.label}</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-ink">{f.waarde}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 border-t border-cream-200 pt-3">
            <Acties k={k} financieelBevoegd={financieelBevoegd} bankBekend={bankBekend} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Acties({
  k,
  financieelBevoegd,
  bankBekend,
}: {
  k: CommissieKaart;
  financieelBevoegd: boolean;
  bankBekend: { naam: string; ibanGemaskeerd: string } | null;
}) {
  if (!k.status || k.status === "WACHT_OP_BETALING") return <Controleren leadId={k.leadId} />;
  if (k.status === "UITBETAALBAAR") {
    return (
      <>
        <Voorbereiden commissieId={k.commissieId!} bedrag={k.bedrag} bankBekend={bankBekend} />
        {!k.payableMailVerstuurd && <MailOpnieuw commissieId={k.commissieId!} moment="uitbetaalbaar" />}
      </>
    );
  }
  if (k.status === "VOORBEREID") {
    return (
      <>
        {financieelBevoegd ? (
          <Goedkeuren commissieId={k.commissieId!} k={k} />
        ) : (
          <p className="text-[12px] text-ink-500">
            Wacht op goedkeuring door een financieel bevoegde beheerder.
          </p>
        )}
        <Intrekken commissieId={k.commissieId!} />
      </>
    );
  }
  if (k.status === "GOEDGEKEURD") {
    return (
      <>
        {financieelBevoegd ? (
          <Uitbetaald k={k} />
        ) : (
          <p className="text-[12px] text-ink-500">
            Goedgekeurd. Alleen een financieel bevoegde beheerder kan de
            overschrijving vastleggen.
          </p>
        )}
        <Intrekken commissieId={k.commissieId!} />
      </>
    );
  }
  if (k.status === "UITBETAALD" && !k.paidMailVerstuurd) {
    return <MailOpnieuw commissieId={k.commissieId!} moment="uitbetaald" />;
  }
  return <p className="text-[12px] text-ink-300">Geen actie nodig.</p>;
}

function Controleren({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(controleerCommissieActie, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-[12px] text-ink-500">
        Controleert of de klant de eenmalige investering volledig heeft betaald
        — live bij Mollie. Pas dan wordt de commissie uitbetaalbaar en krijgt
        de partner bericht.
      </p>
      <button type="submit" disabled={pending} className={`${KNOP} mt-2 bg-ink text-cream hover:bg-ink-700`}>
        {pending ? "Controleren…" : "Betalingen controleren"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function Voorbereiden({
  commissieId,
  bedrag,
  bankBekend,
}: {
  commissieId: string;
  bedrag: string;
  bankBekend: { naam: string; ibanGemaskeerd: string } | null;
}) {
  const [state, action, pending] = useActionState(bereidUitbetalingVoorActie, IDLE);
  const [anders, setAnders] = useState(!bankBekend);
  return (
    <form action={action}>
      <input type="hidden" name="commissieId" value={commissieId} />
      <p className="text-[12px] font-bold text-ink">Uitbetaling voorbereiden — {bedrag}</p>
      {bankBekend && !anders ? (
        <p className="mt-1 text-[12px] text-ink-500">
          Naar {bankBekend.naam} · <span className="font-mono">{bankBekend.ibanGemaskeerd}</span>{" "}
          (door de partner ingevuld).{" "}
          <button type="button" onClick={() => setAnders(true)} className="font-semibold text-brand underline">
            Andere gegevens
          </button>
        </p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input name="rekeninghouder" placeholder="Rekeninghouder" autoComplete="off" className={VELD} />
          <input name="iban" placeholder="IBAN" autoComplete="off" className={`${VELD} font-mono`} />
          <p className="text-[11px] text-ink-300 sm:col-span-2">
            Wordt versleuteld op het partnerprofiel opgeslagen en (gemaskeerd) in
            de auditlog vastgelegd.
          </p>
        </div>
      )}
      <button type="submit" disabled={pending} className={`${KNOP} mt-2 bg-brand text-white hover:bg-brand-600`}>
        {pending ? "Voorbereiden…" : "Uitbetaling voorbereiden"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function Begunstigde({ k }: { k: CommissieKaart }) {
  if (!k.begunstigde) return null;
  return (
    <div className="mt-2 rounded-lg bg-white p-3 text-[12.5px] ring-1 ring-ink/5">
      <p>
        <span className="text-ink-500">Bedrag:</span> <span className="font-bold text-ink">{k.bedrag}</span>
      </p>
      <p>
        <span className="text-ink-500">Naar:</span> <span className="font-bold text-ink">{k.begunstigde.naam}</span>
      </p>
      <p className="break-all">
        <span className="text-ink-500">IBAN:</span>{" "}
        <span className="font-mono font-bold text-ink">
          {k.begunstigde.ibanVoluit ?? k.begunstigde.ibanGemaskeerd}
        </span>
      </p>
      <p>
        <span className="text-ink-500">Omschrijving:</span>{" "}
        <span className="font-semibold text-ink">DogWare partnercommissie {k.bedrijfsnaam}</span>
      </p>
    </div>
  );
}

function Goedkeuren({ commissieId, k }: { commissieId: string; k: CommissieKaart }) {
  const [state, action, pending] = useActionState(keurUitbetalingGoedActie, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="commissieId" value={commissieId} />
      <p className="text-[12px] font-bold text-ink">Goedkeuren</p>
      <Begunstigde k={k} />
      <p className="mt-2 text-[11px] text-ink-300">
        Bij goedkeuren worden de betalingen van de klant opnieuw live bij Mollie
        gecontroleerd.
      </p>
      <button type="submit" disabled={pending} className={`${KNOP} mt-2 bg-ink text-cream hover:bg-ink-700`}>
        {pending ? "Goedkeuren…" : "Uitbetaling goedkeuren"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function vandaag(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Uitbetaald({ k }: { k: CommissieKaart }) {
  const [state, action, pending] = useActionState(markeerUitbetaaldActie, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="commissieId" value={k.commissieId!} />
      <p className="text-[12px] font-bold text-ink">Overschrijving uitvoeren en vastleggen</p>
      <Begunstigde k={k} />
      <p className="mt-2 text-[12px] text-ink-500">
        Maak het bedrag eerst over via de bank. Leg daarna hier vast wanneer en
        met welk kenmerk. Pas dan krijgt de partner een bevestiging.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-ink-500">
          Datum overschrijving
          <input name="datum" type="date" required defaultValue={vandaag()} className={`${VELD} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-ink-500">
          Betalingskenmerk bank
          <input name="referentie" required minLength={3} maxLength={80} autoComplete="off" className={`${VELD} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-ink-500">
          Overgemaakt bedrag (€)
          <input name="bedrag" required inputMode="decimal" defaultValue={k.bedragInvoer} className={`${VELD} mt-1`} />
        </label>
      </div>
      <label className="mt-2 flex items-start gap-2 text-[12px] text-ink-700">
        <input type="checkbox" name="bevestigd" value="1" required className="mt-0.5" />
        Ik bevestig dat deze overschrijving daadwerkelijk door de bank is uitgevoerd.
      </label>
      <button type="submit" disabled={pending} className={`${KNOP} mt-2 bg-sage-600 text-white hover:opacity-90`}>
        {pending ? "Vastleggen…" : "Markeer als uitbetaald"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function Intrekken({ commissieId }: { commissieId: string }) {
  const [state, action, pending] = useActionState(trekVoorbereidingInActie, IDLE);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[12px] font-semibold text-ink-500 underline">
        Voorbereiding intrekken
      </button>
    );
  }
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="commissieId" value={commissieId} />
      <input name="reden" required placeholder="Reden (verplicht)" className={VELD} />
      <button type="submit" disabled={pending} className={`${KNOP} mt-2 bg-brand-600 text-white hover:bg-brand`}>
        {pending ? "Intrekken…" : "Bevestig intrekken"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function MailOpnieuw({ commissieId, moment }: { commissieId: string; moment: "uitbetaalbaar" | "uitbetaald" }) {
  const [state, action, pending] = useActionState(verstuurCommissieMailOpnieuw, IDLE);
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="commissieId" value={commissieId} />
      <input type="hidden" name="moment" value={moment} />
      <p className="text-[12px] text-brand-600">
        {moment === "uitbetaald"
          ? "De betaalbevestiging aan de partner is nog niet verstuurd."
          : "Het bericht \"commissie beschikbaar\" is nog niet verstuurd."}
      </p>
      <button type="submit" disabled={pending} className={`${KNOP} mt-2 bg-ink text-cream hover:bg-ink-700`}>
        {pending ? "Versturen…" : "Bericht opnieuw versturen"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
