import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/db/schema";

/**
 * Server-side autorisatie voor beheeracties.
 * Pagina's onder /admin/(portal) worden al bewaakt door de layout
 * (requireAdmin); server actions gebruiken deze helper zelf, omdat
 * actions ook via directe POST bereikbaar zijn.
 */
export async function getAdminActor(): Promise<User | null> {
  const user = await getCurrentUser();
  return user?.role === "SUPER_ADMIN" ? user : null;
}
