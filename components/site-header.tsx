import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME, ROLE_LABEL, primaryRole } from "@/lib/roles";
import { HeaderBar, type HeaderUser } from "@/components/header-bar";

/**
 * Publieke header. Server-component: laadt de sessie server-side zodat de
 * loginstatus meteen correct is (geen flits van de verkeerde navigatie en
 * geen hydration-mismatch). De visuele/interactieve kant staat in HeaderBar.
 */
export async function SiteHeader() {
  const current = await getCurrentUser();
  // Bij meerdere rollen (bijv. klant én partner) telt de zwaarstwegende rol.
  const hoofdrol = current ? primaryRole(current.roles) : null;
  const user: HeaderUser | null =
    current && hoofdrol
      ? {
          naam: current.naam,
          roleLabel: ROLE_LABEL[hoofdrol],
          homeHref: ROLE_HOME[hoofdrol].href,
          homeLabel: ROLE_HOME[hoofdrol].label,
        }
      : null;

  return <HeaderBar user={user} loginHref="/inloggen" />;
}
