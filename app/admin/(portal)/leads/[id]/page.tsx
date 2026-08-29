import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { STAGE_META } from "@/lib/journey-stages";
import { getTimeline } from "@/lib/journey";
import { leidAf } from "@/lib/aanvragen";
import { nextAction, type JourneySnapshot } from "@/lib/journey-next";
import {
  ensureCommerce,
  freezePricing,
  getActiveProposal,
  getDraftProposal,
  listProposals,
  pricingLabels,
  readPricing,
} from "@/lib/proposals";
import { getCurrentAgreement, isSigned } from "@/lib/agreements";
import { paidTotal } from "@/lib/commerce";
import { listDocuments } from "@/lib/documents";
import { computeOutstanding, euroFromCents } from "@/lib/money";
import { isMollieConfigured } from "@/lib/mollie";
import { portalUrl } from "@/lib/portal-access";
import { entityReady } from "@/lib/legal-entity";
import { findPartnerByUserId, findUserByEmail } from "@/lib/partner-activation";
import { JourneyBar } from "@/components/commerce/journey-bar";
import { NextActionPanel } from "@/components/commerce/next-action";
import { OpvolgenPanel } from "@/components/commerce/opvolgen-panel";
import { CommerceSecties } from "@/components/commerce/admin-panel";
import { LeadAdminForm } from "./lead-admin-form";
import { ReassignForm } from "./reassign-form";
import { StageControl, DemoPanel } from "./journey-controls";
import { PartnerActivatePanel } from "./partner-activate";
import { BouwpromptKnop } from "./bouwprompt-knop";

export const metadata: Metadata = {
  title: "Aanvraag",
  robots: { index: false, follow: false },
};

const WEBSITE_LABELS: Record<string, string> = {
  nee: "Nee",
  ja: "Ja",
  "ja-nieuw": "Ja, maar wil iets nieuws",
};

