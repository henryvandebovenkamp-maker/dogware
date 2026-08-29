import Link from "next/link";
import { Phone, Users } from "lucide-react";
import { alleenKlanten, laadAanvragen, type Aanvraag } from "@/lib/aanvragen-lijst";
import { STAGE_META } from "@/lib/journey-stages";
import { euroFromCents } from "@/lib/money";

export const metadata = { title: "Klanten" };

/**
 * Wie er inmiddels klant is.
 *
 * Bewust geen eigen klantentabel en geen tweede dossier: een klant ís de
 * aanvraag waarmee het begon. Dezelfde rij, dezelfde tijdlijn, dezelfde mails,
 * dezelfde partnerattributie — alleen verder in het traject. Klikken opent dan
 * ook exact dezelfde detailpagina. Zou een klant hier als nieuw record worden
 * aangemaakt, dan raak je precies de historie kwijt die je later nodig hebt.
 *
 * Klant word je door te betalen, niet doordat iemand een status omzet. De
 * eerste termijn is het feit waar deze lijst op afgaat; een handmatige status
 * kan achterlopen, een betaling niet.
 *
 * Wat er ná dat moment gebeurt — bouwen, opleveren, live — is de operationele
 * kant en staat er als fase bij. Het commerciële werk blijft op /admin/leads.
 */
export default async function KlantenPage() {
  const aanvragen = await laadAanvragen();

  if (!aanvragen) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
          <strong>Database niet gekoppeld.</strong>
        </div>
      </div>
    );
  }

  const klanten = alleenKlanten(aanvragen);
  const maandelijks = klanten.reduce(
    (som, k) => som + (k.commerce?.maandbedragCenten ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage text-white">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Klanten
          </h1>
          <p className="text-[13px] text-ink-500">
            {klanten.length === 0
              ? "Nog geen klanten"
              : `${klanten.length} ${klanten.length === 1 ? "klant" : "klanten"}`}
            {maandelijks > 0 && ` · ${euroFromCents(maandelijks)} per maand`}
          </p>
        </div>
      </div>

      {klanten.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-ink/5">
          <p className="text-sm font-semibold text-ink">Nog geen klanten</p>
          <p className="max-w-sm text-[13px] leading-relaxed text-ink-500">
            Zodra de eerste termijn van een aanvraag binnen is, verschijnt die
            hier. Het blijft dezelfde aanvraag — met zijn hele historie.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {klanten.map((k) => (
            <KlantRij key={k.lead.id} k={k} />
          ))}
        </ul>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-ink-300">
        Een klant is hier dezelfde aanvraag als waarmee het begon — klikken
        opent hetzelfde dossier, inclusief tijdlijn, mails en partner. Het
        lopende commerciële werk staat bij{" "}
        <Link
          href="/admin/leads"
          className="font-semibold text-ink-500 hover:text-ink"
        >
          Aanvragen
        </Link>
        .
      </p>
    </div>
  );
}

function KlantRij({ k }: { k: Aanvraag }) {
  const { lead, commerce } = k;
  const sinds = lead.demoSentAt ?? lead.createdAt;

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5 transition hover:shadow-lift">
        <Link
          href={`/admin/leads/${lead.id}`}
          className="min-w-0 flex-1 basis-64"
        >
          <span className="block truncate text-[14px] font-extrabold text-ink">
            {lead.bedrijfsnaam}
          </span>
          <span className="block truncate text-[12px] text-ink-500">
            {lead.naam} · {lead.plaats}
          </span>
        </Link>

        <span className="basis-40 text-[12px]">
          <span className="block font-semibold text-ink-700">
            {STAGE_META[lead.stage].label}
          </span>
          <span className="block text-ink-300">
            klant sinds{" "}
            {sinds.toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </span>

        <span className="basis-24 text-[12px]">
          {commerce && commerce.maandbedragCenten > 0 ? (
            <>
              <span className="block font-bold tabular-nums text-ink">
                {euroFromCents(commerce.maandbedragCenten)}
              </span>
              <span className="block text-ink-300">per maand</span>
            </>
          ) : (
            <span className="block text-ink-300">geen abonnement</span>
          )}
        </span>

        {lead.telefoon && (
          <a
            href={`tel:${lead.telefoon.replace(/\s/g, "")}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-ink-500 ring-1 ring-ink/5 transition hover:text-brand"
            aria-label={`Bel ${lead.naam}`}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </li>
  );
}
