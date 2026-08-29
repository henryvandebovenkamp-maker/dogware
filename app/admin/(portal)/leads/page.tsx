import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Inbox, Phone, Search } from "lucide-react";
import { laadAanvragen, type Aanvraag } from "@/lib/aanvragen-lijst";
import {
  BAKJES,
  BAKJE_LABEL,
  telPerBakje,
  urgentieSleutel,
  type Bakje,
} from "@/lib/aanvragen";
import { STAGE_META } from "@/lib/journey-stages";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Aanvragen",
  robots: { index: false, follow: false },
};

/**
 * Het werkscherm voor het commerciële proces.
 *
 * Dit was een lijst waarin elke aanvraag er hetzelfde uitzag, waardoor je elke
 * regel moest openen om te ontdekken of er iets moest gebeuren. Het beantwoordt
 * nu één vraag: wie heeft vandaag mijn aandacht nodig, en wat moet ik doen?
 *
 * De volgorde op het scherm volgt die vraag. Eerst "Actie nodig" — het langst
 * stilliggend bovenaan. Daarna de balk met bakjes om te filteren. Pas daarna
 * alle aanvragen. Wie niets hoeft te doen, hoeft ook niet te scrollen.
 *
 * Alle afleiding gebeurt in lib/aanvragen.ts, dus dit bestand kiest alleen wat
 * het toont. Wat de volgende stap ís komt uit dezelfde motor als de
 * detailpagina; die twee kunnen dus niet uit elkaar lopen.
 */