function Regel({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <p className="text-[14px] leading-relaxed text-ink-700">
      <span className="font-semibold text-ink">{label}:</span> {value}
    </p>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[13px] text-ink-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="rounded-full bg-cream-100 px-2.5 py-0.5 text-[12px] font-semibold text-ink-700">
          {i}
        </span>
      ))}
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  if (!db) notFound();

  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id)).limit(1);
  if (!lead) notFound();

  // De commerce-rij is de kapstok van de hele commerciële journey. Hem hier
  // aanmaken kost niets en zorgt dat er altijd een klantomgeving bestaat.
  const commerce = await ensureCommerce(id);
  if (!commerce) notFound();

  const [
    attributedPartner,
    allePartners,
    events,
    tasks,
    mails,
    proposals,
    draft,
    actiefVoorstel,
    agreement,
    documents,
    betaald,
    payments,
  ] = await Promise.all([
    lead.affiliatePartnerId
      ? db
          .select()
          .from(schema.partners)
          .where(eq(schema.partners.id, lead.affiliatePartnerId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select({
        id: schema.partners.id,
        bedrijfsnaam: schema.partners.bedrijfsnaam,
        referralCode: schema.partners.referralCode,
      })
      .from(schema.partners),
    getTimeline(id, "admin"),
    db
      .select()
      .from(schema.journeyTasks)
      .where(eq(schema.journeyTasks.leadId, id))
      .orderBy(asc(schema.journeyTasks.createdAt)),
    db
      .select()
      .from(schema.emails)
      .where(eq(schema.emails.leadId, id))
      .orderBy(desc(schema.emails.createdAt))
      .limit(50),
    listProposals(commerce.id),
    getDraftProposal(commerce.id),
    getActiveProposal(commerce.id),
    getCurrentAgreement(commerce.id),
    listDocuments(commerce.id, "admin"),
    paidTotal(commerce.id),
    db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.commerceId, commerce.id))
      .orderBy(desc(schema.payments.createdAt)),
  ]);

  const snapshotPricing = actiefVoorstel
    ? readPricing(actiefVoorstel, commerce)
    : freezePricing(commerce);
  const L = pricingLabels(snapshotPricing);
  const openstaand = computeOutstanding(snapshotPricing.config, betaald);

  const getekend = isSigned(agreement);
  const aanbetalingBetaald = payments.some((p) => p.type === "DEPOSIT" && p.status === "PAID");
  const restbetalingBetaald = payments.some(
    (p) => p.type === "FINAL_PAYMENT" && p.status === "PAID",
  );

  const demoVerstuurd = Boolean(lead.demoSentAt);
  const demoLinksKlaar = Boolean(lead.demoDomain?.trim() && lead.demoPortalUrl?.trim());

  const snapshot: JourneySnapshot = {
    stage: lead.stage,
    commerceStatus: commerce.status,
    demoVerstuurd,
    demoLinksKlaar,
    heeftConcept: Boolean(draft),
    voorstelVerstuurd: proposals.some((p) => p.sentAt),
    voorstelBekeken: proposals.some((p) => p.firstViewedAt),
    voorstelGeaccepteerd: proposals.some((p) => p.acceptedAt),
    overeenkomstGetekend: getekend,
    aanbetalingBetaald,
    opleveringKlaar: Boolean(commerce.deliveryReadyAt),
    restbetalingBetaald,
    mandaatActief: Boolean(commerce.mandateActivatedAt),
    live: Boolean(commerce.liveAt),
    heeftAbonnement: commerce.monthlyCents > 0,
  };
  const volgende = nextAction(snapshot, id);

  /**
   * Of deze aanvraag stilligt. Het laatste klantcontact komt uit de tijdlijn
   * die hierboven toch al is geladen — geen extra query. Alleen gebeurtenissen
   * van de klant tellen: de demomail zelf logt als systeem, en een
   * statuscorrectie door de beheerder is geen reactie.
   */
  const laatsteContactAt =
    [...events]
      .reverse()
      .find((e) => e.actor === "klant" || e.kind === "internal_note")?.createdAt ?? null;
  const afleiding = leidAf(
    { id, stage: lead.stage, status: lead.status, demoSentAt: lead.demoSentAt, laatsteContactAt, snapshot },
    new Date(),
  );

  const persoon = await findUserByEmail(lead.email);
  const eigenPartner = persoon ? await findPartnerByUserId(persoon.id) : null;
  const klantLink = commerce.portalToken ? portalUrl(commerce.portalToken) : null;
  const entiteit = entityReady();

  return (
    <main className="mx-auto w-full max-w-3xl pb-20">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-300 transition hover:text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" /> Alle aanvragen
      </Link>

      {/* Kop: wie, en waar staan we */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{lead.bedrijfsnaam}</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {lead.naam} ·{" "}
            {lead.createdAt.toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span className="rounded-full bg-[#2f6bed]/10 px-3 py-1 text-[12px] font-bold text-[#2f6bed]">
          {STAGE_META[lead.stage].label}
        </span>
      </div>

      {/* De journey in één oogopslag */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <JourneyBar current={lead.stage} />
      </div>

      {/* Ligt deze aanvraag stil? Dan gaat dat vóór de gewone volgende stap. */}
      {afleiding.bakje === "opvolgen" && (
        <div className="mt-4">
          <OpvolgenPanel
            leadId={id}
            reden={afleiding.reden}
            telefoon={lead.telefoon}
            email={lead.email}
            naam={lead.naam}
          />
        </div>
      )}

      {/* Wat moet ik nu doen? */}
      <div className="mt-4">
        <NextActionPanel leadId={id} next={volgende} />
      </div>

      {/* De demo: demolink + inloglink. Staat bewust hoog — dit is de eerste
          stap van elke aanvraag en blijft daarna bereikbaar om de mail te
          bekijken, te testen en opnieuw te versturen. */}
      <section id="voorbeeld" className="mt-4 scroll-mt-6">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-300">
              Demo versturen
            </h2>
            <p
              className={`text-[12px] font-semibold ${
                lead.demoSentAt
                  ? "text-ink-300"
                  : demoLinksKlaar
                    ? "text-sage-600"
                    : "text-ink-300"
              }`}
            >
              {lead.demoSentAt
                ? `Verstuurd op ${lead.demoSentAt.toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })} aan ${lead.demoLoginEmail ?? lead.email}`
                : demoLinksKlaar
                  ? "Demo klaar om te versturen"
                  : "Nog niet verstuurd"}
            </p>
          </div>
          <DemoPanel
            leadId={lead.id}
            website={lead.demoDomain ?? ""}
            portaal={lead.demoPortalUrl ?? ""}
            loginEmail={lead.demoLoginEmail ?? ""}
            klantEmail={lead.email}
            alSent={demoVerstuurd}
          />

          {/* De opdracht voor het klantproject. Levert alleen tekst op — het
              bouwen zelf gebeurt in dat aparte project, niet hier. */}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-cream-100 pt-4">
            <BouwpromptKnop leadId={lead.id} bedrijfsnaam={lead.bedrijfsnaam} />
            <p className="text-[12px] text-ink-300">
              De opdracht voor Claude in het nieuwe klantproject, gevuld met deze aanvraag.
            </p>
          </div>
        </div>
      </section>

      {!isMollieConfigured() && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-2.5 text-[12.5px] font-semibold text-brand-600 ring-1 ring-brand/10">
          Mollie is nog niet geconfigureerd — betalen werkt pas na het instellen van MOLLIE_API_KEY.
        </p>
      )}
      {!entiteit.ok && (
        <p className="mt-3 rounded-xl bg-cream-100 px-4 py-2.5 text-[12.5px] text-ink-500 ring-1 ring-ink/5">
          <span className="font-bold text-ink">Let op:</span> {entiteit.missing.join(" en ")} van de
          facturerende partij {entiteit.missing.length === 1 ? "ontbreekt" : "ontbreken"} nog in{" "}
          <code className="font-mono text-[11.5px]">lib/legal-entity.ts</code>. Facturen worden wel
          vastgelegd, maar zijn pas compleet zodra dit is ingevuld.
        </p>
      )}

      {/* De commerciële klantkaart — ingeklapte secties, rustig */}
      <div className="mt-8">
        <CommerceSecties
          leadId={id}
          klantLink={klantLink}
          financieel={{
            subtotal: L.subtotal,
            discount: L.discount,
            net: L.netExVat,
            vat: L.vat,
            vatPercent: L.vatPercent,
            total: L.total,
            deposit: L.deposit,
            depositPercent: L.depositPercent,
            final: L.final,
            finalPercent: L.finalPercent,
            monthlyExVat: L.monthlyExVat,
            monthlyInclVat: L.monthlyInclVat,
            freeMonths: L.freeMonths,
            startLabel: L.startLabel,
            paid: euroFromCents(betaald),
            outstanding: euroFromCents(openstaand),
          }}
          voorstellen={proposals.map((p) => ({
            id: p.id,
            version: p.version,
            status: p.status,
            titel: p.titel,
            sentAt: p.sentAt?.toISOString() ?? null,
            firstViewedAt: p.firstViewedAt?.toISOString() ?? null,
            viewCount: p.viewCount,
            acceptedAt: p.acceptedAt?.toISOString() ?? null,
            acceptedName: p.acceptedName,
            geldigTot: p.geldigTot?.toISOString() ?? null,
          }))}
          overeenkomst={
            agreement
              ? {
                  status: agreement.status,
                  voorwaardenVersie: agreement.voorwaardenVersie,
                  proposalVersion: agreement.proposalVersion,
                  signedAt: agreement.signedAt?.toISOString() ?? null,
                  signerName: agreement.signerName,
                  signerRole: agreement.signerRole,
                  signerKvk: agreement.signerKvk,
                  signedIpHash: agreement.signedIpHash,
                }
              : null
          }
          betalingen={payments.map((p) => ({
            id: p.id,
            factuurNummer: documents.find((d) => d.paymentId === p.id)?.nummer ?? null,
            type: p.type,
            status: p.status,
            bedrag: euroFromCents(p.amountCents),
            referentie: p.referentie,
            molliePaymentId: p.molliePaymentId,
            sequenceType: p.sequenceType,
            paidAt: p.paidAt?.toISOString() ?? null,
            createdAt: p.createdAt.toISOString(),
            failureReason: p.failureReason,
          }))}
          abonnement={{
            maandbedrag: L.monthlyExVat,
            mandaatActief: Boolean(commerce.mandateActivatedAt),
            mandaatId: commerce.mollieMandateId,
            subscriptionId: commerce.mollieSubscriptionId,
            startAt: commerce.subscriptionStartAt?.toISOString() ?? null,
            startLabel: L.startLabel,
            heeftAbonnement: commerce.monthlyCents > 0,
          }}
          documenten={documents.map((d) => ({
            id: d.id,
            nummer: d.nummer,
            type: d.type,
            titel: d.titel,
            bedrag: d.totalInclVatCents > 0 ? euroFromCents(d.totalInclVatCents) : null,
            issuedAt: d.issuedAt.toISOString(),
          }))}
          taken={tasks.map((t) => ({
            id: t.id,
            label: t.label,
            done: t.done,
            dueAt: t.dueAt?.toISOString() ?? null,
            // Te laat telt alleen als hij ook nog openstaat; een afgevinkte
            // taak die ooit over datum was hoeft niet rood te blijven.
            teLaat: Boolean(t.dueAt && !t.done && t.dueAt < new Date()),
          }))}
          mails={mails.map((m) => ({
            id: m.id,
            soort: m.soort,
            onderwerp: m.onderwerp,
            ontvanger: m.ontvanger,
            gelukt: m.status === "SENT",
            fout: m.fout,
            verstuurdOp: m.createdAt.toISOString(),
          }))}
          tijdlijn={events
            .slice()
            .reverse()
            .map((e) => ({
              id: e.id,
              label: e.label,
              actor: e.actor,
              internal: e.internal,
              kind: e.kind,
              createdAt: e.createdAt.toISOString(),
            }))}
          bouw={{
            gestartOp: commerce.buildStartedAt?.toISOString() ?? null,
            opleveringOp: commerce.deliveryReadyAt?.toISOString() ?? null,
            liveOp: commerce.liveAt?.toISOString() ?? null,
          }}
        />
      </div>

      {/* Klantgegevens en oorspronkelijke aanvraag */}
      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-300">
          Klant en aanvraag
        </h2>
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <div className="space-y-1">
            <Regel label="Naam" value={lead.naam} />
            <Regel label="Bedrijf" value={lead.bedrijfsnaam} />
            <Regel label="Telefoon" value={lead.telefoon} />
            <Regel label="E-mail" value={lead.email} />
            <Regel label="Plaats" value={lead.plaats} />
            <Regel label="Website" value={lead.website} />
          </div>

          {attributedPartner && (
            <p className="mt-2 text-[13px] text-ink-500">
              Aangebracht via{" "}
              <Link
                href={`/admin/partners/${attributedPartner.id}`}
                className="font-bold text-brand hover:underline"
              >
                {attributedPartner.bedrijfsnaam}
              </Link>{" "}
              <span className="font-mono text-[12px]">({lead.referralCodeSnapshot})</span>
            </p>
          )}

          <details className="mt-3 rounded-xl bg-cream-100/60 px-4 py-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink-500">
              Volledige aanvraag bekijken
            </summary>
            <div className="mt-3 space-y-3 border-t border-cream-200 pt-3">
              <div>
                <p className="text-[12px] font-bold text-ink">Diensten</p>
                <Chips items={lead.diensten} />
                {lead.dienstenAnders && (
                  <p className="mt-1 text-[13px] text-ink-700">Anders: {lead.dienstenAnders}</p>
                )}
              </div>
              <Regel
                label="Heeft website"
                value={lead.heeftWebsite ? WEBSITE_LABELS[lead.heeftWebsite] : undefined}
              />
              <Regel label="Goed aan huidige site" value={lead.websiteGoed} />
              <Regel label="Mist" value={lead.websiteMist} />
              <div>
                <p className="text-[12px] font-bold text-ink">Huidige software</p>
                <Chips items={lead.software} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink">Grootste tijdvreters</p>
                <Chips items={lead.tijdvreters} />
              </div>
              <Regel label="Droomwebsite" value={lead.droomscenario} />
              <Regel label="Inspiratie" value={lead.inspiratie} />
              <Regel
                label="Logo"
                value={lead.heeftLogo === "ja" ? "Ja" : lead.heeftLogo === "nee" ? "Nee" : undefined}
              />
              <Regel label="Huisstijl" value={lead.huisstijl} />
              <div>
                <p className="text-[12px] font-bold text-ink">Gewenste functies</p>
                <Chips items={lead.functies} />
              </div>
              <Regel label="Opmerkingen" value={lead.opmerkingen} />
              {lead.uploads.length > 0 && (
                <ul className="space-y-1">
                  {lead.uploads.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {decodeURIComponent(url.split("/").pop() ?? url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-cream-200 pt-2">
                <ReassignForm
                  leadId={lead.id}
                  currentPartnerId={lead.affiliatePartnerId}
                  partners={allePartners.map((p) => ({
                    id: p.id,
                    label: `${p.bedrijfsnaam} (${p.referralCode})`,
                  }))}
                />
              </div>
            </div>
          </details>

          <div className="mt-3 rounded-xl bg-cream-100/60 p-4">
            <LeadAdminForm leadId={lead.id} status={lead.status} notities={lead.notities ?? ""} />
          </div>

          <div className="mt-3">
            <PartnerActivatePanel
              leadId={lead.id}
              naam={lead.naam}
              email={lead.email}
              telefoon={lead.telefoon}
              bedrijfsnaam={lead.bedrijfsnaam}
              bestaandePartnerId={eigenPartner?.id ?? null}
            />
          </div>
        </div>
      </section>

      {/* Handmatige correctie — helemaal onderaan, want zelden nodig */}
      <section className="mt-8">
        <details className="rounded-2xl bg-white px-5 py-4 shadow-soft ring-1 ring-ink/5">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink-500">
            Journey handmatig corrigeren
          </summary>
          <div className="mt-4 border-t border-cream-100 pt-4">
            <p className="mb-2 text-[12px] text-ink-300">
              Alleen gebruiken om een foutje te herstellen. De journey loopt normaal automatisch mee
              met wat er werkelijk gebeurt.
            </p>
            <StageControl leadId={lead.id} current={lead.stage} />
          </div>
        </details>
      </section>
    </main>
  );
}
