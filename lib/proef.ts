import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Commerce, Lead, Proposal } from "@/lib/db/schema";
import { signValue, verifySignedValue } from "@/lib/auth/crypto";
import { branding } from "@/lib/branding";

/**
 * De proefweergave van een concept-voorstel of -opdrachtbevestiging.
 *
 * Henry krijgt een proefmail met een knop naar deze weergave, zodat hij ziet
 * wat de klant straks ziet — vóór er iets definitief verstuurd is.
 *
 * De link bevat een ondertekend token (HMAC-SHA256 over AUTH_SECRET, dezelfde
 * ondertekening als de rest van DogWare) met daarin één concept en een
 * vervaltijd. Niet te raden, niet aan te passen, en na PROEF_GELDIG_UREN
 * waardeloos. Een queryparameter als "?preview=true" geeft nergens toegang:
 * het token ís de toegang, en het werkt alleen op /traject/proef/….
 *
 * Het token is bewust GEEN portaalsleutel. De proefweergave geeft de
 * klantcomponenten een lege sleutel mee, dus elke klantactie (akkoord,
 * tekenen, betalen) wordt door de server al bij de sleutelcontrole
 * geweigerd — ook als iemand de uitgeschakelde knoppen omzeilt.
 *
 * Alles in dit bestand leest alleen. Er wordt niets geregistreerd, niets
 * aangemaakt en niets op de tijdlijn gezet.
 */

export const PROEF_GELDIG_UREN = 72;

/** Eigen voorvoegsel: een ander ondertekend DogWare-token is hier nooit geldig, en andersom. */
const VOORVOEGSEL = "dw-proef:v1:";

type ProefInhoud = { p: string; c: string; exp: number };

export function maakProefToken(
  proposal: Pick<Proposal, "id" | "commerceId">,
  nu: Date = new Date(),
): { token: string; verlooptOp: Date } {
  const verlooptOp = new Date(nu.getTime() + PROEF_GELDIG_UREN * 3_600_000);
  const inhoud: ProefInhoud = { p: proposal.id, c: proposal.commerceId, exp: verlooptOp.getTime() };
  return { token: signValue(`${VOORVOEGSEL}${JSON.stringify(inhoud)}`), verlooptOp };
}

/** Controleert handtekening, voorvoegsel en vervaltijd. Null bij elke twijfel. */
export function leesProefToken(token: string, nu: Date = new Date()): ProefInhoud | null {
  if (!token || token.length > 512) return null;
  const payload = verifySignedValue(token);
  if (!payload?.startsWith(VOORVOEGSEL)) return null;
  try {
    const inhoud = JSON.parse(payload.slice(VOORVOEGSEL.length)) as ProefInhoud;
    if (typeof inhoud.p !== "string" || typeof inhoud.c !== "string" || typeof inhoud.exp !== "number") {
      return null;
    }
    if (nu.getTime() > inhoud.exp) return null;
    return inhoud;
  } catch {
    return null;
  }
}

export function proefUrl(token: string, pad: "" | "/overeenkomst" = ""): string {
  return `${branding.siteUrl}/traject/proef/${token}${pad}`;
}

export type ProefContext =
  | { soort: "concept"; lead: Lead; commerce: Commerce; proposal: Proposal; verlooptOp: Date }
  /** Het concept bestaat niet meer als concept: het is verstuurd of vervangen. */
  | { soort: "niet-meer-concept" };

/**
 * Het concept achter een proeftoken. Alleen SELECTs. Het voorstel moet bij
 * precies de afspraak uit het token horen (geen verwisselen tussen klanten).
 */
export async function resolveProef(token: string, nu: Date = new Date()): Promise<ProefContext | null> {
  const inhoud = leesProefToken(token, nu);
  if (!inhoud) return null;
  const db = getDb();
  if (!db) return null;

  const [proposal] = await db
    .select()
    .from(schema.proposals)
    .where(and(eq(schema.proposals.id, inhoud.p), eq(schema.proposals.commerceId, inhoud.c)))
    .limit(1);
  if (!proposal) return null;
  if (proposal.status !== "DRAFT") return { soort: "niet-meer-concept" };

  const [commerce] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, inhoud.c)).limit(1);
  if (!commerce) return null;
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, commerce.leadId)).limit(1);
  if (!lead) return null;

  return { soort: "concept", lead, commerce, proposal, verlooptOp: new Date(inhoud.exp) };
}
