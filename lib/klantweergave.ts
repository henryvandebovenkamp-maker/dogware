import "server-only";
import type { Agreement, Commerce, Lead, Proposal } from "@/lib/db/schema";
import { agreementConsents, agreementPricing, isSigned, renderAgreement } from "@/lib/agreements";
import { contractVersionDateLabel } from "@/lib/agreement";
import { freezePricing, isExpired, pricingLabels, type PricingSnapshot } from "@/lib/proposals";
import { regelingZin } from "@/lib/payment-plan";
import { isDirectJourney } from "@/lib/journey-variant";
import type { CommerceMailType, CommerceMailVars } from "@/lib/email/templates/commerce";
import type { VoorstelData } from "@/components/commerce/customer-view";
import type { SchemaWeergave } from "@/lib/payment-schedule";

/**
 * Wat de klant te zien en te lezen krijgt — op één plek opgebouwd, zodat de
 * echte klantomgeving, de echte verstuurmail én de proef voor Henry altijd
 * hetzelfde tonen. Er is geen tweede voorstelweergave en geen tweede mail.
 */

/**
 * Een concept zoals het de deur uit zou gaan: met de prijzen die bij
 * versturen worden bevroren (markProposalSent bevriest precies
 * `freezePricing(commerce)`). Niets wordt opgeslagen.
 */
export function conceptAlsVerstuurd(draft: Proposal, commerce: Commerce): Proposal {
  return { ...draft, pricing: freezePricing(commerce) as unknown as Record<string, unknown> };
}

/**
 * Welke mail de klant krijgt bij definitief versturen, met welke inhoud en
 * naar welke pagina de knop wijst. Gebruikt door sendProposal én de proef.
 */
export function mailBijVersturen(
  lead: Pick<Lead, "journeyVariant">,
  snap: PricingSnapshot,
): { type: CommerceMailType; vars: CommerceMailVars; pad: "" | "/overeenkomst" } {
  if (isDirectJourney(lead.journeyVariant)) {
    const r = snap.betaalregeling;
    return {
      type: "agreement-ready",
      vars: r && r.soort !== "50-50" ? { regeling: regelingZin(r) } : {},
      pad: "/overeenkomst",
    };
  }
  return { type: "proposal-sent", vars: {}, pad: "" };
}

/** Het voorstel zoals de klantomgeving het toont. */
export function voorstelVoorKlant(
  proposal: Proposal,
  snap: PricingSnapshot,
  opties: {
    direct: boolean;
    /** Portaalsleutel voor klantacties; leeg in de proefweergave. */
    token: string;
    /** Basis van de links op de pagina, bijv. "/traject/<sleutel>". */
    pad: string;
    schema?: SchemaWeergave | null;
    proef?: boolean;
  },
): VoorstelData {
  return {
    token: opties.token,
    pad: opties.pad,
    proef: opties.proef,
    direct: opties.direct,
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
    prijzen: pricingLabels(snap),
    schema: opties.schema ?? null,
  };
}

/** De overeenkomst zoals de klant hem leest — voor de echte pagina en de proef. */
export function overeenkomstVoorKlant(agreement: Agreement, proposal: Proposal, lead: Lead) {
  const direct = isDirectJourney(lead.journeyVariant);
  const { chapters, versionName } = renderAgreement(agreement, proposal, lead.journeyVariant);
  const regeling = agreementPricing(agreement).betaalregeling;
  return {
    direct,
    chapters,
    versionName,
    versionDate: contractVersionDateLabel(agreement.voorwaardenVersie),
    consents: agreementConsents(agreement, lead.journeyVariant),
    getekend: isSigned(agreement),
    getekendOp: agreement.signedAt?.toISOString() ?? null,
    getekendDoor: agreement.signerName,
    voorstelVersie: agreement.proposalVersion,
    regelingZin: regeling && regeling.soort !== "50-50" ? regelingZin(regeling) : undefined,
    klant: {
      bedrijfsnaam: agreement.signerCompany ?? lead.bedrijfsnaam,
      naam: agreement.signerName ?? lead.naam,
      email: agreement.signerEmail ?? lead.email,
      telefoon: agreement.signerPhone ?? lead.telefoon ?? "",
      adres: agreement.signerAddress ?? "",
      postcode: agreement.signerPostcode ?? "",
      plaats: agreement.signerCity ?? lead.plaats,
      kvk: agreement.signerKvk ?? "",
      btw: agreement.signerVat ?? "",
      functie: agreement.signerRole ?? "",
    },
  };
}
