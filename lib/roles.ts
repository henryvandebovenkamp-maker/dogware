import type { UserRole } from "@/lib/db/schema";

/**
 * Centrale, client-veilige mapping van technische rollen naar leesbare
 * Nederlandse labels en de eigen omgeving per rol. Nergens anders mogen
 * enum-waarden als "SUPER_ADMIN" aan de gebruiker worden getoond.
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

/** Mag deze rol dit interne pad openen? Gebruikt voor veilige terugkeer-URL's. */
export function roleMayAccess(role: UserRole, path: string): boolean {
  if (path.startsWith("/admin")) return role === "SUPER_ADMIN";
  if (path.startsWith("/partner")) return role === "AFFILIATE_PARTNER";
  if (path.startsWith("/account")) return role === "CUSTOMER";
  return true; // publieke paden mag iedereen
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
