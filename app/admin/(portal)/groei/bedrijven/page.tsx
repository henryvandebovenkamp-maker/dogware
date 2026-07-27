import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { BRANCHES } from "@/lib/branches";
import { GRONDSLAG_META, STAP_META, STAP_VOLGORDE } from "@/lib/groei/stappen";
import type { GroeiStap } from "@/lib/db/schema";

export const metadata = { title: "Bedrijven" };

const KLEUREN = {
  grijs: "bg-cream-100 text-ink-500",
  brand: "bg-brand-100 text-brand-600",
  sage: "bg-sage-100 text-sage-600",
  gold: "bg-gold/15 text-gold",
} as const;

function Badge({ stap }: { stap: GroeiStap }) {
  const meta = STAP_META[stap];
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${KLEUREN[meta.kleur]}`}
    >
      {meta.label}
    </span>
  );
}

export default async function BedrijvenPage({
  searchParams,
}: {
  searchParams: Promise<{ stap?: string }>;
}) {
  const user = await requireAdmin();
  const { stap } = await searchParams;
  const db = getDb();

  const actief = STAP_VOLGORDE.includes(stap as GroeiStap)
    ? (stap as GroeiStap)
    : stap === "niet-nu"
      ? ("niet-nu" as GroeiStap)
      : null;

  const rijen = db
    ? await db
        .select()
        .from(schema.groeiProspects)
        .where(
          actief
            ? and(
                eq(schema.groeiProspects.ownerUserId, user.id),
                eq(schema.groeiProspects.stap, actief),
              )
            : eq(schema.groeiProspects.ownerUserId, user.id),
        )
        .orderBy(desc(schema.groeiProspects.updatedAt))
        .limit(200)
    : [];

  const filters: { key: string | null; label: string }[] = [
    { key: null, label: "Alles" },
    ...[...STAP_VOLGORDE, "niet-nu" as GroeiStap].map((s) => ({
      key: s,
      label: STAP_META[s].label,
    })),
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Bedrijven</h1>
          <p className="mt-1 text-sm text-ink-500">
            Collega&apos;s die misschien iets aan DogWare hebben.
          </p>
        </div>
        <Link
          href="/admin/groei/bedrijven/nieuw"
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold leading-[1.2] text-white shadow-[0_1px_2px_rgba(28,21,15,0.08)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-brand-600"
        >
          Bedrijf toevoegen
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const aan = (f.key ?? null) === actief;
          return (
            <Link
              key={f.label}
              href={f.key ? `/admin/groei/bedrijven?stap=${f.key}` : "/admin/groei/bedrijven"}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                aan
                  ? "bg-ink text-cream"
                  : "bg-white text-ink-500 ring-1 ring-ink/5 hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rijen.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-5 py-8 text-center text-[14px] text-ink-500 shadow-soft ring-1 ring-ink/5">
          {actief
            ? "Geen bedrijven in deze stap."
            : "Nog geen bedrijven. Voeg er één toe om te beginnen."}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rijen.map((r) => {
            const branche = BRANCHES.find((b) => b.slug === r.branche);
            const grondslag = GRONDSLAG_META[r.grondslag];
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/groei/bedrijven/${r.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-soft ring-1 ring-ink/5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-ink">
                      {r.bedrijfsnaam}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-300">
                      {branche && <span>{branche.naam}</span>}
                      {r.plaats && <span>· {r.plaats}</span>}
                      {!grondslag.magBenaderen && (
                        <span className="font-semibold text-brand-600">
                          · grondslag nog niet vastgesteld
                        </span>
                      )}
                    </span>
                  </span>
                  <Badge stap={r.stap} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
