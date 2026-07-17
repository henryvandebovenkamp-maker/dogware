import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Logo } from "@/components/brand";
import { DemoExperience } from "@/components/demo/experience";
import { getValidAttribution } from "@/lib/referral";
import { REFERRAL_BENEFITS } from "@/lib/branding";
import { getDb, schema } from "@/lib/db";

export const metadata: Metadata = {
  title: "Bouw jouw DogWare",
  description:
    "Bouw in een paar minuten jouw eigen DogWare-omgeving en ontvang binnen 24 uur een kosteloos voorbeeld. Geen offerte — je zit nergens aan vast.",
};

/**
 * Wie via een partnerlink binnenkomt — /demo?ref=CODE of via /p/CODE —
 * wordt server-side gekoppeld en krijgt een warm welkom met de voordelen
 * die de partner voor hem heeft klaarstaan.
 *
 * Registreren van de klik (cookie zetten) mag alleen in een Route Handler,
 * dus ?ref= stuurt eerst even door naar /p/CODE — dat registreert de klik en
 * stuurt terug naar /demo. Vanaf hier lezen we alleen nog de koppeling.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (ref) {
    redirect(`/p/${encodeURIComponent(ref)}`);
  }

  // Actieve koppeling ophalen (via de cookie die /p/CODE heeft gezet).
  // Naam + voordelen gaan als prop mee de centrale demo-flow in, zodat de
  // ervaring identiek is aan een normale aanvraag — alleen met een
  // persoonlijke introductie bovenaan.
  let partnerIntro: {
    name: string | null;
    firstName: string | null;
    avatarUrl: string | null;
    perks: string[];
  } | null = null;
  const attribution = await getValidAttribution();
  if (attribution) {
    const db = getDb();
    if (db) {
      const rows = await db
        .select({
          perks: schema.partners.newCustomerPerks,
          voornaam: schema.partners.voornaam,
          achternaam: schema.partners.achternaam,
          bedrijfsnaam: schema.partners.bedrijfsnaam,
          avatarUrl: schema.partners.avatarUrl,
          naam: schema.users.naam,
        })
        .from(schema.partners)
        .innerJoin(schema.users, eq(schema.partners.userId, schema.users.id))
        .where(eq(schema.partners.id, attribution.partnerId))
        .limit(1);
      const p = rows[0];
      if (p) {
        const volledigeNaam =
          [p.voornaam, p.achternaam].filter(Boolean).join(" ").trim() || null;
        partnerIntro = {
          // Weergavenaam: bedrijfsnaam als die er is, anders de persoonsnaam.
          name: p.bedrijfsnaam ?? volledigeNaam ?? p.naam ?? null,
          firstName: p.voornaam ?? p.naam?.split(" ")[0] ?? null,
          avatarUrl: p.avatarUrl ?? null,
          // De vaste DogWare-voordelen, tenzij de partner eigen tekst instelde.
          perks: p.perks.length > 0 ? p.perks : [...REFERRAL_BENEFITS],
        };
      }
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[480px] w-[640px] rounded-full bg-brand-50 blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[520px] rounded-full bg-sage-100/50 blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-7 sm:px-8">
        <Link href="/" aria-label="Terug naar de homepage">
          <Logo />
        </Link>
        <Link
          href="/"
          className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-500"
        >
          terug naar de site
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <DemoExperience
          uploadEnabled={Boolean(process.env.UPLOADTHING_TOKEN)}
          partner={partnerIntro}
        />
      </main>
    </div>
  );
}
