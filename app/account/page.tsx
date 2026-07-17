import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { JOURNEY_STAGES } from "@/lib/db/schema";
import { STAGE_KLANT_LABEL, stepStateFor } from "@/lib/journey-stages";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Mijn DogWare",
  robots: { index: false, follow: false },
};

/**
 * Klantportaal (rol CUSTOMER): één rustige journey, geen dashboard.
 * Bij de huidige stap staat maximaal één duidelijke actie.
 */
export default async function AccountPage() {
  const user = await requireRole("CUSTOMER", "/");
  const db = getDb();

  const lead = db
    ? (
        await db
          .select()
          .from(schema.leads)
          .where(eq(schema.leads.demoCustomerUserId, user.id))
          .orderBy(desc(schema.leads.createdAt))
          .limit(1)
      )[0]
    : undefined;

  const current = lead?.stage ?? "aangevraagd";
  const websiteUrl = lead?.demoDomain
    ? lead.demoDomain.startsWith("http")
      ? lead.demoDomain
      : `https://${lead.demoDomain}`
    : undefined;
  const portaalUrl = lead?.demoPortalUrl;

  // Eén actie per stap, alleen bij de huidige stap
  const actie: Record<string, { label: string; href: string } | undefined> = {
    "demo-verstuurd": websiteUrl ? { label: "Bekijk jouw website", href: websiteUrl } : undefined,
    ingelogd: websiteUrl ? { label: "Open jouw website", href: websiteUrl } : undefined,
    bekeken: portaalUrl ? { label: "Open het demoportaal", href: portaalUrl } : undefined,
  };

  return (
    <main className="min-h-screen bg-cream px-5 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center justify-between">
          <BrandMark size={40} className="h-10 w-10" />
          <form action={logout}>
            <button type="submit" className="text-[13px] font-semibold text-ink-300 hover:text-ink-500">
              Uitloggen
            </button>
          </form>
        </div>

        <h1 className="mt-8 text-2xl font-extrabold tracking-tight text-ink">
          Welkom, {user.naam.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {lead
            ? `Dit is de voortgang van jouw persoonlijke voorbeeld${lead.bedrijfsnaam ? ` voor ${lead.bedrijfsnaam}` : ""}.`
            : "Je bent veilig ingelogd. Je voorbeeld wordt voorbereid."}
        </p>

        {/* Eenvoudige verticale journey */}
        <ol className="mt-8">
          {JOURNEY_STAGES.map((stage, i) => {
            const state = stepStateFor(stage, current);
            const last = i === JOURNEY_STAGES.length - 1;
            const stepActie = state === "current" ? actie[stage] : undefined;
            return (
              <li key={stage} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      state === "done" && "bg-sage",
                      state === "current" && "bg-[#2f6bed] shadow-[0_0_0_4px_rgba(47,107,237,0.15)]",
                      state === "todo" && "bg-cream-200",
                    )}
                  >
                    {state === "done" && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none">
                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {state === "current" && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  {!last && (
                    <span className={cn("w-px flex-1", state === "done" ? "bg-sage/40" : "bg-cream-200")} style={{ minHeight: "1.75rem" }} />
                  )}
                </div>
                <div className="pb-6">
                  <p
                    className={cn(
                      "text-[15px]",
                      state === "current" && "font-extrabold text-ink",
                      state === "done" && "font-semibold text-ink-500",
                      state === "todo" && "text-ink-300",
                    )}
                  >
                    {STAGE_KLANT_LABEL[stage]}
                  </p>
                  {stepActie && (
                    <a
                      href={stepActie.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-full bg-brand px-5 py-2 text-[13px] font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-brand-600"
                    >
                      {stepActie.label}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-[13px] text-ink-400">
          Vragen of feedback? Reageer gewoon op de mail die je van ons kreeg —
          je krijgt altijd een hondenmens aan de lijn.
        </p>
      </div>
    </main>
  );
}
