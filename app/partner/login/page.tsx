import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "Inloggen — Partnerprogramma",
  robots: { index: false, follow: false },
};

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ melding?: string }>;
}) {
  const { melding } = await searchParams;
  const user = await getCurrentUser();
  if (user?.role === "AFFILIATE_PARTNER") redirect("/partner");
  if (user?.role === "SUPER_ADMIN") redirect("/admin");

  return (
    <AuthShell
      titel="DogWare Partnerprogramma"
      ondertitel="Log in om je persoonlijke link en resultaten te bekijken."
    >
      {melding === "link-verlopen" && (
        <p className="mb-4 rounded-xl bg-brand-100 px-4 py-3 text-[13px] font-semibold text-brand-600">
          Die inloglink is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
