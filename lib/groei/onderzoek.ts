import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { analyseerWebsite } from "@/lib/groei/ai";
import { leesWebsite, kiesContactadres } from "@/lib/groei/bronnen/website";
import { isGeblokkeerd, logGroeiEvent, setStap } from "@/lib/groei";
import type { GroeiGrondslag, GroeiProspect } from "@/lib/db/schema";

/**
 * Het onderzoek: van een naam op de kaart naar een bedrijf waar je iets zinnigs
 * over kunt zeggen.
 *
 * Eén doorloop levert drie dingen op die allemaal nodig zijn voordat er ooit
 * iets verstuurd mag worden:
 *  1. een adres waar een mens leest;
 *  2. een grondslag — mag dit bedrijf überhaupt benaderd worden;
 *  3. concrete details van hún site, zodat het bericht geen sjabloon is.
 *
 * Dit is bewust één functie en niet drie: ze lezen dezelfde pagina's, en die
 * twee keer ophalen is onnodige belasting van andermans server.
 */

/** Welke rechtsvormen een rechtspersoon zijn — en dus benaderd mogen worden. */
const RECHTSPERSOON = new Set(["bv", "nv", "vof", "stichting", "vereniging", "cooperatie"]);

export type Onderzoeksuitkomst =
  | { status: "gelukt"; detailCount: number; past: boolean; emailGevonden: boolean }
  | { status: "overgeslagen"; reden: string }
  | { status: "mislukt"; reden: string };

/**
 * Onderzoek één bedrijf. Schrijft zelf weg wat het vindt en zet de stap op
 * "bekeken"; de aanroeper hoeft alleen de uitkomst te tonen.
 */
export async function onderzoekProspect(
  p: GroeiProspect,
): Promise<Onderzoeksuitkomst> {
  const db = getDb();
  if (!db) return { status: "mislukt", reden: "geen database" };

  if (!p.website) {
    return { status: "overgeslagen", reden: "geen website" };
  }

  const lezing = await leesWebsite(p.website);
  if (!lezing) {
    return { status: "mislukt", reden: "site niet te lezen" };
  }
  if (lezing.tekst.length < 200) {
    return { status: "overgeslagen", reden: "te weinig tekst op de site" };
  }

  /* -- 1. contactgegevens -------------------------------------------------- */

  const domein = (() => {
    try {
      return new URL(p.website).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  const gevondenAdres = kiesContactadres(lezing.emails, domein);
  const nieuwAdres =
    !p.email && gevondenAdres && !(await isGeblokkeerd(gevondenAdres))
      ? gevondenAdres
      : null;

  /* -- 2. grondslag -------------------------------------------------------- */

  // Alleen ophogen, nooit verlagen: heeft iemand toestemming gegeven of is er
  // een klantrelatie, dan gaat een gevonden rechtsvorm daar niet overheen.
  const magOphogen = p.grondslag === "onbekend";
  const rv = lezing.rechtsvorm;
  const nieuweGrondslag: GroeiGrondslag | null =
    magOphogen && rv && RECHTSPERSOON.has(rv.vorm) ? "rechtspersoon" : null;

  const herkomst: Record<string, string> = { ...p.herkomst };
  if (nieuwAdres) {
    herkomst.email = `van hun eigen website (${p.website})`;
  }
  if (nieuweGrondslag && rv) {
    herkomst.grondslag = `rechtsvorm "${rv.vorm}" aangetroffen op ${rv.waar}: "${rv.bewijs}"`;
  }

  const socials =
    Object.keys(lezing.socials).length > 0
      ? { ...p.socials, ...lezing.socials }
      : null;

  // Hun eigen deelfoto en accentkleur, zodat het voorstel naar hén voelt.
  const stijl =
    Object.keys(lezing.stijl).length > 0 ? { ...p.stijl, ...lezing.stijl } : null;

  if (nieuwAdres || nieuweGrondslag || socials || stijl) {
    await db
      .update(schema.groeiProspects)
      .set({
        ...(nieuwAdres ? { email: nieuwAdres } : {}),
        ...(nieuweGrondslag ? { grondslag: nieuweGrondslag } : {}),
        ...(socials ? { socials } : {}),
        ...(stijl ? { stijl } : {}),
        herkomst,
        updatedAt: new Date(),
      })
      .where(eq(schema.groeiProspects.id, p.id));
  }

  if (nieuwAdres) {
    await logGroeiEvent(p.id, "contact", `Contactadres gevonden: ${nieuwAdres}`, {
      bron: p.website,
    });
  }
  if (nieuweGrondslag && rv) {
    await logGroeiEvent(
      p.id,
      "grondslag",
      `Rechtspersoon — "${rv.vorm.toUpperCase()}" staat op hun eigen site`,
      { bewijs: rv.bewijs, waar: rv.waar },
    );
  }

  /* -- 3. analyse ---------------------------------------------------------- */

  const analyse = await analyseerWebsite({
    bedrijfsnaam: p.bedrijfsnaam,
    branche: p.branche,
    website: p.website,
    paginaTekst: lezing.tekst,
  });

  await db.insert(schema.groeiAnalyses).values({
    prospectId: p.id,
    sterk: analyse.sterk,
    kansen: analyse.kansen,
    details: analyse.details,
    past: analyse.past,
    passendheidUitleg: analyse.passendheidUitleg,
    model: analyse.model,
  });

  await logGroeiEvent(
    p.id,
    "bekeken",
    analyse.past
      ? `Website bekeken — ${analyse.details.length} concrete details gevonden`
      : "Website bekeken — DogWare voegt hier waarschijnlijk weinig toe",
    { paginas: lezing.paginas.map((x) => x.url) },
  );
  await setStap(p.id, "bekeken");

  return {
    status: "gelukt",
    detailCount: analyse.details.length,
    past: analyse.past,
    emailGevonden: Boolean(nieuwAdres),
  };
}

/** De laatste analyse van een bedrijf, als die er is. */
export async function laatsteAnalyse(prospectId: string) {
  const db = getDb();
  if (!db) return null;
  const [rij] = await db
    .select()
    .from(schema.groeiAnalyses)
    .where(eq(schema.groeiAnalyses.prospectId, prospectId))
    .orderBy(desc(schema.groeiAnalyses.createdAt))
    .limit(1);
  return rij ?? null;
}
