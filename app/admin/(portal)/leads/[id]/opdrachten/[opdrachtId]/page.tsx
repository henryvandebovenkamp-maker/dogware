import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { ensureCommerce } from "@/lib/proposals";
import { euroFromCents } from "@/lib/money";
import { isMollieConfigured } from "@/lib/mollie";
import { proefOntvanger } from "@/lib/email/config";
import { geldigheidLabel, kalenderdag, eindeVanDag } from "@/lib/proposal-geldigheid";
import { isInvoiceType } from "@/lib/db/schema";
import {
  betalingenVan,
  getOpdracht,
  huidigeVersie,
  isOpdrachtVerlopen,
  listVersies,
  maandZin,
  ontbreektVoorVersturen,
  opdrachtUrl,
} from "@/lib/opdrachten/service";
import { centenNaarInvoer, leesInhoud, volgendeStap, type OpdrachtInhoud } from "@/lib/opdrachten/bedragen";
import {
  InterneNotitie,
  OpdrachtActies,
  OpdrachtEditor,
  OpdrachtVoortgang,
  StatusPil,
} from "@/components/commerce/opdrachten-admin";

export const metadata: Metadata = {
  title: "Aanvullende opdracht",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const tijdstip = (d: Date) =>
  d.toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const BETAAL_STATUS: Record<string, string> = {
  CREATED: "Wordt gestart",
  OPEN: "Open bij Mollie",
  PENDING: "In behandeling",
  PAID: "Betaald",
  FAILED: "Mislukt",
  EXPIRED: "Verlopen",
  CANCELED: "Afgebroken",
  REFUNDED: "Terugbetaald",
};

export default async function OpdrachtPage({
  params,
}: {
  params: Promise<{ id: string; opdrachtId: string }>;
}) {
  const { id, opdrachtId } = await params;
  const db = getDb();
  if (!db) notFound();
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
  if (!lead) notFound();
  const commerce = await ensureCommerce(id);
  if (!commerce) notFound();
  // Alleen een opdracht van déze klant; een id van een ander dossier bestaat hier niet.
  const order = await getOpdracht(opdrachtId, commerce.id);
  if (!order) notFound();

  const [versies, betalingen, documenten, events] = await Promise.all([
    listVersies(order.id),
    betalingenVan(order.id),
    db.select().from(schema.documents).where(eq(schema.documents.extraOrderId, order.id)).orderBy(asc(schema.documents.issuedAt)),
    db
      .select()
      .from(schema.journeyEvents)
      .where(eq(schema.journeyEvents.leadId, id))
      .orderBy(asc(schema.journeyEvents.createdAt)),
  ]);
  const eigenEvents = events.filter((e) => (e.meta as { extraOrderId?: string } | null)?.extraOrderId === order.id);

  const verlopen = isOpdrachtVerlopen(order);
  const inhoud: OpdrachtInhoud | null =
    leesInhoud(order.acceptedSnapshot) ?? (order.status !== "CONCEPT" ? leesInhoud((await huidigeVersie(order))?.inhoud) : null);
  const klantLink = commerce.portalToken ? opdrachtUrl(commerce.portalToken, order.id) : null;
  const vandaag = kalenderdag(new Date());
  const intrekbaar =
    ["CONCEPT", "VERZONDEN", "AKKOORD"].includes(order.status) &&
    !betalingen.some((p) => ["CREATED", "OPEN", "PENDING", "PAID"].includes(p.status));

  return (
    <main className="mx-auto w-full max-w-3xl pb-20">
      <Link
        href={`/admin/leads/${id}#opdrachten`}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" /> {lead.bedrijfsnaam}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-300">Aanvullende opdracht {order.volgnummer}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{order.titel.trim() || "Nieuwe opdracht"}</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {lead.naam} · {lead.email}
            {order.version > 0 && ` · versie ${order.version}`}
          </p>
        </div>
        <StatusPil status={order.status} verlopen={verlopen} />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <OpdrachtVoortgang status={order.status} />
        <p className="mt-4 text-[13.5px] font-semibold text-ink-700">{volgendeStap(order.status, verlopen)}</p>
        <p className="mt-1 text-[12px] text-ink-300">
          De website van {lead.bedrijfsnaam} blijft gewoon live en actief; deze opdracht verandert de klantstatus niet.
        </p>
        {order.status !== "CONCEPT" && (
          <div className="mt-4 border-t border-cream-100 pt-4">
            <OpdrachtActies
              leadId={id}
              orderId={order.id}
              status={order.status}
              verlopen={verlopen}
              geldigTotDag={order.geldigTot ? kalenderdag(order.geldigTot) : null}
              vandaag={vandaag}
              intrekbaar={intrekbaar}
            />
          </div>
        )}
        {klantLink && order.status !== "INGETROKKEN" && (
          <a
            href={klantLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-600"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Bekijk zoals de klant het ziet
          </a>
        )}
      </div>

      {!isMollieConfigured() && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-2.5 text-[12.5px] font-semibold text-brand-600 ring-1 ring-brand/10">
          Mollie is nog niet geconfigureerd — de klant kan pas betalen na het instellen van MOLLIE_API_KEY.
        </p>
      )}

      {order.status === "CONCEPT" ? (
        <div className="mt-6">
          {order.version > 0 && (
            <p className="mb-4 rounded-xl bg-cream-100 px-4 py-2.5 text-[12.5px] text-ink-500 ring-1 ring-ink/5">
              Versie {order.version} is vervangen. De klant ziet dat de opdracht wordt aangepast; versturen maakt versie{" "}
              {order.version + 1}.
            </p>
          )}
          <OpdrachtEditor
            leadId={id}
            orderId={order.id}
            vatPercent={order.vatPercent}
            huidigMaandCents={commerce.monthlyCents}
            proefNaar={proefOntvanger()}
            ontbreekt={ontbreektVoorVersturen(order)}
            begin={{
              titel: order.titel,
              omschrijving: order.omschrijving ?? "",
              werkzaamheden: order.werkzaamheden.join("\n"),
              prijs: centenNaarInvoer(order.priceExVatCents),
              maandDelta: centenNaarInvoer(order.monthlyDeltaCents),
              maandIngang: order.maandIngang,
              maandIngangDatum: order.maandIngangDatum ?? "",
              verwachteOplevering: order.verwachteOplevering ?? "",
              geldigTot: order.geldigTot ? kalenderdag(order.geldigTot) : "",
            }}
          />
        </div>
      ) : (
        inhoud && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
            <h2 className="text-[15px] font-extrabold text-ink">
              {order.acceptedAt ? `Geaccepteerde versie ${order.acceptedVersion}` : `Verstuurde versie ${order.version}`}
            </h2>
            {inhoud.omschrijving && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-700">{inhoud.omschrijving}</p>}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px] text-ink-700">
              {inhoud.werkzaamheden.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-1.5 border-t border-cream-100 pt-4 text-[13.5px]">
              <Rij label="Prijs excl. btw" value={euroFromCents(inhoud.bedragen.exVatCents)} />
              <Rij label={`Btw ${inhoud.bedragen.vatPercent}%`} value={euroFromCents(inhoud.bedragen.vatCents)} />
              <Rij label="Totaal incl. btw" value={euroFromCents(inhoud.bedragen.inclVatCents)} sterk />
              <Rij label={`Aanbetaling (${inhoud.bedragen.aanbetaling.percent}%)`} value={euroFromCents(inhoud.bedragen.aanbetaling.inclVatCents)} />
              <Rij label={`Eindbetaling (${inhoud.bedragen.eindbetaling.percent}%)`} value={euroFromCents(inhoud.bedragen.eindbetaling.inclVatCents)} />
              {inhoud.verwachteOplevering && (
                <Rij label="Verwachte oplevering" value={geldigheidLabel(eindeVanDag(inhoud.verwachteOplevering)!)} />
              )}
              {order.geldigTot && !order.acceptedAt && <Rij label="Geldig tot en met" value={geldigheidLabel(order.geldigTot)} />}
            </dl>
            {inhoud.maand && (
              <p className="mt-4 rounded-xl bg-cream-100/60 px-4 py-3 text-[13px] text-ink-700">
                {maandZin(inhoud)}{" "}
                {order.maandToegepastAt ? (
                  <span className="font-semibold text-sage-600">
                    Toegepast op {tijdstip(order.maandToegepastAt)}: {euroFromCents(order.maandVanCents ?? 0)} →{" "}
                    {euroFromCents(order.maandNaarCents ?? 0)} excl. btw.
                  </span>
                ) : (
                  <span className="text-ink-500">Nog niet toegepast op het abonnement.</span>
                )}
              </p>
            )}
            {order.acceptedAt && (
              <div className="mt-4 rounded-xl bg-sage/10 px-4 py-3 text-[12.5px] leading-relaxed text-ink-700">
                <p className="font-bold text-ink">Akkoord vastgelegd</p>
                <p>
                  {order.acceptedName} · {tijdstip(order.acceptedAt)} · versie {order.acceptedVersion}
                </p>
                <p>
                  Opdracht en prijs: {order.agreesOpdracht ? "akkoord" : "—"}
                  {inhoud.maand && ` · nieuw maandbedrag en ingangsdatum: ${order.agreesMaandbedrag ? "akkoord" : "—"}`}
                </p>
                <p className="font-mono text-[11px] text-ink-300">ip-hash {order.acceptedIpHash}</p>
              </div>
            )}
          </section>
        )
      )}

      {/* Betalingen en documenten */}
      {(betalingen.length > 0 || documenten.length > 0) && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
          <h2 className="text-[15px] font-extrabold text-ink">Betalingen en documenten</h2>
          {betalingen.length > 0 && (
            <ul className="mt-3 divide-y divide-cream-100">
              {betalingen.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[13px]">
                  <span className="font-semibold text-ink">{p.type === "EXTRA_DEPOSIT" ? "Aanbetaling" : "Eindbetaling"}</span>
                  <span className="text-ink-500">
                    {BETAAL_STATUS[p.status] ?? p.status} · {tijdstip(p.paidAt ?? p.createdAt)}
                  </span>
                  <span className="font-bold tabular-nums text-ink">{euroFromCents(p.amountCents)}</span>
                  {p.failureReason && <span className="w-full text-[12px] text-brand-600">{p.failureReason}</span>}
                </li>
              ))}
            </ul>
          )}
          {documenten.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {documenten.map((d) => {
                const inhoudRegel = (
                  <>
                    <FileText className="h-4 w-4 shrink-0 text-ink-300" />
                    <span className="min-w-0 flex-1 truncate">{d.titel}</span>
                    <span className="font-mono text-[11px] text-ink-300">{d.nummer}</span>
                  </>
                );
                return (
                  <li key={d.id}>
                    {isInvoiceType(d.type) ? (
                      <Link href={`/admin/facturen/${d.nummer}`} className="flex items-center gap-2 text-[13px] font-semibold text-brand hover:text-brand-600">
                        {inhoudRegel}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 text-[13px] text-ink-700">{inhoudRegel}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {versies.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
          <h2 className="text-[15px] font-extrabold text-ink">Versies</h2>
          <ul className="mt-3 space-y-1 text-[13px] text-ink-700">
            {versies.map((v) => {
              const vi = leesInhoud(v.inhoud);
              return (
                <li key={v.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    Versie {v.version} · verstuurd {tijdstip(v.sentAt)}
                  </span>
                  <span className="text-ink-500">
                    {vi ? `${euroFromCents(vi.bedragen.exVatCents)} excl. btw · ` : ""}
                    {v.status.toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <h2 className="text-[15px] font-extrabold text-ink">Interne notitie</h2>
        <p className="mb-2 mt-0.5 text-[12.5px] text-ink-300">Alleen voor beheerders.</p>
        <InterneNotitie leadId={id} orderId={order.id} begin={order.interneNotitie ?? ""} />
      </section>

      {eigenEvents.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-300">Tijdlijn van deze opdracht</h2>
          <ol className="space-y-2 border-l-2 border-cream-200 pl-5">
            {eigenEvents
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <p className="text-[13px] text-ink-700">
                    {e.label}
                    {e.internal && <span className="ml-1.5 rounded bg-cream-200 px-1.5 text-[10.5px] font-bold text-ink-500">intern</span>}
                  </p>
                  <p className="text-[11.5px] text-ink-300">
                    {tijdstip(e.createdAt)} · {e.actor}
                  </p>
                </li>
              ))}
          </ol>
        </section>
      )}
    </main>
  );
}

function Rij({ label, value, sterk }: { label: string; value: string; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={sterk ? "font-bold text-ink" : "text-ink-500"}>{label}</dt>
      <dd className={sterk ? "font-extrabold tabular-nums text-ink" : "tabular-nums text-ink-700"}>{value}</dd>
    </div>
  );
}
