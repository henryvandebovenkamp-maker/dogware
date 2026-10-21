import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, countDistinct, desc, eq, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { referralLinkFor } from "@/lib/referral";
import { euro, getPartnerCommission } from "@/lib/partner-data";
import { decryptField, maskIban } from "@/lib/crypto-field";
import { getAdminActor } from "@/lib/admin-auth";
import { hasFinanceGrant } from "@/lib/finance-auth";
import { openEmailWijziging } from "@/lib/email-wijziging";
import { commissieOverzichtAdmin, type CommissieRegel } from "@/lib/partner-commissies";
import { COMMISSIE_STATUS_LABEL } from "@/lib/commissie";
import { euroFromCents } from "@/lib/money";
import { LeadStatusBadge } from "../../leads/status-badge";
import { PartnerAdminActions } from "./partner-actions";
import { PartnerCommissies, type CommissieKaart } from "./commissies";
import { PartnerEmailWijzigen } from "./email-wijzigen";

export const metadata = { title: "Partner" };

function PayRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="shrink-0 text-[13px] text-ink-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-[13px] font-bold text-ink ${mono ? "font-mono" : ""}`}>
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  if (!db) notFound();

  const rows = await db
    .select({ partner: schema.partners, user: schema.users })
    .from(schema.partners)
    .innerJoin(schema.users, eq(schema.partners.userId, schema.users.id))
    .where(eq(schema.partners.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const { partner, user } = row;

  const actor = await getAdminActor();
  const financieelBevoegd = actor ? await hasFinanceGrant(actor.id) : false;

  const [[clickStats], leads, activity, commissie, commissieRegels, emailWijziging] = await Promise.all([
    db
      .select({
        clicks: count(),
        uniek: countDistinct(schema.referralClicks.visitorId),
      })
      .from(schema.referralClicks)
      .where(
        and(
          eq(schema.referralClicks.partnerId, id),
          eq(schema.referralClicks.isBot, false),
          eq(schema.referralClicks.isInternal, false),
        ),
      ),
    db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.affiliatePartnerId, id))
      .orderBy(desc(schema.leads.createdAt))
      .limit(20),
    db
      .select()
      .from(schema.activityLog)
      .where(
        or(
          and(
            eq(schema.activityLog.objectType, "partner"),
            eq(schema.activityLog.objectId, id),
          ),
          // Een e-mailwijziging hoort bij het account; ook hier zichtbaar.
          and(
            eq(schema.activityLog.objectType, "user"),
            eq(schema.activityLog.objectId, user.id),
          ),
        ),
      )
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(20),
    /*
     * Dezelfde berekening als in het partnerportaal (lib/partner-data.ts), dus
     * de partner ziet nooit een ander getal dan de beheerder. Hij telt op de
     * vastgelegde koppeling bij de aanvraag — nooit op bezoeken of cookies.
     */
    getPartnerCommission(id, partner.commissionCents),
    commissieOverzichtAdmin(id, { financieelBevoegd }),
    openEmailWijziging(user.id),
  ]);

  const partnerIban = partner.ibanEnc ? decryptField(partner.ibanEnc) : "";
  const bankBekend =
    partner.rekeninghouder && partnerIban
      ? { naam: partner.rekeninghouder, ibanGemaskeerd: maskIban(partnerIban) }
      : null;
  const kaarten = commissieRegels.map((r) => commissieKaart(r, partner.commissionCents));

  const referralLink = referralLinkFor(partner.referralCode);
  const conversie =
    clickStats.uniek > 0 ? Math.round((leads.length / Number(clickStats.uniek)) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/partners" className="text-[13px] font-semibold text-ink-300 hover:text-ink-500">
        ← Alle partners
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {partner.bedrijfsnaam ?? user.naam}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {user.naam} · {user.email}
            {partner.telefoon && ` · ${partner.telefoon}`}
          </p>
          <p className="mt-1 text-[12px] text-ink-300">
            Toegevoegd op {partner.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
            {user.lastLoginAt &&
              ` · laatste login ${user.lastLoginAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`}
            {user.status === "INVITED" && " · uitnodiging nog niet geaccepteerd"}
          </p>
        </div>
        <span className="rounded-full bg-cream-100 px-3 py-1 text-[11px] font-bold text-ink-700">
          {partner.status}
        </span>
      </div>

      {/* Statistieken */}
      <div className="mt-6 grid gap-3.5 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Clicks", value: clickStats.clicks },
          { label: "Unieke bezoekers", value: clickStats.uniek },
          { label: "Demo-aanvragen", value: leads.length },
          { label: "Conversie", value: `${conversie}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/*
        Commissie in de drie fases die DogWare kent. Bewust naast de
        bezoekcijfers en niet ertussen: bezoeken zeggen iets over bereik,
        deze regel gaat over geld.
      */}
      <div className="mt-3.5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[
          { label: "In behandeling", value: String(commissie.inBehandeling) },
          { label: "Gereserveerd", value: String(commissie.gereserveerd) },
          { label: "Klant geworden", value: String(commissie.verkocht) },
          { label: "Commissie verdiend", value: euro(commissie.verdiendCents) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-300">
        Verdiend vanaf de bouwfase, gereserveerd vanaf akkoord. Uitbetaalbaar
        zodra de klant de eenmalige investering volledig heeft betaald
        (gecontroleerd bij Mollie). De uitbetaling zelf loop je hieronder af.
      </p>

      {/* Commissies & uitbetalingen */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-extrabold text-ink">Commissies &amp; uitbetalingen</h2>
          <span className="text-[11px] text-ink-300">
            {financieelBevoegd
              ? "Je bent financieel bevoegd: je kunt goedkeuren en uitbetalen."
              : "Goedkeuren en uitbetalen: alleen een financieel bevoegde beheerder."}
          </span>
        </div>
        <PartnerCommissies kaarten={kaarten} financieelBevoegd={financieelBevoegd} bankBekend={bankBekend} />
        <p className="mt-3 text-[11px] text-ink-300">
          Mollie wordt alleen gebruikt om de betalingen van de klant te
          verifiëren. De commissie zelf gaat per bankoverschrijving; DogWare legt
          vast wie voorbereidde, wie goedkeurde en wanneer er met welk kenmerk is
          overgemaakt.
        </p>
      </div>

      {/* Referral-link */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
          Persoonlijke link
        </p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-brand">
          {referralLink}
        </p>
      </div>

      {/* Beloning & klantvoordelen */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Beloning
          </p>
          <p className="mt-1 text-lg font-extrabold text-ink">
            {euro(partner.commissionCents)}{" "}
            <span className="text-[13px] font-semibold text-ink-500">per verkochte website</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            Voordeel voor de nieuwe klant
          </p>
          {partner.newCustomerPerks.length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-300">Geen voordelen ingesteld.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {partner.newCustomerPerks.map((perk) => (
                <li key={perk} className="text-[13px] font-semibold text-ink-700">
                  ✓ {perk}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Uitbetaalgegevens — ingevuld door de partner zelf */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Uitbetaalgegevens</h2>
        {!partner.ibanEnc && !partner.rekeninghouder ? (
          <p className="text-[13px] text-ink-300">
            De partner heeft de uitbetaalgegevens nog niet ingevuld.
          </p>
        ) : (
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <PayRow label="Rekeninghouder" value={partner.rekeninghouder} />
            {/* Volledig IBAN alleen voor wie ook mag uitbetalen; anders gemaskeerd. */}
            <PayRow
              label="IBAN"
              value={partnerIban ? (financieelBevoegd ? partnerIban : maskIban(partnerIban)) : null}
              mono
            />
            <PayRow label="BIC" value={partner.bicEnc ? decryptField(partner.bicEnc) : null} mono />
            <PayRow label="Land" value={partner.land} />
            <PayRow
              label="Facturatie"
              value={partner.factuurType === "zakelijk" ? "Zakelijk" : partner.factuurType === "particulier" ? "Particulier" : null}
            />
            {partner.factuurType === "zakelijk" && (
              <>
                <PayRow label="KvK-nummer" value={partner.kvkNummer} />
                <PayRow label="BTW-nummer" value={partner.btwNummer} />
              </>
            )}
          </dl>
        )}
        {(partner.telefoon || partner.website) && (
          <div className="mt-3 border-t border-cream-100 pt-3">
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <PayRow label="Telefoon" value={partner.telefoon} />
              <PayRow label="Website" value={partner.website} />
            </dl>
          </div>
        )}
      </div>

      {/* Beheeracties */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Beheer</h2>
        <PartnerAdminActions
          partnerId={partner.id}
          currentStatus={partner.status}
          currentCode={partner.referralCode}
          accountActief={user.status === "ACTIVE"}
        />
        <div className="mt-5 lg:w-1/3">
          <PartnerEmailWijzigen
            partnerId={partner.id}
            huidig={user.email}
            openstaand={
              emailWijziging
                ? {
                    nieuw: emailWijziging.newEmail,
                    verloopt: emailWijziging.expiresAt.toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "long",
                    }),
                  }
                : null
            }
          />
        </div>
      </div>

      {/* Gekoppelde aanvragen */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="mb-3 text-sm font-extrabold text-ink">
          Gekoppelde aanvragen ({leads.length})
        </h2>
        {leads.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-300">
            Nog geen aanvragen via deze partner
          </p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {leads.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/admin/leads/${l.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-ink">
                      {l.bedrijfsnaam}
                    </span>
                    <span className="block text-[11px] text-ink-300">
                      {l.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                      {l.attributionModel === "MANUAL" && " · handmatig toegewezen"}
                    </span>
                  </span>
                  <LeadStatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Interne notitie + activiteit */}
      {partner.notitie && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <h2 className="mb-2 text-sm font-extrabold text-ink">Interne notitie</h2>
          <p className="whitespace-pre-line text-[13px] text-ink-500">{partner.notitie}</p>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Activiteit</h2>
        {activity.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-ink-300">Nog geen activiteit</p>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-[13px]">
                <span className="w-28 shrink-0 text-[11px] text-ink-300">
                  {a.createdAt.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="rounded-md bg-cream-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-700">
                  {a.action}
                </span>
                {a.reason && <span className="text-ink-300">— {a.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- Commissiekaart: serverdata → wat de kaart toont ---------- */

function datum(d: Date | null | undefined): string {
  return d
    ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" })
    : "—";
}

function commissieKaart(r: CommissieRegel, partnerCommissionCents: number): CommissieKaart {
  const c = r.commissie;
  const bedragCents = c?.amountCents ?? partnerCommissionCents;
  const naam = (id: string | null | undefined) => (id ? (r.namen[id] ?? "onbekend") : "—");

  const s = r.stand;
  const betaling = !s
    ? { tekst: "Nog geen commerciële afspraak", volledig: false }
    : !s.getekend
      ? { tekst: "Overeenkomst nog niet getekend", volledig: false }
      : s.volledigBetaald
        ? {
            tekst: `Volledig betaald — ${euroFromCents(s.betaaldCents)} van ${euroFromCents(s.totaalCents)}`,
            volledig: true,
          }
        : {
            tekst: `${euroFromCents(s.betaaldCents)} van ${euroFromCents(s.totaalCents)} betaald — ${euroFromCents(s.openstaandCents)} open${s.lopend ? ` (${s.lopend} lopend)` : ""}`,
            volledig: false,
          };

  const feiten: { label: string; waarde: string }[] = [];
  if (!c) feiten.push({ label: "Registratie", waarde: "Nog niet geregistreerd" });
  if (c?.payableAt) feiten.push({ label: "Uitbetaalbaar sinds", waarde: datum(c.payableAt) });
  if (c?.preparedAt) feiten.push({ label: "Voorbereid", waarde: `${datum(c.preparedAt)} · ${naam(c.preparedByUserId)}` });
  if (c?.approvedAt) feiten.push({ label: "Goedgekeurd", waarde: `${datum(c.approvedAt)} · ${naam(c.approvedByUserId)}` });
  if (c?.status === "UITBETAALD") {
    feiten.push({ label: "Uitbetaald op", waarde: datum(c.paidAt) });
    feiten.push({ label: "Bedrag", waarde: euroFromCents(c.paidAmountCents ?? c.amountCents) });
    feiten.push({ label: "Kenmerk", waarde: c.paymentReference ?? "—" });
    feiten.push({ label: "Vastgelegd door", waarde: naam(c.paidByUserId) });
    if (r.ibanGemaskeerd) feiten.push({ label: "Naar rekening", waarde: r.ibanGemaskeerd });
  }

  return {
    leadId: r.leadId,
    bedrijfsnaam: r.bedrijfsnaam,
    commissieId: c?.id ?? null,
    status: c?.status ?? null,
    statusLabel: c ? COMMISSIE_STATUS_LABEL[c.status] : "Nog niet geregistreerd",
    bedrag: euroFromCents(bedragCents),
    bedragInvoer: (bedragCents / 100).toFixed(2).replace(".", ","),
    betaling,
    feiten,
    payableMailVerstuurd: Boolean(c?.payableMailSentAt),
    paidMailVerstuurd: Boolean(c?.paidMailSentAt),
    begunstigde:
      c?.payeeName && r.ibanGemaskeerd
        ? { naam: c.payeeName, ibanGemaskeerd: r.ibanGemaskeerd, ibanVoluit: r.ibanVoluit }
        : null,
  };
}

