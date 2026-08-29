"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  FileText,
  Link2,
  Lock,
  Receipt,
  RefreshCw,
  Repeat,
  ScrollText,
  Wallet,
} from "lucide-react";
import {
  addInternalNote,
  addTask,
  retryMandate,
  rotatePortalToken,
  toggleTask,
  type CommerceState,
} from "@/app/actions/commerce";
import { cn } from "@/lib/cn";

const IDLE: CommerceState = { status: "idle" };

/* ------------------------------------------------------------------ types -- */

export type FinancieelData = {
  subtotal: string;
  discount: string;
  net: string;
  vat: string;
  vatPercent: number;
  total: string;
  deposit: string;
  depositPercent: number;
  final: string;
  finalPercent: number;
  monthlyExVat: string;
  monthlyInclVat: string;
  freeMonths: number;
  startLabel: string;
  paid: string;
  outstanding: string;
};

export type VoorstelRij = {
  id: string;
  version: number;
  status: string;
  titel: string;
  sentAt: string | null;
  firstViewedAt: string | null;
  viewCount: number;
  acceptedAt: string | null;
  acceptedName: string | null;
  geldigTot: string | null;
};

export type OvereenkomstData = {
  status: string;
  voorwaardenVersie: string;
  proposalVersion: number;
  signedAt: string | null;
  signerName: string | null;
  signerRole: string | null;
  signerKvk: string | null;
  signedIpHash: string | null;
};

export type BetalingRij = {
  id: string;
  /** Factuurnummer van de bijbehorende factuur, als die er is. */
  factuurNummer: string | null;
  type: string;
  status: string;
  bedrag: string;
  referentie: string | null;
  molliePaymentId: string | null;
  sequenceType: string | null;
  paidAt: string | null;
  createdAt: string;
  failureReason: string | null;
};

export type AbonnementData = {
  maandbedrag: string;
  mandaatActief: boolean;
  mandaatId: string | null;
  subscriptionId: string | null;
  startAt: string | null;
  startLabel: string;
  heeftAbonnement: boolean;
};

export type DocumentRij = {
  id: string;
  nummer: string;
  type: string;
  titel: string;
  bedrag: string | null;
  issuedAt: string;
};

export type TaakRij = {
  id: string;
  label: string;
  done: boolean;
  /** ISO-datum van de deadline, of null als de taak er geen heeft. */
  dueAt: string | null;
  /** Deadline verstreken en nog niet af. */
  teLaat: boolean;
};

/** Eén verstuurde mail, voor het logboek bij de aanvraag. */
export type MailRij = {
  id: string;
  soort: string;
  onderwerp: string;
  ontvanger: string;
  gelukt: boolean;
  fout: string | null;
  verstuurdOp: string;
};

export type TijdlijnRij = {
  id: string;
  label: string;
  actor: string;
  internal: boolean;
  kind: string;
  createdAt: string;
};

export type BouwData = {
  gestartOp: string | null;
  opleveringOp: string | null;
  liveOp: string | null;
};

/* ------------------------------------------------------------------- ui --- */

const datum = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
    : "—";