export default async function AanvragenPage({
  searchParams,
}: {
  searchParams: Promise<{ bakje?: string; q?: string }>;
}) {
  const { bakje: bakjeParam, q } = await searchParams;
  const aanvragen = await laadAanvragen();

  if (!aanvragen) {
    return (
      <Kader>
        <div className="rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
          <strong>Database niet gekoppeld.</strong> Zet <code>DATABASE_URL</code>{" "}
          in <code>.env.local</code>. Tot die tijd komen aanvragen alleen per
          e-mail binnen.
        </div>
      </Kader>
    );
  }

  const telling = telPerBakje(aanvragen.map((a) => a.afleiding));
  const actief = BAKJES.includes(bakjeParam as Bakje)
    ? (bakjeParam as Bakje)
    : null;

  const zoek = (q ?? "").trim().toLowerCase();
  const zichtbaar = aanvragen.filter((a) => {
    if (actief && a.afleiding.bakje !== actief) return false;
    if (!zoek) return true;
    const l = a.lead;
    return [l.bedrijfsnaam, l.naam, l.email, l.plaats]
      .join(" ")
      .toLowerCase()
      .includes(zoek);
  });

  // Het langst stilliggend eerst: wie het langst wacht, wacht ook het langst.
  const actieNodig = [...aanvragen]
    .filter((a) => a.afleiding.actieNodig)
    .sort((a, b) => urgentieSleutel(b.afleiding) - urgentieSleutel(a.afleiding));

  return (
    <Kader>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Aanvragen
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            {aanvragen.length} in totaal ·{" "}
            {actieNodig.length === 0
              ? "niets wat op je wacht"
              : `${actieNodig.length} wachten op jou`}
          </p>
        </div>

        <form className="relative" action="/admin/leads">
          {actief && <input type="hidden" name="bakje" value={actief} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Bedrijf, persoon, e-mail of plaats"
            className="w-full rounded-xl border border-cream-200 bg-white py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
          />
        </form>
      </div>

      {/* Actie nodig — het enige blok dat er echt toe doet */}
      {actieNodig.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-300">
            <AlertCircle className="h-4 w-4 text-brand" />
            Actie nodig
          </h2>
          <ul className="mt-3 space-y-2">
            {actieNodig.map((a) => (
              <li key={a.lead.id}>
                <Link
                  href={`/admin/leads/${a.lead.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-brand/20 transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block truncate text-[14px] font-extrabold text-ink">
                      {a.lead.bedrijfsnaam}
                    </span>
                    <span className="block truncate text-[12px] text-ink-500">
                      {a.afleiding.reden}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold text-brand-600">
                    {knopLabel(a)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bakjes — klikken filtert */}
      <div className="mt-7 flex flex-wrap gap-1.5">
        <Bakjeknop
          label="Alles"
          aantal={aanvragen.length}
          actief={!actief}
          href="/admin/leads"
        />
        {BAKJES.map((b) => (
          <Bakjeknop
            key={b}
            label={BAKJE_LABEL[b]}
            aantal={telling[b]}
            actief={actief === b}
            href={`/admin/leads?bakje=${b}`}
            nadruk={b === "opvolgen"}
          />
        ))}
      </div>

      {zichtbaar.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-ink/5">
          <Inbox className="h-7 w-7 text-ink-300" />
          <p className="text-sm font-semibold text-ink">Niets gevonden</p>
          <p className="text-[13px] text-ink-500">
            Pas je filter of zoekopdracht aan.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {zichtbaar.map((a) => (
            <Rij key={a.lead.id} a={a} />
          ))}
        </ul>
      )}
    </Kader>
  );
}

/**
 * Wat er op de knop staat.
 *
 * Bij opvolging niet het label uit de journey-motor: die stelt daar "Klant wil
 * doorgaan" voor, wat naast de reden "nog geen reactie" tegenstrijdig leest.
 * Opvolgen is hier de handeling; wat er daarna gebeurt, blijkt vanzelf.
 */
function knopLabel(a: Aanvraag): string {
  if (a.afleiding.bakje === "opvolgen") return "Opvolgen";
  return a.afleiding.actie.cta?.label ?? "Openen";
}

function Kader({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <div className="mx-auto w-full max-w-4xl">{children}</div>
    </main>
  );
}

function Bakjeknop({
  label,
  aantal,
  actief,
  href,
  nadruk = false,
}: {
  label: string;
  aantal: number;
  actief: boolean;
  href: string;
  nadruk?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition",
        actief
          ? "bg-ink text-cream"
          : nadruk && aantal > 0
            ? "bg-brand-100 text-brand-600 ring-1 ring-brand/20 hover:bg-brand-100/70"
            : "bg-white text-ink-700 ring-1 ring-ink/5 hover:bg-cream",
      )}
    >
      {label}
      <span className={cn("tabular-nums", !actief && "text-ink-300")}>
        {aantal}
      </span>
    </Link>
  );
}

/**
 * Eén compacte regel. Alles wat je nodig hebt om te besluiten of je hem opent
 * staat erin: wie het is, waar hij staat, hoe lang dat al zo is, en wat de
 * volgende stap is. Kleur alleen waar hij iets betekent — oranje vraagt om
 * jou, grijs wacht op de klant, groen is afgerond.
 */
function Rij({ a }: { a: Aanvraag }) {
  const { lead, afleiding } = a;
  const wachtOpKlant = afleiding.actie.waitingOn === "klant";

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
            {lead.diensten.length > 0 && ` · ${lead.diensten[0]}`}
          </span>
        </Link>

        <span className="min-w-0 basis-48 text-[12px]">
          <span className="block font-semibold text-ink-700">
            {STAGE_META[lead.stage].korte}
            {afleiding.dagenSindsDemo !== null && (
              <span className="font-normal text-ink-300">
                {" · "}
                {afleiding.dagenSindsDemo === 0
                  ? "vandaag"
                  : `${afleiding.dagenSindsDemo} d`}
              </span>
            )}
          </span>
          <span
            className={cn(
              "block truncate",
              afleiding.actieNodig
                ? "font-semibold text-brand-600"
                : wachtOpKlant
                  ? "text-ink-300"
                  : "text-sage-600",
            )}
          >
            {afleiding.actieNodig
              ? knopLabel(a)
              : wachtOpKlant
                ? "Wacht op klant"
                : "Afgerond"}
          </span>
        </span>

        {/* Mobiel het belangrijkst: bellen zonder de aanvraag te openen */}
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
