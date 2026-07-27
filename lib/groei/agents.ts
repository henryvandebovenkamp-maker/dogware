import "server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { BRANCHES, type BrancheSlug } from "@/lib/branches";
import { isGeblokkeerd, logGroeiEvent } from "@/lib/groei";
import { normaliseerWebsite, zoekBedrijven, type OsmVondst } from "@/lib/groei/bronnen/osm";
import { onderzoekProspect } from "@/lib/groei/onderzoek";
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

/** De Ontdek-agent: nieuwe bedrijven vinden bij de bron. */
async function ontdek(agent: GroeiAgent): Promise<RunResultaat> {
  const db = getDb();
  if (!db) throw new Error("Geen database.");

  {
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
    return { gevonden, nieuw, overgeslagen, samenvatting: tekst };
  }
}

/**
 * De Onderzoeksagent: van een naam op de kaart naar een bedrijf waar je iets
 * over kunt zeggen.
 *
 * Pakt bedrijven die nog nooit bekeken zijn, oudste eerst — anders blijft de
 * onderkant van de lijst voor altijd liggen. Eén bedrijf dat struikelt mag de
 * run niet stoppen; die krijgt gewoon een volgende keer weer een kans.
 */
async function onderzoek(agent: GroeiAgent): Promise<RunResultaat> {
  const db = getDb();
  if (!db) throw new Error("Geen database.");

  /**
   * Nog nooit bekeken = geen enkele analyse. Een left join is hier goedkoper
   * dan per bedrijf een losse vraag.
   *
   * Oudst bijgewerkt eerst, en een mislukte poging werkt het bedrijf bij. Zo
   * schuift een site die niet te lezen is achteraan in plaats van elke run
   * dezelfde plek te bezetten — anders blokkeren twee kapotte websites voor
   * altijd twee plaatsen in de wachtrij.
   */
  const wachtrij = await db
    .select()
    .from(schema.groeiProspects)
    .leftJoin(
      schema.groeiAnalyses,
      eq(schema.groeiAnalyses.prospectId, schema.groeiProspects.id),
    )
    .where(
      and(
        eq(schema.groeiProspects.ownerUserId, agent.ownerUserId),
        eq(schema.groeiProspects.stap, "gevonden"),
        isNull(schema.groeiAnalyses.id),
        isNotNull(schema.groeiProspects.website),
      ),
    )
    .orderBy(schema.groeiProspects.updatedAt)
    .limit(agent.maxPerRun);

  const bedrijven = wachtrij.map((r) => r.groei_prospects);

  let bekeken = 0;
  let passen = 0;
  let adressen = 0;
  let afgekapt = 0;
  const redenen = new Map<string, number>();

  /**
   * Websites lezen duurt ongelijk lang; één trage server mag de hele run niet
   * over de tijdslimiet van de hosting duwen. Daarom stopt de agent netjes op
   * tijd en pakt hij de rest de volgende keer op.
   */
  const uiterlijk = Date.now() + 200_000;

  for (const p of bedrijven) {
    if (Date.now() > uiterlijk) {
      afgekapt = bedrijven.length - bekeken - [...redenen.values()].reduce((a, b) => a + b, 0);
      break;
    }
    try {
      const uit = await onderzoekProspect(p);
      if (uit.status === "gelukt") {
        bekeken++;
        if (uit.past) passen++;
        if (uit.emailGevonden) adressen++;
        continue;
      }
      redenen.set(uit.reden, (redenen.get(uit.reden) ?? 0) + 1);
      await markeerPoging(p.id);
    } catch (err) {
      const reden = (err instanceof Error ? err.message : "onbekende fout").slice(0, 60);
      redenen.set(reden, (redenen.get(reden) ?? 0) + 1);
      await markeerPoging(p.id);
    }
  }

  const tekst = onderzoeksamenvatting(
    bedrijven.length,
    bekeken,
    passen,
    adressen,
    afgekapt,
    redenen,
  );

  return {
    gevonden: bedrijven.length,
    nieuw: bekeken,
    overgeslagen: bedrijven.length - bekeken,
    samenvatting: tekst,
  };
}

/**
 * Een mislukte poging telt ook als aandacht: door het bedrijf bij te werken
 * schuift het achteraan in de wachtrij in plaats van de volgende run opnieuw
 * vooraan te staan.
 */
async function markeerPoging(prospectId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(schema.groeiProspects)
    .set({ updatedAt: new Date() })
    .where(eq(schema.groeiProspects.id, prospectId));
}

