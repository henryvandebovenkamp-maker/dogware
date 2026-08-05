import "server-only";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

/**
 * Server-side autorisatie voor beheeracties.
 * Pagina's onder /admin/(portal) worden al bewaakt door de layout
 * (requireAdmin); server actions gebruiken deze helper zelf, omdat
 * actions ook via directe POST bereikbaar zijn.
 */
export async function getAdminActor(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user?.roles.includes("SUPER_ADMIN") ? user : null;
}
