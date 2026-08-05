import type { UserRole } from "@/lib/db/schema";

/**
 * Centrale, client-veilige mapping van technische rollen naar leesbare
 * Nederlandse labels en de eigen omgeving per rol. Nergens anders mogen
 * enum-waarden als "SUPER_ADMIN" aan de gebruiker worden getoond.
 *
 * Eén account kan meerdere rollen hebben (klant én partner). Alle helpers
 * hieronder werken daarom op een lijst rollen, niet op één rol.
 */

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: "Beheerder",
  AFFILIATE_PARTNER: "Partner",
  CUSTOMER: "Klant",
};

export const ROLE_HOME: Record<UserRole, { href: string; label: string }> = {
  SUPER_ADMIN: { href: "/admin", label: "Naar beheer" },
  AFFILIATE_PARTNER: { href: "/partner", label: "Naar partneromgeving" },
  CUSTOMER: { href: "/account", label: "Naar mijn omgeving" },
};

/**
 * Volgorde waarin rollen "winnen" bij het kiezen van één bestemming na het
 * inloggen. Wie zowel klant als partner is, landt in de partneromgeving en
 * kan van daaruit naar de klantomgeving.
 */
export const ROLE_PRECEDENCE: readonly UserRole[] = [
  "SUPER_ADMIN",
  "AFFILIATE_PARTNER",
  "CUSTOMER",
] as const;

/** De rol die de standaardbestemming en het hoofdlabel bepaalt. */
export function primaryRole(roles: readonly UserRole[]): UserRole {
  return ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? "CUSTOMER";
}

export function hasRole(roles: readonly UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}

/** Mag deze gebruiker dit interne pad openen? Gebruikt voor terugkeer-URL's. */
export function roleMayAccess(roles: readonly UserRole[], path: string): boolean {
  if (path.startsWith("/admin")) return hasRole(roles, "SUPER_ADMIN");
  if (path.startsWith("/partner")) return hasRole(roles, "AFFILIATE_PARTNER");
  if (path.startsWith("/account")) return hasRole(roles, "CUSTOMER");
  return true; // publieke paden mag iedereen
}

/**
 * De andere omgevingen waar deze persoon ook terechtkan — voor het
 * omgevingswisselaartje in de portalheaders. Leeg bij één rol.
 */
export function otherEnvironments(
  roles: readonly UserRole[],
  current: UserRole,
): { href: string; label: string }[] {
  return ROLE_PRECEDENCE.filter((r) => r !== current && roles.includes(r)).map(
    (r) => ROLE_HOME[r],
  );
}

/**
 * Valideer een terugkeer-URL: alleen interne, relatieve paden — nooit een
 * externe URL of protocol-relatieve link (voorkomt open redirects).
 */
export function safeInternalPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("://") || next.includes("\\")) return null;
  return next;
}
