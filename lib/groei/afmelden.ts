import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { signValue, verifySignedValue } from "@/lib/auth/crypto";
import { branding } from "@/lib/branding";
import { logGroeiEvent, setStap } from "@/lib/groei";

/**
 * Afmelden.
 *
 * Elke mail die uitgaat draagt een link waarmee de ontvanger in één klik van
 * de lijst af is. Dat is geen extraatje: voor ongevraagde zakelijke post is
 * een afmeldmogelijkheid in élk bericht wettelijk verplicht.
 *
 * De link is ondertekend in plaats van opgeslagen — geen extra kolom, geen
 * tabel die kan gaan afwijken, en de link blijft werken zolang het bedrijf
 * bestaat. Wie geen sleutel heeft kan er ook geen maken.
 */

const PREFIX = "groei-afmelden:";

export function afmeldToken(prospectId: string): string {
  return signValue(`${PREFIX}${prospectId}`);
}

/** Geeft het prospect-id terug, of null bij een ongeldige of vreemde token. */
export function leesAfmeldToken(token: string): string | null {
  const payload = verifySignedValue(token);
  if (!payload?.startsWith(PREFIX)) return null;
  const id = payload.slice(PREFIX.length);
  return id.length >= 32 ? id : null;
}

/** De pagina waar een mens op uitkomt. */
export function afmeldLink(prospectId: string): string {
  return `${branding.siteUrl}/geen-mail/${afmeldToken(prospectId)}`;
}

/**
 * Het adres dat mailprogramma's zelf aanroepen als iemand op hun eigen
 * "afmelden"-knop drukt (RFC 8058). Aparte route, want die krijgt een POST
 * zonder mens erachter.
 */
export function afmeldEenKlikLink(prospectId: string): string {
  return `${branding.siteUrl}/api/geen-mail/${afmeldToken(prospectId)}`;
}

export type Afmelduitkomst =
  | { status: "gelukt"; bedrijfsnaam: string }
  | { status: "al-gedaan"; bedrijfsnaam: string }
  | { status: "onbekend" };

/**
 * Zet dit bedrijf op de uitsluitlijst en haal het uit de reis.
 *
 * Bewust op adres én niet op domein: een collega die zich afmeldt sluit
 * zichzelf uit, niet zijn hele provider. Twee keer afmelden mag; dat levert
 * gewoon hetzelfde antwoord op.
 */
export async function meldAf(token: string): Promise<Afmelduitkomst> {
  const db = getDb();
  const id = leesAfmeldToken(token);
  if (!db || !id) return { status: "onbekend" };

  const [p] = await db
    .select()
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, id))
    .limit(1);
  if (!p) return { status: "onbekend" };

  const adres = p.email?.trim().toLowerCase() ?? null;

  const [bestaat] = adres
    ? await db
        .select({ id: schema.groeiBlokkeerlijst.id })
        .from(schema.groeiBlokkeerlijst)
        .where(eq(schema.groeiBlokkeerlijst.email, adres))
        .limit(1)
    : [];

  if (bestaat) return { status: "al-gedaan", bedrijfsnaam: p.bedrijfsnaam };

  if (adres) {
    await db
      .insert(schema.groeiBlokkeerlijst)
      .values({ email: adres, reden: "zelf afgemeld via de link in de mail" })
      .onConflictDoNothing();
  }

  await logGroeiEvent(p.id, "afgemeld", "Heeft zich afgemeld via de link in de mail");
  // force: dit is geen stap vooruit maar een streep eronder.
  await setStap(p.id, "niet-nu", { force: true, reden: "zelf afgemeld" });

  return { status: "gelukt", bedrijfsnaam: p.bedrijfsnaam };
}
