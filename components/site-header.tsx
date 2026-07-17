import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/roles";
import { HeaderBar, type HeaderUser } from "@/components/header-bar";

/**
 * Publieke header. Server-component: laadt de sessie server-side zodat de
 * loginstatus meteen correct is (geen flits van de verkeerde navigatie en
 * geen hydration-mismatch). De visuele/interactieve kant staat in HeaderBar.
 */
export async function SiteHeader() {
  const current = await getCurrentUser();
  const user: HeaderUser | null = current
    ? {
        naam: current.naam,
        roleLabel: ROLE_LABEL[current.role],
        homeHref: ROLE_HOME[current.role].href,
        homeLabel: ROLE_HOME[current.role].label,
      }
    : null;

  return <HeaderBar user={user} loginHref="/inloggen" />;
}
