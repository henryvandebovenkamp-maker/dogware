import Link from "next/link";
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { BRANCHES } from "@/lib/branches";
import { VINDBARE_BRANCHES } from "@/lib/groei/bronnen/osm";
import { maakStandaardAgents } from "@/app/actions/groei-agents";
import { STANDAARD_AGENTS } from "@/lib/groei/agents";
import { AgentKaart } from "./agent-kaart";

export const metadata = { title: "Agents" };

function wanneer(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AgentsPage() {
  const user = await requireAdmin();
  const db = getDb();

  const agents = db
    ? await db
        .select()
        .from(schema.groeiAgents)
        .where(eq(schema.groeiAgents.ownerUserId, user.id))
        .orderBy(desc(schema.groeiAgents.createdAt))
    : [];

  const runs =
    db && agents.length
      ? await db
          .select()
          .from(schema.groeiAgentRuns)
          .where(
            inArray(
              schema.groeiAgentRuns.agentId,
              agents.map((a) => a.id),
            ),
          )
          .orderBy(desc(schema.groeiAgentRuns.gestartAt))
          .limit(12)
      : [];

  // Hoeveel bedrijven wachten er nog op de Onderzoeksagent? Dat getal zegt
  // meer dan welke status dan ook: het is het werk dat nog voor je ligt.
  const [wachtrij] = db
    ? await db
        .select({ n: count() })
        .from(schema.groeiProspects)
        .leftJoin(
          schema.groeiAnalyses,
          eq(schema.groeiAnalyses.prospectId, schema.groeiProspects.id),
        )
        .where(
          and(
            eq(schema.groeiProspects.ownerUserId, user.id),
            eq(schema.groeiProspects.stap, "gevonden"),
            isNull(schema.groeiAnalyses.id),
            isNotNull(schema.groeiProspects.website),
          ),
        )
    : [{ n: 0 }];

  const agentNaam = new Map(agents.map((a) => [a.id, a.naam]));

  const heeft = new Set(agents.map((a) => a.naam));
  const ontbrekend = STANDAARD_AGENTS.filter((a) => !heeft.has(a.naam)).map((a) => a.naam);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/groei"
        className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink"
      >
        ← Groei
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">
        Je agents
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-500">
        Ze zoeken gericht naar hondenbedrijven, controleren wat ze vinden en zetten
        alleen bruikbare kansen voor je klaar. Jij hoeft niets in te voeren.
      </p>

      {agents.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-7 text-center shadow-soft ring-1 ring-ink/5">
          <p className="text-[15px] font-bold text-ink">Nog geen agents ingesteld</p>
          <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-ink-500">
            Ik zet er drie voor je klaar: één voor hondenscholen, één voor trimsalons en
            één voor pensions. Je kunt ze daarna beperken tot een provincie.
          </p>
          <form action={maakStandaardAgents} className="mt-5">
            <button
              type="submit"
              className="rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold leading-[1.2] text-white transition-all duration-150 ease-out hover:-translate-y-px hover:bg-brand-600"
            >
              Zet mijn agents klaar
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {agents.map((a) => {
            const b = BRANCHES.find((x) => x.slug === a.branche);
            return (
              <AgentKaart
                key={a.id}
                id={a.id}
                naam={a.naam}
                soort={a.soort}
                wachtrij={a.soort === "onderzoeken" ? (wachtrij?.n ?? 0) : undefined}
                branche={b ? b.meervoud : "hondenbedrijven"}
                gebied={a.provincies.length ? a.provincies.join(" en ") : "heel Nederland"}
                actief={a.actief}
                maxPerRun={a.maxPerRun}
                laatste={wanneer(a.laatsteRunAt)}
              />
            );
          })}
        </div>
      )}

      {/* Is er sinds de vorige keer een rol bijgekomen? Dan kun je die erbij zetten. */}
      {agents.length > 0 && ontbrekend.length > 0 && (
        <form
          action={maakStandaardAgents}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream-100 px-5 py-4 ring-1 ring-ink/5"
        >
          <p className="text-[13px] text-ink-500">
            Er is een rol bijgekomen die jij nog niet hebt:{" "}
            <strong className="text-ink">{ontbrekend.join(", ")}</strong>.
          </p>
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold leading-[1.2] text-cream transition-all duration-150 ease-out hover:-translate-y-px hover:bg-ink-700"
          >
            Erbij zetten
          </button>
        </form>
      )}

      {/* Wat de agents kunnen vinden — eerlijk over de grenzen van de bron */}
      <section className="mt-10 rounded-2xl bg-cream-100 p-6 ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Waar ze kijken</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          Bedrijven vinden gebeurt in OpenStreetMap, een openbare kaart die door vrijwilligers wordt bijgehouden.
          Open data, vrij te hergebruiken — geen gegevens die achter een slot vandaan
          zijn gehaald.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
          Vindbaar zijn nu:{" "}
          <strong className="text-ink">
            {VINDBARE_BRANCHES.map(
              (s) => BRANCHES.find((b) => b.slug === s)?.meervoud ?? s,
            ).join(", ")}
          </strong>
          . Gedragstherapeuten en dierenverzorging aan huis staan er meestal niet in —
          dat zijn vaak geen vaste locaties. Daar komt later een andere bron voor.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
          De Onderzoeksagent leest daarna hun eigen website: alleen de openbare
          voorkant, en alleen als hun robots.txt dat toestaat. Hij zoekt een
          contactadres, kijkt of het een rechtspersoon is — dat bepaalt of je ze
          überhaupt mag benaderen — en noteert wat hem concreet opvalt.
        </p>
        <p className="mt-3 text-[12px] text-ink-300">
          Niet elk hondenbedrijf staat op de kaart. Wat de agents vinden is een
          startpunt, geen volledige lijst. En vindt de agent geen duidelijke
          rechtsvorm, dan blijft de grondslag onbekend en gaat er niets uit — een
          verkeerde gok kost hier meer dan een gemiste kans.
        </p>
      </section>

      {/* Diagnose — beschikbaar, maar niet de hoofdbeleving */}
      {runs.length > 0 && (
        <details className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <summary className="cursor-pointer list-none text-sm font-extrabold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
            Wat de agents tot nu toe deden
          </summary>
          <ul className="mt-4 space-y-2.5">
            {runs.map((r) => (
              <li key={r.id} className="rounded-xl bg-cream px-4 py-3">
                <p className="text-[13px] font-semibold text-ink">
                  {agentNaam.get(r.agentId) ?? "Agent"}
                </p>
                <p className="text-[13px] leading-relaxed text-ink-500">
                  {r.fout ? `Ging mis: ${r.fout}` : (r.samenvatting ?? "Bezig…")}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-300">
                  {wanneer(r.gestartAt)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
