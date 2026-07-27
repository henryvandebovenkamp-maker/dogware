import Link from "next/link";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { BRANCHES } from "@/lib/branches";
import { MAX_PER_DAG, verstuurdVandaag } from "@/lib/groei";
import { STAP_META } from "@/lib/groei/stappen";
import { aiBeschikbaar } from "@/lib/groei/ai";
import type { GroeiStap } from "@/lib/db/schema";

export const metadata = { title: "Groei" };

function groet(): string {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

/** "3 hondenscholen en 2 trimsalons" — telbaar en menselijk. */
function opsomming(delen: string[]): string {
  if (delen.length === 0) return "";
  if (delen.length === 1) return delen[0];
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

export default async function GroeiPage() {
  const user = await requireAdmin();
  const db = getDb();

  if (!db) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Groei</h1>
        <p className="mt-2 text-sm text-ink-500">
          Geen database geconfigureerd.
        </p>
      </div>
    );
  }

  const voornaam = user.naam.split(" ")[0];

  // Nieuw gevonden bedrijven, gegroepeerd per branche
  const nieuw = await db
    .select({
      branche: schema.groeiProspects.branche,
      n: count(),
    })
    .from(schema.groeiProspects)
    .where(
      and(
        eq(schema.groeiProspects.ownerUserId, user.id),
        eq(schema.groeiProspects.stap, "gevonden"),
      ),
    )
    .groupBy(schema.groeiProspects.branche);

  const nieuwTotaal = nieuw.reduce((s, r) => s + r.n, 0);
  const nieuwTekst = opsomming(
    nieuw
      .filter((r) => r.n > 0)
      .map((r) => {
        const b = BRANCHES.find((x) => x.slug === r.branche);
        const naam = b ? (r.n === 1 ? b.naamKlein : b.meervoud) : "bedrijven";
        return `${r.n} ${naam}`;
      }),
  );

  // Wat er vandaag op je ligt te wachten
  const [klaar] = await db
    .select({ n: count() })
    .from(schema.groeiProspects)
    .where(
      and(
        eq(schema.groeiProspects.ownerUserId, user.id),
        eq(schema.groeiProspects.stap, "voorbereid"),
      ),
    );

  const [gelezen] = await db
    .select({ n: count() })
    .from(schema.groeiProspects)
    .where(
      and(
        eq(schema.groeiProspects.ownerUserId, user.id),
        eq(schema.groeiProspects.stap, "gelezen"),
      ),
    );

  const vandaagVerstuurd = await verstuurdVandaag();

  // Laatste beweging
  const recent = await db
    .select({
      id: schema.groeiProspects.id,
      bedrijfsnaam: schema.groeiProspects.bedrijfsnaam,
      stap: schema.groeiProspects.stap,
      plaats: schema.groeiProspects.plaats,
      updatedAt: schema.groeiProspects.updatedAt,
    })
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.ownerUserId, user.id))
    .orderBy(desc(schema.groeiProspects.updatedAt))
    .limit(6);

  const [beantwoord] = await db
    .select({ n: count() })
    .from(schema.groeiProspects)
    .where(
      and(
        eq(schema.groeiProspects.ownerUserId, user.id),
        eq(schema.groeiProspects.stap, "reactie"),
      ),
    );

  const [ooitVerstuurd] = await db
    .select({ n: count() })
    .from(schema.groeiBerichten)
    .where(isNotNull(schema.groeiBerichten.verstuurdAt));

  return (
    <div className="mx-auto max-w-4xl">
      {/* De begroeting — geen grafieken */}
      <p className="text-sm font-semibold text-ink-300">{groet()} {voornaam} 👋</p>
      <h1 className="mt-2 text-balance text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-[1.7rem]">
        {nieuwTotaal > 0 ? (
          <>
            Ik heb {nieuwTekst} gevonden die volgens mij goed bij DogWare passen.
          </>
        ) : (
          <>Er staan vandaag geen nieuwe collega&apos;s klaar.</>
        )}
      </h1>
      {nieuwTotaal > 0 && (
        <p className="mt-2 text-[15px] text-ink-500">
          Misschien kunnen we deze collega&apos;s vandaag verrassen.
        </p>
      )}

      {/* Wat er op je ligt te wachten */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/groei/bedrijven?stap=voorbereid"
          className="group rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
        >
          <p className="text-2xl font-extrabold text-brand">{klaar?.n ?? 0}</p>
          <p className="mt-1 text-[14px] font-bold text-ink">Liggen klaar voor jou</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
            Voorstel en bericht zijn voorbereid. Jij leest ze na en beslist.
          </p>
        </Link>

        <Link
          href="/admin/groei/bedrijven?stap=gelezen"
          className="group rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
        >
          <p className="text-2xl font-extrabold text-gold">{gelezen?.n ?? 0}</p>
          <p className="mt-1 text-[14px] font-bold text-ink">Hebben je voorstel bekeken</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
            Misschien een mooi moment voor een kort berichtje.
          </p>
        </Link>

        <Link
          href="/admin/groei/bedrijven?stap=reactie"
          className="group rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
        >
          <p className="text-2xl font-extrabold text-sage">{beantwoord?.n ?? 0}</p>
          <p className="mt-1 text-[14px] font-bold text-ink">Hebben gereageerd</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
            Hier begint het echte gesprek.
          </p>
        </Link>
      </div>

      {/* De dagcap, expliciet zichtbaar */}
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-cream-100 px-5 py-4 ring-1 ring-ink/5">
        <p className="text-[14px] font-semibold text-ink">
          Vandaag verstuurd: {vandaagVerstuurd} van {MAX_PER_DAG}
        </p>
        <p className="text-[13px] text-ink-500">
          Deze grens zit vast in de code. Liever tien berichten waar iemand blij van
          wordt dan honderd die niemand leest.
        </p>
      </div>

      {!aiBeschikbaar() && (
        <p className="mt-4 rounded-2xl bg-brand-50 px-5 py-4 text-[13px] font-semibold text-brand-600 ring-1 ring-brand/15">
          Analyseren en voorbereiden staat uit: AI_GATEWAY_API_KEY ontbreekt.
        </p>
      )}

      {/* Laatste beweging */}
      <div className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-sm font-extrabold text-ink">Laatste beweging</h2>
          <Link
            href="/admin/groei/bedrijven"
            className="text-[13px] font-bold text-brand hover:text-brand-600"
          >
            Alle bedrijven
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white px-5 py-6 text-[14px] text-ink-500 shadow-soft ring-1 ring-ink/5">
            Nog geen bedrijven. Voeg er één toe om te beginnen.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/groei/bedrijven/${r.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-3.5 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold text-ink">
                      {r.bedrijfsnaam}
                    </span>
                    {r.plaats && (
                      <span className="block text-[12px] text-ink-300">{r.plaats}</span>
                    )}
                  </span>
                  <StapBadge stap={r.stap} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-10 text-[12px] text-ink-300">
        In totaal {ooitVerstuurd?.n ?? 0} berichten verstuurd. Elk bericht komt van jou,
        nooit van het systeem.
      </p>
    </div>
  );
}

export function StapBadge({ stap }: { stap: GroeiStap }) {
  const meta = STAP_META[stap];
  const kleuren = {
    grijs: "bg-cream-100 text-ink-500",
    brand: "bg-brand-100 text-brand-600",
    sage: "bg-sage-100 text-sage-600",
    gold: "bg-gold/15 text-gold",
  } as const;
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${kleuren[meta.kleur]}`}
    >
      {meta.label}
    </span>
  );
}