/** Wat de Onderzoeksagent deed, in de taal waarin Henry erover zou vertellen. */
function onderzoeksamenvatting(
  aangeboden: number,
  bekeken: number,
  passen: number,
  adressen: number,
  afgekapt: number,
  redenen: Map<string, number>,
): string {
  if (aangeboden === 0) {
    return "Alle gevonden bedrijven zijn al bekeken. Niets te doen op dit moment.";
  }
  if (bekeken === 0) {
    const top = [...redenen.entries()].sort((a, b) => b[1] - a[1])[0];
    return `${aangeboden} websites geprobeerd, geen enkele gelukt${top ? ` (meestal: ${top[0]})` : ""}.`;
  }

  const mislukt = aangeboden - bekeken;
  const staart = [
    passen > 0
      ? `Bij ${passen} zie ik iets dat ze verder helpt.`
      : "Bij geen van deze bedrijven zie ik echt iets dat ze verder helpt.",
    adressen > 0 ? `Van ${adressen} vond ik een contactadres.` : "",
    mislukt > afgekapt
      ? `${mislukt - afgekapt} website${mislukt - afgekapt === 1 ? " was" : "s waren"} niet te lezen.`
      : "",
    afgekapt > 0 ? `Aan de laatste ${afgekapt} kwam hij niet toe; die pakt hij morgen op.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `${bekeken} website${bekeken === 1 ? "" : "s"} doorgenomen. ${staart}`;
}

/**
 * Voer één agent uit. Kiest de rol, legt de run vast en vertaalt een misgelopen
 * poging naar iets leesbaars — ook als het misgaat blijft er een spoor achter.
 */
export async function draaiAgent(agent: GroeiAgent): Promise<RunResultaat> {
  const db = getDb();
  if (!db) throw new Error("Geen database.");

  const [run] = await db
    .insert(schema.groeiAgentRuns)
    .values({ agentId: agent.id, status: "bezig" })
    .returning({ id: schema.groeiAgentRuns.id });

  try {
    const res = agent.soort === "onderzoeken" ? await onderzoek(agent) : await ontdek(agent);

    await db
      .update(schema.groeiAgentRuns)
      .set({
        status: "klaar",
        klaarAt: new Date(),
        gevonden: res.gevonden,
        nieuw: res.nieuw,
        overgeslagen: res.overgeslagen,
        samenvatting: res.samenvatting,
      })
      .where(eq(schema.groeiAgentRuns.id, run.id));

    await db
      .update(schema.groeiAgents)
      .set({ laatsteRunAt: new Date() })
      .where(eq(schema.groeiAgents.id, agent.id));

    return res;
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
  soort: "ontdekken" | "onderzoeken";
  branche: BrancheSlug | null;
  provincies: string[];
  maxPerRun?: number;
}[] = [
  { naam: "Hondenschool-agent Nederland", soort: "ontdekken", branche: "hondenschool", provincies: [] },
  { naam: "Trimsalon-agent Nederland", soort: "ontdekken", branche: "trimsalon", provincies: [] },
  { naam: "Pension-agent Nederland", soort: "ontdekken", branche: "pension", provincies: [] },
  // Kleinere hap: elk bedrijf kost een paar websiteverzoeken en een analyse.
  { naam: "Onderzoeksagent", soort: "onderzoeken", branche: null, provincies: [], maxPerRun: 10 },
];

/**
 * Zet de standaardagents klaar. Vult aan op naam in plaats van alles-of-niets,
 * zodat een nieuwe rol ook terechtkomt bij iemand die de oude agents al heeft.
 */
export async function zorgVoorAgents(ownerUserId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  const bestaand = new Set(
    (
      await db
        .select({ naam: schema.groeiAgents.naam })
        .from(schema.groeiAgents)
        .where(eq(schema.groeiAgents.ownerUserId, ownerUserId))
    ).map((a) => a.naam),
  );

  const ontbreekt = STANDAARD_AGENTS.filter((a) => !bestaand.has(a.naam));
  if (ontbreekt.length === 0) return 0;

  await db.insert(schema.groeiAgents).values(
    ontbreekt.map((a) => ({
      ownerUserId,
      naam: a.naam,
      soort: a.soort,
      branche: a.branche,
      provincies: a.provincies,
      ...(a.maxPerRun ? { maxPerRun: a.maxPerRun } : {}),
    })),
  );

  return ontbreekt.length;
}
