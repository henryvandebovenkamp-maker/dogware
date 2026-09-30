import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrajectShell } from "@/components/commerce/customer-view";
import { isDirectJourney } from "@/lib/journey-variant";
import { conceptAlsVerstuurd, voorstelVoorKlant } from "@/lib/klantweergave";
import { readPricing } from "@/lib/proposals";
import { resolveProef } from "@/lib/proef";
import { ProefNietMeerConcept } from "./niet-meer-concept";

export const metadata: Metadata = {
  title: "Proefweergave",
  robots: { index: false, follow: false },
};

/** Altijd vers en nooit gecachet: een proef volgt het actuele concept. */
export const dynamic = "force-dynamic";

/**
 * De proefweergave van een concept: exact de klantomgeving zoals die er na
 * definitief versturen uitziet, maar zonder dat er iets gebeurt.
 *
 * Alleen lezen. Geen "bekeken"-registratie, geen tijdlijn, geen betaalschema,
 * geen overeenkomst. De klantcomponenten krijgen een lege sleutel en de
 * proefvlag, dus akkoord, tekenen en betalen doen niets — en zouden ook bij
 * de server geweigerd worden.
 */
export default async function ProefPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveProef(token);
  if (!ctx) notFound();
  if (ctx.soort === "niet-meer-concept") return <ProefNietMeerConcept />;

  const { lead, commerce } = ctx;
  const direct = isDirectJourney(lead.journeyVariant);
  const proposal = conceptAlsVerstuurd(ctx.proposal, commerce);
  const snap = readPricing(proposal, commerce);

  return (
    <TrajectShell
      voornaam={lead.naam.split(" ")[0]}
      bedrijfsnaam={lead.bedrijfsnaam}
      stage={direct ? "overeenkomst" : "voorstel-verstuurd"}
      variant={lead.journeyVariant}
      documenten={[]}
      tijdlijn={[]}
      voorstel={voorstelVoorKlant(proposal, snap, {
        direct,
        token: "",
        pad: `/traject/proef/${token}`,
        proef: true,
      })}
      status={{
        getekend: false,
        getekendOp: null,
        aanbetalingBetaald: false,
        opleveringKlaar: false,
        volledigBetaald: false,
        live: false,
        openstaand: "€ 0,00",
        mollieKlaar: false,
        mandaatActief: false,
        heeftAbonnement: commerce.monthlyCents > 0,
      }}
    />
  );
}
