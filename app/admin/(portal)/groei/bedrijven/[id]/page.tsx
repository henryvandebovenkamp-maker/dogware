import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { branding } from "@/lib/branding";
import { BRANCHES } from "@/lib/branches";
import { magVerzenden } from "@/lib/groei";
import { GRONDSLAG_META, STAP_META } from "@/lib/groei/stappen";
import { aiBeschikbaar } from "@/lib/groei/ai";
import { BerichtForm } from "./bericht-form";
import { VoorbereidKnop } from "./voorbereid-knop";

export const metadata = { title: "Bedrijf" };

const KLEUREN = {
  grijs: "bg-cream-100 text-ink-500",
  brand: "bg-brand-100 text-brand-600",
  sage: "bg-sage-100 text-sage-600",
  gold: "bg-gold/15 text-gold",
} as const;

function Kaart({
  titel,
  children,
  toelichting,
}: {
  titel: string;
  children: React.ReactNode;
  toelichting?: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
      <h2 className="text-sm font-extrabold text-ink">{titel}</h2>
      {toelichting && (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{toelichting}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function BedrijfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = getDb();
  if (!db) notFound();

  const [p] = await db
    .select()
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, id))
    .limit(1);
  if (!p) notFound();

  const [analyse] = await db
    .select()
    .from(schema.groeiAnalyses)
    .where(eq(schema.groeiAnalyses.prospectId, p.id))
    .orderBy(desc(schema.groeiAnalyses.createdAt))
    .limit(1);

  const [voorstel] = await db
    .select()
    .from(schema.groeiVoorstellen)
    .where(eq(schema.groeiVoorstellen.prospectId, p.id))
    .orderBy(desc(schema.groeiVoorstellen.createdAt))
    .limit(1);

  const [bericht] = await db
    .select()
    .from(schema.groeiBerichten)
    .where(eq(schema.groeiBerichten.prospectId, p.id))
    .orderBy(desc(schema.groeiBerichten.createdAt))
    .limit(1);

  const tijdlijn = await db
    .select()
    .from(schema.groeiEvents)
    .where(eq(schema.groeiEvents.prospectId, p.id))
    .orderBy(desc(schema.groeiEvents.createdAt))
    .limit(40);

  const oordeel = await magVerzenden(p.id);
  const branche = BRANCHES.find((b) => b.slug === p.branche);
  const grondslag = GRONDSLAG_META[p.grondslag];
  const stapMeta = STAP_META[p.stap];
  const voorstelLink = voorstel ? `${branding.siteUrl}/voorstel/${voorstel.token}` : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/groei/bedrijven"
        className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink"
      >
        ← Bedrijven
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {p.bedrijfsnaam}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-500">
            {branche && <span>{branche.naam}</span>}
            {p.plaats && <span>· {p.plaats}</span>}
            {p.website && (
              <>
                <span>·</span>
                <a
                  href={p.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-brand hover:text-brand-600"
                >
                  website
                </a>
              </>
            )}
            {p.email && <span>· {p.email}</span>}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${KLEUREN[stapMeta.kleur]}`}
        >
          {stapMeta.label}
        </span>
      </div>

      {/* Mag je ze benaderen? Altijd zichtbaar, nooit een verrassing bij verzenden. */}
      <div
        className={`mt-6 rounded-2xl px-5 py-4 ring-1 ${
          grondslag.magBenaderen
            ? "bg-sage-100/60 ring-sage/20"
            : "bg-brand-50 ring-brand/20"
        }`}
      >
        <p className="text-[13px] font-bold text-ink">{grondslag.label}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
          {grondslag.uitleg}
        </p>
        {p.herkomst?.bron && (
          <p className="mt-1.5 text-[12px] text-ink-300">
            Herkomst: {p.herkomst.bron}
          </p>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {/* Stap 1 — bekijken */}
        {!analyse ? (
          <Kaart
            titel="Nog niet bekeken"
            toelichting="Ik lees hun website en kijk wat er al goed gaat. Daarna schrijf ik een concept dat jij naleest."
          >
            <VoorbereidKnop
              prospectId={p.id}
              opnieuw={false}
              uitgeschakeld={
                !p.website
                  ? "Zonder website valt er niets te bekijken. Vul er eerst één in."
                  : !aiBeschikbaar()
                    ? "AI_GATEWAY_API_KEY ontbreekt — voorbereiden staat uit."
                    : undefined
              }
            />
          </Kaart>
        ) : (
          <>
            {/* Wat er al goed gaat */}
            <Kaart
              titel="Wat er al goed gaat"
              toelichting="Hier begint elk gesprek mee. Nooit met wat er mis is."
            >
              <ul className="space-y-2">
                {analyse.sterk.map((s) => (
                  <li key={s} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                    {s}
                  </li>
                ))}
              </ul>
            </Kaart>

            {/* Het bewijs van aandacht */}
            <Kaart
              titel={`Wat ik op hun site zag (${analyse.details.length})`}
              toelichting="Dit is het bewijs dat er echt gekeken is. Zonder minstens één detail blokkeert het systeem verzenden."
            >
              {analyse.details.length === 0 ? (
                <p className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-600">
                  Niets concreets gevonden. Een bericht zou nu een standaardmail zijn.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {analyse.details.map((d) => (
                    <li key={d.wat} className="rounded-xl bg-cream px-4 py-3">
                      <p className="text-[14px] font-semibold text-ink">{d.wat}</p>
                      <p className="text-[12px] text-ink-300">{d.waar}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Kaart>

            {/* Past het? */}
            {!analyse.past && (
              <Kaart
                titel="Mijn advies: overslaan"
                toelichting="Niet elk bedrijf hoeft benaderd te worden. Dat maakt de rest geloofwaardiger."
              >
                <p className="text-[14px] leading-relaxed text-ink-700">
                  {analyse.passendheidUitleg}
                </p>
              </Kaart>
            )}

            {/* Ideeën */}
            {analyse.kansen.length > 0 && (
              <Kaart
                titel="Ideeën die bij hen passen"
                toelichting="Positief geformuleerd — dit zijn aanvullingen, geen tekortkomingen."
              >
                <ul className="space-y-3">
                  {analyse.kansen.map((k) => (
                    <li key={k.titel} className="rounded-xl bg-cream px-4 py-3">
                      <p className="text-[14px] font-bold text-ink">{k.titel}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
                        {k.waarom}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
                        {k.module}
                      </p>
                    </li>
                  ))}
                </ul>
              </Kaart>
            )}

            {/* Het voorstel */}
            {voorstel && (
              <Kaart
                titel="Het inspiratievoorstel"
                toelichting="Een pagina in jouw huisstijl. Geen offerte, geen prijzen."
              >
                <p className="text-[14px] font-semibold text-ink">{voorstel.titel}</p>
                {voorstelLink && (
                  <a
                    href={`/voorstel/${voorstel.token}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-block text-[13px] font-bold text-brand hover:text-brand-600"
                  >
                    Bekijk zoals zij hem zien →
                  </a>
                )}
                <p className="mt-3 text-[13px] text-ink-500">
                  {voorstel.aantalKeerGeopend > 0 ? (
                    <>
                      Geopend: <strong>{voorstel.aantalKeerGeopend}×</strong>
                      {voorstel.laatstGeopendAt && (
                        <>
                          , laatst op{" "}
                          {voorstel.laatstGeopendAt.toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "long",
                          })}
                        </>
                      )}
                      .
                    </>
                  ) : (
                    "Nog niet geopend."
                  )}
                </p>
              </Kaart>
            )}

            {/* Het bericht */}
            {bericht && (
              <Kaart
                titel={bericht.verstuurdAt ? "Verstuurd bericht" : "Concept — jij beslist"}
                toelichting={
                  bericht.verstuurdAt
                    ? undefined
                    : "Lees het na en pas aan wat je anders zou zeggen. Het gaat straks van jou uit, niet van het systeem."
                }
              >
                {bericht.verstuurdAt ? (
                  <div>
                    <p className="text-[14px] font-bold text-ink">{bericht.onderwerp}</p>
                    <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-cream px-4 py-3 font-sans text-[14px] leading-relaxed text-ink-700">
                      {bericht.tekst}
                    </pre>
                    <p className="mt-3 text-[12px] text-ink-300">
                      Verstuurd op{" "}
                      {bericht.verstuurdAt.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {bericht.bewerktDoorHenry && " · door jou aangepast"}
                    </p>
                  </div>
                ) : (
                  <BerichtForm
                    berichtId={bericht.id}
                    onderwerp={bericht.onderwerp}
                    tekst={bericht.tekst}
                    voorstelLink={voorstelLink}
                    mag={oordeel.mag}
                    reden={oordeel.mag ? undefined : oordeel.reden}
                    uitleg={oordeel.mag ? undefined : oordeel.uitleg}
                  />
                )}
              </Kaart>
            )}

            {/* Opnieuw bekijken */}
            {!bericht && (
              <Kaart titel="Opnieuw bekijken">
                <VoorbereidKnop
                  prospectId={p.id}
                  opnieuw
                  uitgeschakeld={
                    !aiBeschikbaar()
                      ? "AI_GATEWAY_API_KEY ontbreekt — voorbereiden staat uit."
                      : undefined
                  }
                />
              </Kaart>
            )}
          </>
        )}

        {/* Tijdlijn */}
        <Kaart titel="Tijdlijn">
          {tijdlijn.length === 0 ? (
            <p className="text-[13px] text-ink-300">Nog niets gebeurd.</p>
          ) : (
            <ol className="space-y-3">
              {tijdlijn.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand/40" />
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">
                      {e.label}
                    </span>
                    <span className="block text-[12px] text-ink-300">
                      {e.createdAt.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Kaart>
      </div>
    </div>
  );
}
