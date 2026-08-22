import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Commerce, Lead } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { branding } from "@/lib/branding";

/**
 * Toegang tot de persoonlijke klantomgeving (/traject/[token]).
 *
 * De sleutel is 32 willekeurige bytes en zit in de link die de klant per mail
 * krijgt — hetzelfde model als het bestaande Groei-voorstel in DogWare en als
 * OneDaySite. Bewust géén verplichte login: het moet voelen alsof DogWare
 * iemand persoonlijk begeleidt, niet als een SaaS-portaal.
 *
 * De sleutel wordt niet bij elke herinnering ververst. Dat is een bewuste
 * keuze: anders sterft de link uit de eerste mail zodra er een reminder
 * uitgaat, en zit de klant met een dode knop. Roteren kan alleen expliciet
 * door de beheerder.
 *
 * Extra beveiliging bovenop de sleutel:
 *   - is er iemand ingelogd die NIET de klant achter deze aanvraag is, dan
 *     wordt de toegang geweigerd (een gedeelde link in een verkeerde inbox
 *     opent niet zomaar bij een andere klant);
 *   - elke handeling (accepteren, tekenen, betalen) legt een IP-hash en
 *     user-agent vast.
 */

export type PortalContext = {
  lead: Lead;
  commerce: Commerce;
};

/** Nieuwe, onraadbare sleutel. */
export function newPortalToken(): string {
  return randomBytes(32).toString("base64url");
}

/** De volledige link naar de klantomgeving. */
export function portalUrl(token: string, pad: "" | "/overeenkomst" | "/betaald" = ""): string {
  return `${branding.siteUrl}/traject/${token}${pad}`;
}

/** Constante-tijd-vergelijking, zodat de sleutel niet uit te timen is. */
function tokenEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Zoekt de aanvraag bij een sleutel en controleert dat degene die kijkt er ook
 * bij mag. Geeft null bij elke twijfel — nooit een gedeeltelijk resultaat.
 */
export async function resolvePortal(token: string): Promise<PortalContext | null> {
  const db = getDb();
  if (!db) return null;
  if (!token || token.length < 32 || token.length > 128) return null;

  const [commerce] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.portalToken, token))
    .limit(1);
  if (!commerce?.portalToken) return null;
  // Gelijkheid nog eens expliciet en in constante tijd bevestigen.
  if (!tokenEquals(commerce.portalToken, token)) return null;

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, commerce.leadId))
    .limit(1);
  if (!lead) return null;

  /*
   * Zit er iemand ingelogd die niet bij deze aanvraag hoort? Dan weigeren we,
   * ook al klopt de sleutel. Een beheerder mag wél meekijken — die moet kunnen
   * controleren wat de klant ziet.
   */
  const user = await getCurrentUser();
  if (user && !user.roles.includes("SUPER_ADMIN")) {
    const isEigenaar =
      lead.demoCustomerUserId === user.id ||
      user.email.toLowerCase() === lead.email.toLowerCase() ||
      user.email.toLowerCase() === (lead.demoLoginEmail ?? "").toLowerCase();
    if (!isEigenaar) return null;
  }

  return { lead, commerce };
}

/** Auditgegevens van de huidige bezoeker: nooit het kale IP opslaan. */
export async function requestFingerprint(): Promise<{
  ipHash: string;
  userAgent: string;
}> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "onbekend";
  return {
    ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 32),
    userAgent: (h.get("user-agent") ?? "onbekend").slice(0, 300),
  };
}
