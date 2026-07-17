import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME, safeInternalPath } from "@/lib/roles";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "Inloggen",
  robots: { index: false, follow: false },
};

/**
 * Eén centrale inlogpagina voor alle rollen. Na inloggen bepaalt de rol
 * server-side de bestemming; een geldige, interne ?next= wordt gerespecteerd
 * mits de rol daar toegang toe heeft.
 */
export default async function InloggenPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role].href);

  return (
    <AuthShell
      titel="Welkom terug bij DogWare"
      ondertitel="Vul je e-mailadres in; je ontvangt een veilige inloglink en een eenmalige code. Zonder wachtwoord."
    >
      <LoginForm next={safeInternalPath(next) ?? undefined} />
    </AuthShell>
  );
}
