import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "Inloggen — Beheer",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "SUPER_ADMIN") redirect("/admin");
  if (user?.role === "AFFILIATE_PARTNER") redirect("/partner");

  return (
    <AuthShell
      titel="DogWare Beheer"
      ondertitel="Log in met je beheerdersaccount."
    >
      <LoginForm />
    </AuthShell>
  );
}
