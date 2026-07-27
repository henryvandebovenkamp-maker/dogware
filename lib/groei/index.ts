import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gte, isNotNull, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { GroeiStap } from "@/lib/db/schema";
import { GRONDSLAG_META, STAP_META, stapIndex } from "@/lib/groei/stappen";

export { STAP_META, GRONDSLAG_META };

/**
 * Groei-motor. Alles wat verstuurd wordt gaat hier langs, zodat de
 * uitgangspunten niet per scherm opnieuw bedacht hoeven te worden.
 */

/**
 * Harde bovengrens per dag. Bewust een constante en geen instelling: een
 * schermpje waarin dit omhoog kan, maakt hier alsnog een massamailer van.
 * Kwaliteit boven kwantiteit is dan een voornemen in plaats van een eigenschap.
 */
export const MAX_PER_DAG = 10;

/** Onraadbare sleutel voor de voorstelpagina. */
export function voorstelToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Log een gebeurtenis op de tijdlijn van een bedrijf. */
export async function logGroeiEvent(
  prospectId: string,
  kind: string,
  label: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.groeiEvents).values({ prospectId, kind, label, meta });
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "groei.event_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
  }
}

/** Zet de stap. Gaat standaard alleen vooruit; `force` voor handmatige correctie. */
export async function setStap(
  prospectId: string,
  stap: GroeiStap,
  opts: { force?: boolean; reden?: string } = {},
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const [huidig] = await db
    .select({ stap: schema.groeiProspects.stap })
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, prospectId))
    .limit(1);
  if (!huidig || huidig.stap === stap) return;
  if (!opts.force && stapIndex(stap) <= stapIndex(huidig.stap)) return;

  await db
    .update(schema.groeiProspects)
    .set({ stap, updatedAt: new Date() })
    .where(eq(schema.groeiProspects.id, prospectId));
  await logGroeiEvent(
    prospectId,
    "stap",
    `${STAP_META[stap].label}${opts.reden ? ` — ${opts.reden}` : ""}`,
    { van: huidig.stap, naar: stap, handmatig: Boolean(opts.force) },
  );
}

/** Staat dit adres of domein op de blokkeerlijst? */
export async function isGeblokkeerd(email: string | null): Promise<boolean> {
  const db = getDb();
  if (!db || !email) return false;
  const adres = email.trim().toLowerCase();
  const domein = adres.split("@")[1] ?? "";
  const [rij] = await db
    .select({ id: schema.groeiBlokkeerlijst.id })
    .from(schema.groeiBlokkeerlijst)
    .where(
      or(
        eq(schema.groeiBlokkeerlijst.email, adres),
        domein ? eq(schema.groeiBlokkeerlijst.domein, domein) : undefined,
      ),
    )
    .limit(1);
  return Boolean(rij);
}

/** Hoeveel berichten gingen er vandaag al uit? */
export async function verstuurdVandaag(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const begin = new Date();
  begin.setHours(0, 0, 0, 0);
  const [rij] = await db
    .select({ n: count() })
    .from(schema.groeiBerichten)
    .where(
      and(
        isNotNull(schema.groeiBerichten.verstuurdAt),
        gte(schema.groeiBerichten.verstuurdAt, begin),
      ),
    );
  return rij?.n ?? 0;
}

export type Verzendoordeel =
  | { mag: true }
  | { mag: false; reden: string; uitleg: string };

/**
 * Het verzendslot: mag dit bericht de deur uit?
 *
 * De laatste voorwaarde is de belangrijkste en de reden dat deze module
 * bestaat. Een bericht mag alleen weg als er minstens één concreet, op hun
 * eigen website waargenomen detail in staat. Dat is wat maakt dat iemand
 * denkt "hier heeft echt iemand meegedacht" — en zonder die grendel schrijft
 * een taalmodel binnen een week weer algemeenheden.
 */
export async function magVerzenden(prospectId: string): Promise<Verzendoordeel> {
  const db = getDb();
  if (!db) return { mag: false, reden: "Geen database", uitleg: "Niet geconfigureerd." };

  const [p] = await db
    .select()
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, prospectId))
    .limit(1);
  if (!p) return { mag: false, reden: "Onbekend bedrijf", uitleg: "Niet gevonden." };

  if (!p.email) {
    return {
      mag: false,
      reden: "Geen e-mailadres",
      uitleg: "Vul eerst een adres in waar dit bericht naartoe kan.",
    };
  }

  if (!GRONDSLAG_META[p.grondslag].magBenaderen) {
    return {
      mag: false,
      reden: "Grondslag niet vastgesteld",
      uitleg: GRONDSLAG_META[p.grondslag].uitleg,
    };
  }

  if (await isGeblokkeerd(p.email)) {
    return {
      mag: false,
      reden: "Staat op de blokkeerlijst",
      uitleg: "Dit bedrijf heeft aangegeven niet benaderd te willen worden.",
    };
  }

  const vandaag = await verstuurdVandaag();
  if (vandaag >= MAX_PER_DAG) {
    return {
      mag: false,
      reden: `Dagmaximum van ${MAX_PER_DAG} bereikt`,
      uitleg:
        "Morgen weer. Deze grens zit bewust vast in de code: liever tien goede berichten dan honderd algemene.",
    };
  }

  const [analyse] = await db
    .select({ details: schema.groeiAnalyses.details, past: schema.groeiAnalyses.past })
    .from(schema.groeiAnalyses)
    .where(eq(schema.groeiAnalyses.prospectId, prospectId))
    .orderBy(desc(schema.groeiAnalyses.createdAt))
    .limit(1);

  if (!analyse) {
    return {
      mag: false,
      reden: "Nog niet bekeken",
      uitleg: "Laat eerst hun website doornemen, anders valt er niets persoonlijks te zeggen.",
    };
  }

  if (!analyse.past) {
    return {
      mag: false,
      reden: "Past waarschijnlijk niet",
      uitleg:
        "De analyse concludeert dat DogWare hier weinig toevoegt. Overslaan mag; forceren kan met een handmatige correctie.",
    };
  }

  if (analyse.details.length === 0) {
    return {
      mag: false,
      reden: "Geen concreet detail gevonden",
      uitleg:
        "Er staat niets in dit bericht dat aantoonbaar van hún website komt. Zonder zo'n detail is het een standaardmail, en dat is precies wat we niet willen sturen.",
    };
  }

  return { mag: true };
}
