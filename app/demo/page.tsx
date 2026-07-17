import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "@/components/brand";
import { DemoExperience } from "@/components/demo/experience";
import { PartnerWelcome } from "@/components/demo/partner-welcome";
import {
  findPartnerByCode,
  getValidAttribution,
  recordReferralVisit,
} from "@/lib/referral";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Bouw jouw DogWare",
  description:
    "Bouw in een paar minuten jouw eigen DogWare-omgeving en ontvang binnen 24 uur een kosteloos voorbeeld. Geen offerte — je zit nergens aan vast.",
};

/**
 * Wie via een partnerlink binnenkomt — /demo?ref=CODE of via /p/CODE —
 * wordt server-side gekoppeld en krijgt een warm welkom met de voordelen
 * die de partner voor hem heeft klaarstaan.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  // 1. Verse referral via ?ref= registreren (bots/dubbel worden gefilterd)
  if (ref) {
    const partner = await findPartnerByCode(ref);
    if (partner && (partner.status === "ACTIVE" || partner.status === "PAUSED")) {
      const h = await headers();
      await recordReferralVisit(partner, {
        landingPage: "/demo",
        userAgent: h.get("user-agent"),
      });
    }
  }

  // 2. Actieve koppeling ophalen (ook na /p/CODE-redirect via de cookie)
  let welcomePerks: string[] | null = null;
  const attribution = await getValidAttribution();
  if (attribution) {
    const db = getDb();
    if (db) {
      const [partner] = await db
        .select({ perks: schema.partners.newCustomerPerks })
        .from(schema.partners)
        .where(eq(schema.partners.id, attribution.partnerId))
        .limit(1);
      if (partner) welcomePerks = partner.perks;
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
        {welcomePerks && <PartnerWelcome perks={welcomePerks} />}
        <DemoExperience />
      </main>
    </div>
  );
}
