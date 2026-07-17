import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand";

export const metadata: Metadata = {
  title: "Mijn DogWare",
  robots: { index: false, follow: false },
};

/**
 * Klantomgeving (rol CUSTOMER). Vooralsnog een verzorgde landingspagina na
 * de passwordless demo-login; het volledige klantportaal (voorbeeldwebsite,
 * beheeromgeving, feedback) wordt in een volgende fase ingericht.
 */
export default async function AccountPage() {
  const user = await requireRole("CUSTOMER", "/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-16 text-center">
      <BrandMark size={52} className="h-13 w-13" />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">
        Welkom, {user.naam.split(" ")[0]}
      </h1>
      <p className="mt-3 max-w-md text-pretty text-ink-500">
        Je bent veilig ingelogd. Je persoonlijke voorbeeldwebsite en
        beheeromgeving worden voor je klaargezet — je ontvangt de directe links
        in je demo-mail. Vragen? Reageer gewoon op die mail.
      </p>
      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="rounded-full px-5 py-2.5 text-[13px] font-semibold text-ink-300 ring-1 ring-ink/10 transition hover:text-ink-500 hover:ring-ink/25"
        >
          Uitloggen
        </button>
      </form>
    </main>
  );
}
