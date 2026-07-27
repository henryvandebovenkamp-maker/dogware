import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { BRANCHES, type BrancheSlug } from "@/lib/branches";
import { isGeblokkeerd, logGroeiEvent } from "@/lib/groei";
import { normaliseerWebsite, zoekBedrijven, type OsmVondst } from "@/lib/groei/bronnen/osm";
import type { GroeiAgent } from "@/lib/db/schema";

/**
 * De agentmotor.
 *
 * Eén run doet drie dingen: ontdekken bij de bron, ontdubbelen tegen wat we al
 * hebben, en langs de kwaliteitscontrole. Alleen wat daar doorheen komt belandt
 * in de lijst.
 *
 * Idempotent: een run die halverwege afbreekt kan zonder bezwaar opnieuw. Elk
 * bedrijf draagt de sleutel van zijn bron, en daar ligt een unieke index op,
 * dus dezelfde vermelding kan nooit twee keer landen.
 */

export type Kwaliteitsoordeel =
  | { goed: true }
  | { goed: false; reden: string };

/**
 * De kwaliteitsagent. Draait vóór opslaan, want een afgekeurd bedrijf hoort
 * niet eerst in de lijst te verschijnen en er dan weer uit te verdwijnen.
 */
export async function beoordeelVondst(
  vondst: OsmVondst,
  bestaandeWebsites: Set<string>,
  bestaandeNamen: Set<string>,
): Promise<Kwaliteitsoordeel> {
  if (vondst.bedrijfsnaam.trim().length < 2) {
    return { goed: false, reden: "geen bruikbare naam" };
  }

  // Zonder website valt er niets te analyseren en dus ook niets persoonlijks
  // te schrijven. Die bedrijven overslaan houdt de lijst bruikbaar.
  if (!vondst.website) {
    return { goed: false, reden: "geen website" };
  }

  const sleutel = vondst.website.toLowerCase();
  if (bestaandeWebsites.has(sleutel)) {
    return { goed: false, reden: "kenden we al (zelfde website)" };
  }

  // Tweede dedupe-laag: dezelfde naam in dezelfde plaats, andere website.
  const naamSleutel = `${vondst.bedrijfsnaam.toLowerCase().trim()}|${(vondst.plaats ?? "").toLowerCase().trim()}`;
  if (bestaandeNamen.has(naamSleutel)) {
    return { goed: false, reden: "kenden we al (zelfde naam en plaats)" };
  }

  if (vondst.email && (await isGeblokkeerd(vondst.email))) {
    return { goed: false, reden: "staat op de uitsluitlijst" };
  }

  return { goed: true };
}

/** Menselijke samenvatting van een run — geen logbestand. */
function samenvatting(
  agent: GroeiAgent,
  gevonden: number,
  bekeken: number,
  nieuw: number,
  redenen: Map<string, number>,
): string {
  const branche = BRANCHES.find((b) => b.slug === agent.branche);
  const waar = agent.provincies.length
    ? agent.provincies.join(" en ")
    : "heel Nederland";
  const wat = branche ? branche.meervoud : "hondenbedrijven";

  if (gevonden === 0) {
    return `Geen ${wat} gevonden in ${waar}.`;
  }

  const afgevallen = [...redenen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([r, n]) => `${n}× ${r}`)
    .join(", ");

  // Wat de agent niet meer heeft bekeken omdat zijn limiet vol zat. Dat is
  // iets anders dan afgevallen, en zo hoort het er ook te staan.
  const rest = gevonden - bekeken;
  const bewaard =
    rest > 0 ? ` De overige ${rest} bewaart hij voor de volgende keer.` : "";

  if (nieuw === 0) {
    return `${bekeken} ${wat} bekeken in ${waar}, niets nieuws erbij${afgevallen ? ` (${afgevallen})` : ""}.${bewaard}`;
  }

  return `${bekeken} ${wat} bekeken in ${waar}. ${nieuw} nieuw toegevoegd${afgevallen ? `, de rest viel af (${afgevallen})` : ""}.${bewaard}`;
}

export type RunResultaat = {
  gevonden: number;
  nieuw: number;
  overgeslagen: number;
  samenvatting: string;
};

