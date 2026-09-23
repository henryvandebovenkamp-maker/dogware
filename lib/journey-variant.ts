import type { JourneyVariant, ProposalStatus } from "@/lib/db/schema";

/**
 * De route door de journey: met of zonder voorbeeldwebsite.
 *
 * Dit is bewust géén tweede journey-engine. Beide routes delen de stages,
 * commerce, voorstellen, overeenkomsten en betalingen; dit bestand bevat
 * alleen de weinige beslissingen die per route verschillen, als pure functies
 * — zodat de admin, het klantportaal en de serveracties er hetzelfde over
 * denken en het zonder database te testen valt.
 *
 * Client-safe: geen imports met bijwerkingen.
 */

/** Onbekend of leeg is altijd "demo": een bestaande aanvraag verandert nooit ongemerkt van route. */
export function normalizeVariant(v: string | null | undefined): JourneyVariant {
  return v === "direct" ? "direct" : "demo";
}

export function isDirectJourney(v: string | null | undefined): boolean {
  return normalizeVariant(v) === "direct";
}

/**
 * Hoe het versievaste stuk heet waar de overeenkomst op rust.
 *
 * Technisch is het in beide routes een `proposal`. Een directe klant heeft
 * echter nooit een voorstel gezien om over na te denken — voor hem is het de
 * bevestiging van wat al besproken is.
 */
export function opdrachtWoord(v: string | null | undefined): {
  /** "Voorstel" / "Opdrachtbevestiging" */
  Naam: string;
  /** "voorstel" / "opdrachtbevestiging" */
  naam: string;
  /** "het voorstel" / "de opdrachtbevestiging" */
  deNaam: string;
} {
  return isDirectJourney(v)
    ? { Naam: "Opdrachtbevestiging", naam: "opdrachtbevestiging", deNaam: "de opdrachtbevestiging" }
    : { Naam: "Voorstel", naam: "voorstel", deNaam: "het voorstel" };
}

/* ------------------------------------------------- toegang tot ondertekenen -- */

/** Het deel van een voorstelversie dat de poortwachter nodig heeft. */
export type PoortVoorstel = {
  id: string;
  status: ProposalStatus;
  sentAt: Date | null;
  acceptedAt: Date | null;
  geldigTot: Date | null;
};

export type PoortOvereenkomst = {
  proposalId: string;
  status: string;
};

export type Poort = { ok: true } | { ok: false; reden: string };

/** Versies die "verstuurd en nog geldig" zijn — nooit een concept of een opgevolgde. */
const DEFINITIEF: readonly ProposalStatus[] = ["SENT", "VIEWED", "ACCEPTED"];

/**
 * Mag de klant de overeenkomst openen en tekenen?
 *
 * demo   — alleen na een apart, vastgelegd akkoord op het voorstel. Ongewijzigd.
 * direct — het ondertekenen ís het akkoord. Daarvoor moet er een definitief
 *          verstuurde versie liggen, en (bij het tekenen zelf) een overeenkomst
 *          die bij precies die versie hoort en niet is opgevolgd.
 *
 * Geen algemene uitzondering: wat hier voor "direct" geldt, geldt uitsluitend
 * voor een lead die expliciet als directe klant is aangemaakt.
 */
export function overeenkomstPoort(
  variant: string | null | undefined,
  voorstel: PoortVoorstel | null,
  overeenkomst: PoortOvereenkomst | null = null,
  nu: Date = new Date(),
): Poort {
  const w = opdrachtWoord(variant);
  if (!voorstel || !voorstel.sentAt) {
    return { ok: false, reden: `Er staat nog geen ${w.naam} klaar.` };
  }

  if (!isDirectJourney(variant)) {
    return voorstel.acceptedAt
      ? { ok: true }
      : { ok: false, reden: "Ga eerst akkoord met het voorstel." };
  }

  if (!DEFINITIEF.includes(voorstel.status)) {
    return { ok: false, reden: "Deze opdrachtbevestiging is niet meer geldig. Ververs de pagina." };
  }
  // Na tekenen is de geldigheidsdatum niet meer relevant; daarvóór wel.
  if (!voorstel.acceptedAt && voorstel.geldigTot && voorstel.geldigTot.getTime() < nu.getTime()) {
    return {
      ok: false,
      reden: "Deze opdrachtbevestiging is verlopen. Neem even contact op, dan zetten we een nieuwe versie klaar.",
    };
  }
  if (overeenkomst) {
    if (overeenkomst.status === "SUPERSEDED") {
      return { ok: false, reden: "Deze overeenkomst is vervangen. Ververs de pagina en lees de nieuwe versie." };
    }
    if (overeenkomst.proposalId !== voorstel.id) {
      return {
        ok: false,
        reden: "De opdrachtbevestiging is intussen gewijzigd. Ververs de pagina en lees de nieuwe versie.",
      };
    }
  }
  return { ok: true };
}