const datumTijd = (iso: string) =>
  `${new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} ${new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;

/**
 * De commerciële klantkaart, in rustige inklapbare secties.
 *
 * Alleen "Financieel" staat standaard open — dat is wat de beheerder het vaakst
 * nodig heeft. De rest is er wél, maar vraagt geen aandacht tot je erom vraagt.
 */
export function CommerceSecties(props: {
  leadId: string;
  klantLink: string | null;
  financieel: FinancieelData;
  voorstellen: VoorstelRij[];
  overeenkomst: OvereenkomstData | null;
  betalingen: BetalingRij[];
  abonnement: AbonnementData;
  documenten: DocumentRij[];
  taken: TaakRij[];
  mails: MailRij[];
  tijdlijn: TijdlijnRij[];
  bouw: BouwData;
}) {
  const f = props.financieel;
  return (
    <div className="space-y-3">
      {/* Kerncijfers — altijd zichtbaar */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kaart label="Totaal incl. btw" value={f.total} />
        <Kaart label={`1e termijn (${f.depositPercent}%)`} value={f.deposit} tint="brand" />
        <Kaart label={`2e termijn (${f.finalPercent}%)`} value={f.final} tint="brand" />
        <Kaart
          label="Openstaand"
          value={f.outstanding}
          tint={f.outstanding === "€ 0,00" ? "sage" : "ink"}
        />
      </div>

      <Sectie titel="Financieel" icon={<Wallet className="h-4 w-4" />} open>
        <dl className="space-y-1.5 text-[14px]">
          <Regel label="Subtotaal" value={f.subtotal} />
          {f.discount !== "€ 0,00" && <Regel label="Korting" value={`− ${f.discount}`} />}
          <Regel label="Netto excl. btw" value={f.net} sterk />
          <Regel label={`Btw ${f.vatPercent}%`} value={f.vat} />
          <Regel label="Totaal incl. btw" value={f.total} sterk />
          <div className="my-2 border-t border-cream-100" />
          <Regel label="Reeds betaald" value={f.paid} />
          <Regel label="Nog openstaand" value={f.outstanding} sterk />
        </dl>
        <div className="mt-4 rounded-xl bg-sage-100/60 p-3.5">
          <p className="text-[12.5px] font-bold text-sage-600">DogWare abonnement</p>
          <p className="mt-0.5 text-[15px] font-extrabold text-ink">
            {f.monthlyExVat} <span className="text-[12px] font-semibold text-ink-500">excl. btw p/m</span>
          </p>
          <p className="text-[12px] text-ink-500">
            {f.monthlyInclVat} incl. btw
            {f.freeMonths > 0 && ` · eerste ${f.freeMonths} ${f.freeMonths === 1 ? "maand" : "maanden"} gratis`}
          </p>
          <p className="mt-1 text-[12px] text-ink-300">{f.startLabel}</p>
        </div>
        <Link
          href={`/admin/leads/${props.leadId}/voorstel`}
          className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-brand hover:text-brand-600"
        >
          Bedragen aanpassen in de voorstel-editor →
        </Link>
      </Sectie>

      <Sectie
        titel="Voorstel"
        icon={<FileText className="h-4 w-4" />}
        badge={props.voorstellen.length ? `${props.voorstellen.length} versie(s)` : "nog geen"}
      >
        {props.voorstellen.length === 0 ? (
          <Leeg>Er is nog geen voorstel gemaakt.</Leeg>
        ) : (
          <ul className="space-y-2">
            {props.voorstellen.map((p) => (
              <li key={p.id} className="rounded-xl bg-cream-100/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-extrabold text-ink">
                    Versie {p.version}
                    {p.titel ? ` — ${p.titel}` : ""}
                  </span>
                  <StatusPil status={p.status} />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                  {p.sentAt ? `Verstuurd ${datum(p.sentAt)}` : "Nog niet verstuurd"}
                  {p.firstViewedAt && ` · bekeken ${datum(p.firstViewedAt)} (${p.viewCount}×)`}
                  {p.geldigTot && ` · geldig t/m ${datum(p.geldigTot)}`}
                </p>
                {p.acceptedAt && (
                  <p className="mt-1 text-[12px] font-semibold text-sage-600">
                    Geaccepteerd op {datumTijd(p.acceptedAt)}
                    {p.acceptedName ? ` door ${p.acceptedName}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sectie>

      <Sectie
        titel="Overeenkomst"
        icon={<ScrollText className="h-4 w-4" />}
        badge={props.overeenkomst?.signedAt ? "getekend" : props.overeenkomst ? "wacht" : "nog geen"}
      >
        {!props.overeenkomst ? (
          <Leeg>De overeenkomst wordt klaargezet zodra de klant het voorstel accepteert.</Leeg>
        ) : (
          <dl className="space-y-1.5 text-[13.5px]">
            <Regel label="Voorwaardenversie" value={props.overeenkomst.voorwaardenVersie} />
            <Regel label="Hoort bij voorstel" value={`versie ${props.overeenkomst.proposalVersion}`} />
            <Regel label="Status" value={props.overeenkomst.status} />
            {props.overeenkomst.signedAt && (
              <>
                <Regel label="Getekend op" value={datumTijd(props.overeenkomst.signedAt)} />
                <Regel label="Door" value={props.overeenkomst.signerName ?? "—"} />
                <Regel label="Functie" value={props.overeenkomst.signerRole ?? "—"} />
                <Regel label="KvK" value={props.overeenkomst.signerKvk ?? "—"} />
                <Regel
                  label="Audit"
                  value={`IP-hash ${props.overeenkomst.signedIpHash?.slice(0, 12) ?? "—"}…`}
                />
              </>
            )}
          </dl>
        )}
      </Sectie>

      <Sectie
        titel="Betalingen"
        icon={<Receipt className="h-4 w-4" />}
        badge={props.betalingen.length ? `${props.betalingen.length}` : "nog geen"}
      >
        {props.betalingen.length === 0 ? (
          <Leeg>Er is nog geen betaling gestart.</Leeg>
        ) : (
          <ul className="space-y-2">
            {props.betalingen.map((b) => (
              <li key={b.id} className="rounded-xl bg-cream-100/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-extrabold text-ink">
                    {BETAAL_LABEL[b.type] ?? b.type} · {b.bedrag}
                  </span>
                  <StatusPil status={b.status} />
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-ink-300">
                  {b.referentie ?? "—"}
                  {b.molliePaymentId && ` · ${b.molliePaymentId}`}
                  {b.sequenceType && b.sequenceType !== "oneoff" && ` · ${b.sequenceType}`}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  Gestart {datumTijd(b.createdAt)}
                  {b.paidAt && ` · betaald ${datumTijd(b.paidAt)}`}
                </p>
                {b.failureReason && (
                  <p className="mt-1 text-[12px] font-semibold text-brand-600">{b.failureReason}</p>
                )}
                {b.factuurNummer && (
                  <Link
                    href={`/admin/leads/${props.leadId}/factuur/${b.factuurNummer}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-brand hover:text-brand-600"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Factuur {b.factuurNummer} bekijken
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sectie>

      <Sectie
        titel="Maandabonnement"
        icon={<Repeat className="h-4 w-4" />}
        badge={
          !props.abonnement.heeftAbonnement
            ? "geen"
            : props.abonnement.mandaatActief
              ? "mandaat actief"
              : "nog geen mandaat"
        }
      >
        {!props.abonnement.heeftAbonnement ? (
          <Leeg>Er is geen maandbedrag afgesproken.</Leeg>
        ) : (
          <>
            <dl className="space-y-1.5 text-[13.5px]">
              <Regel label="Maandbedrag" value={`${props.abonnement.maandbedrag} excl. btw`} />
              <Regel
                label="Incassomandaat"
                value={props.abonnement.mandaatActief ? "Actief" : "Nog niet actief"}
              />
              {props.abonnement.mandaatId && (
                <Regel label="Mandaat-ID" value={props.abonnement.mandaatId} />
              )}
              {props.abonnement.subscriptionId && (
                <Regel label="Abonnement-ID" value={props.abonnement.subscriptionId} />
              )}
              <Regel label="Eerste incasso" value={datum(props.abonnement.startAt)} />
            </dl>
            <p className="mt-2 text-[12px] text-ink-300">{props.abonnement.startLabel}</p>
            <p className="mt-2 rounded-lg bg-cream-100/70 px-3 py-2 text-[12px] leading-relaxed text-ink-500">
              De klant gaf bij het tekenen inhoudelijk akkoord op het maandbedrag. Het mandaat wordt
              technisch geactiveerd bij de tweede termijn.
            </p>
            {!props.abonnement.mandaatActief && (
              <div className="mt-3">
                <MiniForm
                  leadId={props.leadId}
                  action={retryMandate}
                  label="Mandaat opnieuw proberen"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                />
              </div>
            )}
          </>
        )}
      </Sectie>

      <Sectie
        titel="Documenten"
        icon={<Receipt className="h-4 w-4" />}
        badge={props.documenten.length ? `${props.documenten.length}` : "nog geen"}
      >
        {props.documenten.length === 0 ? (
          <Leeg>Documenten worden automatisch vastgelegd bij versturen, tekenen en betalen.</Leeg>
        ) : (
          <ul className="space-y-1.5">
            {props.documenten.map((d) => {
              const isFactuur = d.type.startsWith("INVOICE");
              const regel = (
                <>
                  <span className="min-w-0">
                    <span className="font-mono text-[11.5px] font-bold text-ink-500">{d.nummer}</span>{" "}
                    <span className={isFactuur ? "font-semibold text-brand" : "text-ink-700"}>
                      {d.titel}
                    </span>
                  </span>
                  <span className="tabular-nums text-ink-500">
                    {d.bedrag ?? ""} <span className="text-ink-300">{datum(d.issuedAt)}</span>
                  </span>
                </>
              );
              return (
                <li key={d.id} className="text-[13px]">
                  {isFactuur ? (
                    <Link
                      href={`/admin/leads/${props.leadId}/factuur/${d.nummer}`}
                      className="-mx-2 flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-2 py-1 transition hover:bg-cream-100/70"
                    >
                      {regel}
                    </Link>
                  ) : (
                    <span className="flex flex-wrap items-baseline justify-between gap-2">{regel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sectie>

      <Sectie titel="Project en bouw" icon={<Check className="h-4 w-4" />}>
        <dl className="space-y-1.5 text-[13.5px]">
          <Regel label="Bouw gestart" value={datum(props.bouw.gestartOp)} />
          <Regel label="Oplevering klaargezet" value={datum(props.bouw.opleveringOp)} />
          <Regel label="Live sinds" value={datum(props.bouw.liveOp)} />
        </dl>
        {props.taken.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {props.taken.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-2">
                <TaakKnop leadId={props.leadId} taak={t} />
                {t.dueAt && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      t.teLaat ? "text-brand-600" : "text-ink-300",
                    )}
                  >
                    {t.teLaat ? "te laat · " : ""}
                    {new Date(t.dueAt).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <TaakToevoegen leadId={props.leadId} />
      </Sectie>

      <Sectie titel="Verstuurde e-mail" icon={<Check className="h-4 w-4" />}>
        {props.mails.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Nog geen mail vastgelegd. Het logboek vult zich vanaf de eerstvolgende
            mail die vanuit dit dossier wordt verstuurd; wat daarvóór is
            verstuurd staat alleen op de tijdlijn.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {props.mails.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-cream-100 pb-1.5 last:border-0"
              >
                <span className="text-[12.5px] font-semibold text-ink">
                  {m.onderwerp}
                </span>
                <span className="text-[11px] text-ink-300">
                  {new Date(m.verstuurdOp).toLocaleString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {m.ontvanger}
                </span>
                {!m.gelukt && (
                  <span className="text-[11px] font-bold text-brand-600">
                    mislukt{m.fout ? ` — ${m.fout}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sectie>

      <Sectie
        titel="Klantomgeving"
        icon={<Link2 className="h-4 w-4" />}
        badge={props.klantLink ? "actief" : "—"}
      >
        {props.klantLink ? (
          <>
            <p className="text-[12.5px] leading-relaxed text-ink-500">
              De persoonlijke, beveiligde link die de klant in elke mail krijgt. Deel hem alleen met
              de klant.
            </p>
            <KopieerLink url={props.klantLink} />
            <div className="mt-3">
              <MiniForm
                leadId={props.leadId}
                action={rotatePortalToken}
                label="Nieuwe link maken (oude vervalt)"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              />
            </div>
          </>
        ) : (
          <Leeg>Er is nog geen klantomgeving.</Leeg>
        )}
      </Sectie>

      <Sectie
        titel="Tijdlijn"
        icon={<Lock className="h-4 w-4" />}
        badge={`${props.tijdlijn.length}`}
      >
        <NotitieForm leadId={props.leadId} />
        {props.tijdlijn.length === 0 ? (
          <Leeg>Nog geen activiteit.</Leeg>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {props.tijdlijn.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="w-[86px] shrink-0 pt-0.5 text-[11px] tabular-nums text-ink-300">
                  {datumTijd(e.createdAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-[13px] leading-relaxed",
                      e.internal ? "text-ink-500" : "text-ink-700",
                    )}
                  >
                    {e.label}
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1 align-middle">
                    <ActorPil actor={e.actor} />
                    {e.internal && (
                      <span className="rounded-full bg-cream-200 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink-500">
                        intern
                      </span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sectie>
    </div>
  );
}

/* -------------------------------------------------------------- onderdelen */

const BETAAL_LABEL: Record<string, string> = {
  DEPOSIT: "Eerste termijn",
  FINAL_PAYMENT: "Tweede termijn",
  SUBSCRIPTION: "Abonnement",
  MANUAL_CORRECTION: "Correctie",
  REFUND: "Terugbetaling",
};

function Sectie({
  titel,
  icon,
  badge,
  open,
  children,
}: {
  titel: string;
  icon: React.ReactNode;
  badge?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="group rounded-2xl bg-white shadow-soft ring-1 ring-ink/5 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span className="text-ink-300">{icon}</span>
        <span className="flex-1 text-[14px] font-extrabold text-ink">{titel}</span>
        {badge && (
          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-[11px] font-bold text-ink-500">
            {badge}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-open:rotate-180"
          fill="none"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="border-t border-cream-100 px-5 py-4">{children}</div>
    </details>
  );
}

function Kaart({
  label,
  value,
  tint = "ink",
}: {
  label: string;
  value: string;
  tint?: "ink" | "brand" | "sage";
}) {
  return (
    <div className="rounded-xl bg-white p-3.5 shadow-soft ring-1 ring-ink/5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-300">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-extrabold tabular-nums",
          tint === "brand" && "text-brand",
          tint === "sage" && "text-sage-600",
          tint === "ink" && "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Regel({ label, value, sterk }: { label: string; value: string; sterk?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className={cn("text-ink-500", sterk && "font-bold text-ink")}>{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-all text-right tabular-nums text-ink-700",
          sterk && "font-extrabold text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Leeg({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-ink-300">{children}</p>;
}

function StatusPil({ status }: { status: string }) {
  const groen = ["PAID", "ACCEPTED", "SIGNED"].includes(status);
  const rood = ["FAILED", "EXPIRED", "CANCELED", "REJECTED"].includes(status);
  const grijs = ["SUPERSEDED", "DRAFT"].includes(status);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
        groen && "bg-sage-100 text-sage-600",
        rood && "bg-brand-100 text-brand-600",
        grijs && "bg-cream-200 text-ink-300",
        !groen && !rood && !grijs && "bg-[#2f6bed]/10 text-[#2f6bed]",
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

function ActorPil({ actor }: { actor: string }) {
  const label = actor === "klant" ? "klant" : actor === "admin" ? "Henry" : "systeem";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide",
        actor === "klant" && "bg-brand-100 text-brand-600",
        actor === "admin" && "bg-[#2f6bed]/10 text-[#2f6bed]",
        actor === "systeem" && "bg-cream-100 text-ink-300",
      )}
    >
      {label}
    </span>
  );
}

function KopieerLink({ url }: { url: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-cream-100 px-3 py-2 font-mono text-[11.5px] text-ink-500">
        {url}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setGekopieerd(true);
            setTimeout(() => setGekopieerd(false), 1800);
          });
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12px] font-bold text-cream transition hover:bg-ink-700"
      >
        {gekopieerd ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {gekopieerd ? "Gekopieerd" : "Kopieer"}
      </button>
    </div>
  );
}

type ActionFn = (prev: CommerceState, fd: FormData) => Promise<CommerceState>;

function MiniForm({
  leadId,
  action,
  label,
  icon,
}: {
  leadId: string;
  action: ActionFn;
  label: string;
  icon?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2.5">
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream disabled:opacity-60"
      >
        {icon}
        {pending ? "Bezig…" : label}
      </button>
      {state.message && (
        <span
          className={cn(
            "text-[11.5px] font-semibold",
            state.status === "error" ? "text-brand-600" : "text-sage-600",
          )}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

/**
 * Een taak erbij. De deadline is optioneel en staat er bewust naast in plaats
 * van als verplicht veld: de meeste taken zijn "doen wanneer het uitkomt", en
 * een datum die je moet invullen om verder te komen wordt een verzonnen datum.
 */
function TaakToevoegen({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addTask, IDLE);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input
        name="label"
        required
        placeholder="Nieuwe taak"
        className="min-w-0 flex-1 basis-40 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand"
      />
      <input
        name="dueAt"
        type="date"
        aria-label="Deadline (optioneel)"
        className="rounded-lg border border-cream-200 bg-white px-2.5 py-1.5 text-[12.5px] text-ink-700 outline-none transition focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-60"
      >
        {pending ? "…" : "Toevoegen"}
      </button>
      {state.message && (
        <span
          className={cn(
            "basis-full text-[11.5px] font-semibold",
            state.status === "error" ? "text-brand-600" : "text-sage-600",
          )}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

function TaakKnop({ leadId, taak }: { leadId: string; taak: TaakRij }) {
  const [, formAction, pending] = useActionState(toggleTask, IDLE);
  return (
    <form action={formAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="taskId" value={taak.id} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-left transition hover:bg-cream-100/70 disabled:opacity-60"
      >
        <span
          className={cn(
            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border",
            taak.done ? "border-sage bg-sage text-white" : "border-cream-200 bg-white",
          )}
          style={{ height: 18, width: 18 }}
        >
          {taak.done && <Check className="h-3 w-3" />}
        </span>
        <span
          className={cn(
            "text-[13px]",
            taak.done ? "text-ink-300 line-through" : "text-ink-700",
          )}
        >
          {taak.label}
        </span>
      </button>
    </form>
  );
}

function NotitieForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addInternalNote, IDLE);
  return (
    <form action={formAction} className="rounded-xl bg-cream-100/60 p-3.5">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="block text-[12px] font-bold text-ink-700">
        Interne notitie
        <span className="ml-1.5 font-normal text-ink-300">— nooit zichtbaar voor de klant</span>
      </label>
      <textarea
        name="notitie"
        rows={2}
        className="mt-1.5 w-full resize-y rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
        placeholder="Wat wil je onthouden?"
      />
      <div className="mt-2 flex items-center gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-bold text-cream transition hover:bg-ink-700 disabled:opacity-60"
        >
          {pending ? "Opslaan…" : "Notitie toevoegen"}
        </button>
        {state.message && (
          <span
            className={cn(
              "text-[11.5px] font-semibold",
              state.status === "error" ? "text-brand-600" : "text-sage-600",
            )}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
