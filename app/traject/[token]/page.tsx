import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveProposal, isExpired, pricingLabels, readPricing } from "@/lib/proposals";
import { getCurrentAgreement, isSigned } from "@/lib/agreements";
import { paidTotal } from "@/lib/commerce";
import { listDocuments } from "@/lib/documents";
import { isInvoiceType } from "@/lib/db/schema";
import { getTimeline } from "@/lib/journey";
import { computeOutstanding, euroFromCents } from "@/lib/money";
import { isMollieConfigured } from "@/lib/mollie";
import { resolvePortal } from "@/lib/portal-access";
import { trackProposalViewed } from "@/lib/proposals";
import { TrajectShell } from "@/components/commerce/customer-view";

export const metadata: Metadata = {
  title: "Jouw nieuwe website met DogWare",
  robots: { index: false, follow: false },
};

/**
 * De persoonlijke klantomgeving.
 *
 * Geen dashboard: één pagina die vertelt waar we staan, wat DogWare doet en
 * wat de volgende stap van de klant is. Mobiel-first, want dit wordt vaker op
 * een telefoon geopend dan achter een bureau.
 */
export default async function TrajectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolvePortal(token);
  if (!ctx) notFound();
  const { lead, commerce } = ctx;

  const proposal = await getActiveProposal(commerce.id);
  if (proposal?.sentAt) await trackProposalViewed(proposal.id);

  const agreement = await getCurrentAgreement(commerce.id);
  const getekend = isSigned(agreement);
  const betaald = await paidTotal(commerce.id);

  const snap = proposal ? readPricing(proposal, commerce) : null;
  const L = snap ? pricingLabels(snap) : null;
  const openstaand = snap ? computeOutstanding(snap.config, betaald) : 0;

  const documenten = await listDocuments(commerce.id, "klant");
  const tijdlijn = await getTimeline(lead.id, "klant", 40);

  if (!proposal?.sentAt) {
    // Er is nog geen voorstel verstuurd; toon een rustige tussenpagina in
    // plaats van een lege omgeving of een 404.
    return (
      <TrajectShell
        voornaam={lead.naam.split(" ")[0]}
        bedrijfsnaam={lead.bedrijfsnaam}
        stage={lead.stage}
        kop="We zijn je voorstel aan het maken"
        tekst="Zodra het klaarstaat krijg je van ons bericht. Je hoeft nu even niets te doen."
        documenten={[]}
        tijdlijn={tijdlijn.map(naarRij)}
      />
    );
  }

  return (
    <TrajectShell
      voornaam={lead.naam.split(" ")[0]}
      bedrijfsnaam={lead.bedrijfsnaam}
      stage={lead.stage}
      documenten={documenten.map((d) => ({
        id: d.id,
        nummer: d.nummer,
        titel: d.titel,
        bedrag: d.totalInclVatCents > 0 ? euroFromCents(d.totalInclVatCents) : null,
        issuedAt: d.issuedAt.toISOString(),
        isFactuur: isInvoiceType(d.type),
      }))}
      tijdlijn={tijdlijn.map(naarRij)}
      voorstel={{
        token,
        version: proposal.version,
        titel: proposal.titel,
        intro: proposal.intro,
        omschrijving: proposal.omschrijving,
        werkzaamheden: proposal.werkzaamheden ?? [],
        modules: proposal.modules ?? [],
        bijzonderheden: proposal.bijzonderheden,
        geldigTot: proposal.geldigTot?.toISOString() ?? null,
        verlopen: isExpired(proposal),
        geaccepteerd: Boolean(proposal.acceptedAt),
        geaccepteerdOp: proposal.acceptedAt?.toISOString() ?? null,
        geaccepteerdDoor: proposal.acceptedName,
        prijzen: L!,
      }}
      status={{
        getekend,
        getekendOp: agreement?.signedAt?.toISOString() ?? null,
        aanbetalingBetaald: betaald > 0,
        opleveringKlaar: Boolean(commerce.deliveryReadyAt),
        volledigBetaald: openstaand === 0 && betaald > 0,
        live: Boolean(commerce.liveAt),
        openstaand: euroFromCents(openstaand),
        mollieKlaar: isMollieConfigured(),
        mandaatActief: Boolean(commerce.mandateActivatedAt),
        heeftAbonnement: commerce.monthlyCents > 0,
      }}
    />
  );
}

function naarRij(e: {
  id: string;
  label: string;
  actor: string;
  createdAt: Date;
}) {
  return {
    id: e.id,
    label: e.label,
    actor: e.actor,
    createdAt: e.createdAt.toISOString(),
  };
}

/** Altijd vers: dit is een persoonlijke pagina, nooit een cachebare. */
export const dynamic = "force-dynamic";