/** Voer één agent uit. Legt zelf een run vast, ook als het misgaat. */
export async function draaiAgent(agent: GroeiAgent): Promise<RunResultaat> {
  const db = getDb();
  if (!db) throw new Error("Geen database.");

  const [run] = await db
    .insert(schema.groeiAgentRuns)
    .values({ agentId: agent.id, status: "bezig" })
    .returning({ id: schema.groeiAgentRuns.id });

  try {
    const branches: BrancheSlug[] = agent.branche
      ? [agent.branche as BrancheSlug]
      : [];
    if (branches.length === 0) {
      throw new Error("Deze agent heeft nog geen branche gekregen.");
    }

    // Alles wat we al kennen, in één keer opgehaald: goedkoper dan per vondst
    // een query, en de set is klein genoeg om in het geheugen te passen.
    const bestaand = await db
      .select({
        website: schema.groeiProspects.website,
        bedrijfsnaam: schema.groeiProspects.bedrijfsnaam,
        plaats: schema.groeiProspects.plaats,
      })
      .from(schema.groeiProspects)
      .where(eq(schema.groeiProspects.ownerUserId, agent.ownerUserId));

    const websites = new Set(
      bestaand
        .map((b) => normaliseerWebsite(b.website)?.toLowerCase())
        .filter((w): w is string => Boolean(w)),
    );
    const namen = new Set(
      bestaand.map(
        (b) =>
          `${b.bedrijfsnaam.toLowerCase().trim()}|${(b.plaats ?? "").toLowerCase().trim()}`,
      ),
    );

    let gevonden = 0;
    let bekeken = 0;
    let nieuw = 0;
    const redenen = new Map<string, number>();

    for (const branche of branches) {
      const vondsten = await zoekBedrijven({
        branche,
        provincies: agent.provincies,
        max: 300,
      });
      gevonden += vondsten.length;

      for (const v of vondsten) {
        if (nieuw >= agent.maxPerRun) break;
        bekeken++;

        const oordeel = await beoordeelVondst(v, websites, namen);
        if (!oordeel.goed) {
          redenen.set(oordeel.reden, (redenen.get(oordeel.reden) ?? 0) + 1);
          continue;
        }

        try {
          const [rij] = await db
            .insert(schema.groeiProspects)
            .values({
              ownerUserId: agent.ownerUserId,
              bedrijfsnaam: v.bedrijfsnaam,
              branche: v.branche,
              plaats: v.plaats,
              website: v.website,
              email: v.email,
              telefoon: v.telefoon,
              bron: "openstreetmap",
              bronId: v.bronId,
              gevondenDoorAgentId: agent.id,
              // Herkomst per gegeven: onder de AVG moet je kunnen
              // verantwoorden waar informatie vandaan komt.
              herkomst: {
                bron: "OpenStreetMap (open data, ODbL)",
                osm: v.bronId,
                gevondenDoor: agent.naam,
                gevondenOp: new Date().toISOString().slice(0, 10),
              },
            })
            .returning({ id: schema.groeiProspects.id });

          if (rij) {
            nieuw++;
            websites.add(v.website!.toLowerCase());
            namen.add(
              `${v.bedrijfsnaam.toLowerCase().trim()}|${(v.plaats ?? "").toLowerCase().trim()}`,
            );
            await logGroeiEvent(
              rij.id,
              "gevonden",
              `Gevonden door ${agent.naam} via OpenStreetMap`,
              { bronId: v.bronId },
            );
          }
        } catch {
          // Unieke index sloeg toe: een gelijktijdige run had hem al.
          redenen.set("al toegevoegd", (redenen.get("al toegevoegd") ?? 0) + 1);
        }
      }
    }

    const overgeslagen = gevonden - nieuw;
    const tekst = samenvatting(agent, gevonden, bekeken, nieuw, redenen);

    await db
      .update(schema.groeiAgentRuns)
      .set({
        status: "klaar",
        klaarAt: new Date(),
        gevonden,
        nieuw,
        overgeslagen,
        samenvatting: tekst,
      })
      .where(eq(schema.groeiAgentRuns.id, run.id));

    await db
      .update(schema.groeiAgents)
      .set({ laatsteRunAt: new Date() })
      .where(eq(schema.groeiAgents.id, agent.id));

    return { gevonden, nieuw, overgeslagen, samenvatting: tekst };
  } catch (err) {
    const bericht = err instanceof Error ? err.message : "onbekende fout";
    await db
      .update(schema.groeiAgentRuns)
      .set({ status: "mislukt", klaarAt: new Date(), fout: bericht })
      .where(eq(schema.groeiAgentRuns.id, run.id));
    throw err;
  }
}

/** De agents die er standaard zijn als je nog niets hebt ingesteld. */
export const STANDAARD_AGENTS: {
  naam: string;
  branche: BrancheSlug;
  provincies: string[];
}[] = [
  { naam: "Hondenschool-agent Nederland", branche: "hondenschool", provincies: [] },
  { naam: "Trimsalon-agent Nederland", branche: "trimsalon", provincies: [] },
  { naam: "Pension-agent Nederland", branche: "pension", provincies: [] },
];

/** Maakt de standaardagents aan als er nog geen enkele is. */
export async function zorgVoorAgents(ownerUserId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [bestaat] = await db
    .select({ id: schema.groeiAgents.id })
    .from(schema.groeiAgents)
    .where(eq(schema.groeiAgents.ownerUserId, ownerUserId))
    .limit(1);
  if (bestaat) return;

  await db.insert(schema.groeiAgents).values(
    STANDAARD_AGENTS.map((a) => ({
      ownerUserId,
      naam: a.naam,
      soort: "ontdekken" as const,
      branche: a.branche,
      provincies: a.provincies,
    })),
  );
}
