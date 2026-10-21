import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CommissieStatus, PartnerCommission, PaymentType } from "@/lib/db/schema";
import { agreementPricing, getCurrentAgreement, isSigned } from "@/lib/agreements";
import { computeOneOff } from "@/lib/money";
import { getMolliePayment, isMollieConfigured } from "@/lib/mollie";
import {
  COMMISSIE_STATUS_LABEL,
  PARTNER_COMMISSIE_LABEL,
  beoordeelMollieBetaling,
  partnerCommissieGroep,
  type PartnerCommissieGroep,
  commissieRegistreerbaar,
  leesUitbetaling,
  volledigBetaald,
  type MollieBetalingFeiten,
} from "@/lib/commissie";
import { logActivity } from "@/lib/audit";
import { logJourneyEvent } from "@/lib/journey";
import { sendPartnerCommissie } from "@/lib/email/send";
import { euro } from "@/lib/partner-data";
import { decryptField, encryptField, maskIban } from "@/lib/crypto-field";
import { isValidIban, normalizeIban } from "@/lib/iban";

/**
 * Partnercommissies registreren, controleren en uitbetalen.
 *
 * De keten, en wie wat mag:
 *
 *   WACHT_OP_BETALING ──(klant volledig betaald, geverifieerd bij Mollie)──▶
 *   UITBETAALBAAR ──(beheerder: bedrag + bankgegevens klaarzetten)──▶
 *   VOORBEREID ──(financieel bevoegde: goedkeuren, Mollie opnieuw gecheckt)──▶
 *   GOEDGEKEURD ──(financieel bevoegde: bankdatum + kenmerk vastleggen)──▶
 *   UITBETAALD
 *
 * Er gaat geen geld via Mollie naar de partner. Mollie kan geen willekeurige
 * overschrijvingen naar derden doen; de uitbetaling is een gewone
 * bankoverschrijving die de beheerder zelf uitvoert. DogWare legt vast wat er
 * moet gebeuren, wie het goedkeurde en wat er daadwerkelijk is gebeurd — en
 * markeert nooit iets als uitbetaald zonder bankdatum en kenmerk.
 *
 * Idempotentie: één rij per aanvraag (unieke index), en elke overgang is een
 * voorwaardelijke update op de vorige status. Twee gelijktijdige klikken of
 * webhooks leveren hooguit één overgang, één auditregel en één mail op.
 *
 * De aanroeper (server action) controleert de rol van de actor. Deze module
 * controleert de toestand.
 */

/** Betalingen die samen de eenmalige investering vormen. */
const EENMALIG: PaymentType[] = ["DEPOSIT", "FINAL_PAYMENT", "INSTALLMENT", "MANUAL_CORRECTION"];

export type Uitkomst<T = undefined> =
  | ({ ok: true; melding: string } & (T extends undefined ? object : { data: T }))
  | { ok: false; melding: string };

/* ------------------------------------------------------------ betaalstand -- */

export type BetaalStand = {
  getekend: boolean;
  /** Eenmalige investering incl. btw volgens de getekende overeenkomst. */
  totaalCents: number;
  /** Som van de betaalde eenmalige betalingen (status PAID in onze administratie). */
  betaaldCents: number;
  openstaandCents: number;
  volledigBetaald: boolean;
  betalingen: {
    id: string;
    type: PaymentType;
    amountCents: number;
    molliePaymentId: string | null;
    paidAt: Date | null;
  }[];
  /** Nog lopende pogingen (open/in behandeling) — informatief. */
  lopend: number;
};

/**
 * De betaalstand van de klant achter een aanvraag, uit onze eigen
 * administratie. Die administratie wordt uitsluitend door de Mollie-webhook
 * op PAID gezet; voor de vrijgave van geld volgt daarna nog een live controle
 * bij Mollie (zie `verifieerBijMollie`).
 */
export async function betaalStand(leadId: string): Promise<BetaalStand | null> {
  const db = getDb();
  if (!db) return null;
  const [commerce] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.leadId, leadId))
    .limit(1);
  if (!commerce) return null;

  const agreement = await getCurrentAgreement(commerce.id);
  const getekend = isSigned(agreement);
  const totaalCents = getekend
    ? computeOneOff(agreementPricing(agreement).config).totalInclVatCents
    : 0;

  const rijen = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.commerceId, commerce.id),
        inArray(schema.payments.type, EENMALIG),
      ),
    )
    .orderBy(asc(schema.payments.createdAt));

  const betaald = rijen.filter((p) => p.status === "PAID");
  const betaaldCents = betaald.reduce((s, p) => s + p.amountCents, 0);
  return {
    getekend,
    totaalCents,
    betaaldCents,
    openstaandCents: Math.max(0, totaalCents - betaaldCents),
    volledigBetaald: volledigBetaald({ getekend, totaalCents, betaaldCents }),
    betalingen: betaald.map((p) => ({
      id: p.id,
      type: p.type,
      amountCents: p.amountCents,
      molliePaymentId: p.molliePaymentId,
      paidAt: p.paidAt,
    })),
    lopend: rijen.filter((p) => ["CREATED", "OPEN", "PENDING"].includes(p.status)).length,
  };
}

type MollieControle = {
  molliePaymentId: string | null;
  type: PaymentType;
  amountCents: number;
  ok: boolean;
  reden?: string;
};

/**
 * Vraag élke betaalde termijn live na bij Mollie. Fail closed: zonder
 * Mollie-configuratie, zonder Mollie-id of bij één afwijking is het nee.
 */
async function verifieerBijMollie(
  stand: BetaalStand,
): Promise<{ ok: boolean; reden?: string; controles: MollieControle[] }> {
  if (!isMollieConfigured()) {
    return {
      ok: false,
      reden: "Mollie is in deze omgeving niet geconfigureerd; de betalingen kunnen niet worden geverifieerd.",
      controles: [],
    };
  }
  const controles: MollieControle[] = [];
  for (const b of stand.betalingen) {
    if (!b.molliePaymentId) {
      controles.push({ ...b, ok: false, reden: "Geen Mollie-betaling — niet te verifiëren." });
      continue;
    }
    const mollie = (await getMolliePayment(b.molliePaymentId)) as MollieBetalingFeiten | null;
    const oordeel = beoordeelMollieBetaling(b.amountCents, mollie);
    controles.push({
      molliePaymentId: b.molliePaymentId,
      type: b.type,
      amountCents: b.amountCents,
      ok: oordeel.ok,
      reden: oordeel.ok ? undefined : oordeel.reden,
    });
  }
  const fout = controles.find((c) => !c.ok);
  return {
    ok: !fout && controles.length > 0,
    reden: fout ? `${fout.molliePaymentId ?? "Betaling"}: ${fout.reden}` : undefined,
    controles,
  };
}

/* ------------------------------------------------------------ registreren -- */

/**
 * Zorg dat de aanbreng achter deze aanvraag een commissierij heeft.
 *
 * Idempotent: bestaat de rij al, dan wordt die teruggegeven, ongewijzigd. Het
 * bedrag wordt bij het aanmaken vastgezet op de afgesproken beloning van de
 * partner op dat moment; een latere wijziging van die beloning verandert een
 * al geregistreerde commissie niet.
 */
export async function registreerCommissie(
  leadId: string,
  actorUserId: string | null,
): Promise<Uitkomst<PartnerCommission>> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };

  const [lead] = await db
    .select({
      id: schema.leads.id,
      partnerId: schema.leads.affiliatePartnerId,
      stage: schema.leads.stage,
      status: schema.leads.status,
      bedrijfsnaam: schema.leads.bedrijfsnaam,
    })
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);
  if (!lead) return { ok: false, melding: "Aanvraag niet gevonden." };

  const [bestaand] = await db
    .select()
    .from(schema.partnerCommissions)
    .where(eq(schema.partnerCommissions.leadId, leadId))
    .limit(1);
  if (bestaand) {
    if (lead.partnerId && bestaand.partnerId !== lead.partnerId) {
      return {
        ok: false,
        melding:
          "De commissie staat op een andere partner dan de aanvraag nu. Controleer de toewijzing voordat er iets wordt uitbetaald.",
      };
    }
    return { ok: true, melding: "Commissie was al geregistreerd.", data: bestaand };
  }

  if (!lead.partnerId) return { ok: false, melding: "Deze aanvraag is niet via een partner binnengekomen." };
  if (!commissieRegistreerbaar(lead.stage, lead.status)) {
    return { ok: false, melding: "Nog geen commissie: de klant heeft het voorstel nog niet geaccepteerd." };
  }

  const [partner] = await db
    .select({ id: schema.partners.id, commissionCents: schema.partners.commissionCents })
    .from(schema.partners)
    .where(eq(schema.partners.id, lead.partnerId))
    .limit(1);
  if (!partner) return { ok: false, melding: "Partner niet gevonden." };

  // De unieke index op lead_id is de scheidsrechter, niet de SELECT hierboven.
  const [nieuw] = await db
    .insert(schema.partnerCommissions)
    .values({ partnerId: partner.id, leadId, amountCents: partner.commissionCents })
    .onConflictDoNothing({ target: schema.partnerCommissions.leadId })
    .returning();

  if (nieuw) {
    await logActivity({
      actorUserId,
      action: "COMMISSION_REGISTERED",
      objectType: "partner_commission",
      objectId: nieuw.id,
      newValue: { partnerId: partner.id, leadId, amountCents: nieuw.amountCents },
    });
    await logJourneyEvent(
      leadId,
      "partner_commissie",
      `Partnercommissie geregistreerd (${euro(nieuw.amountCents)})`,
      { actor: actorUserId ? "admin" : "systeem", internal: true, commissieId: nieuw.id, partnerId: partner.id },
    );
    return { ok: true, melding: "Commissie geregistreerd.", data: nieuw };
  }

  const [alsnog] = await db
    .select()
    .from(schema.partnerCommissions)
    .where(eq(schema.partnerCommissions.leadId, leadId))
    .limit(1);
  return alsnog
    ? { ok: true, melding: "Commissie was al geregistreerd.", data: alsnog }
    : { ok: false, melding: "Commissie kon niet worden geregistreerd." };
}

/* -------------------------------------------------------------- controle -- */

/**
 * Registreer (indien nodig) en controleer of de commissie uitbetaalbaar is.
 *
 * Alleen de stap WACHT_OP_BETALING → UITBETAALBAAR gebeurt hier, en alleen
 * als (1) de getekende eenmalige investering volledig als betaald in onze
 * administratie staat én (2) Mollie elke betaling live bevestigt. Dan volgt
 * één bericht aan de partner.
 */
export async function controleerCommissie(
  leadId: string,
  actorUserId: string | null,
): Promise<Uitkomst<{ status: CommissieStatus; stand: BetaalStand | null }>> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };

  const reg = await registreerCommissie(leadId, actorUserId);
  if (!reg.ok) return reg;
  const commissie = reg.data;
  const stand = await betaalStand(leadId);

  if (commissie.status !== "WACHT_OP_BETALING") {
    return {
      ok: true,
      melding: `Commissie staat al op "${COMMISSIE_STATUS_LABEL[commissie.status]}".`,
      data: { status: commissie.status, stand },
    };
  }

  if (!stand || !stand.volledigBetaald) {
    const reden = !stand
      ? "er is nog geen commerciële afspraak"
      : !stand.getekend
        ? "de overeenkomst is nog niet getekend"
        : `er staat nog ${euro(stand.openstaandCents)} open`;
    return {
      ok: true,
      melding: `Nog niet uitbetaalbaar: ${reden}.`,
      data: { status: commissie.status, stand },
    };
  }

  const mollie = await verifieerBijMollie(stand);
  if (!mollie.ok) {
    await logActivity({
      actorUserId,
      action: "COMMISSION_CHECK_BLOCKED",
      objectType: "partner_commission",
      objectId: commissie.id,
      newValue: { controles: mollie.controles },
      reason: mollie.reden,
    });
    return {
      ok: false,
      melding: `Niet vrijgegeven — Mollie-controle: ${mollie.reden ?? "onbekende fout"}`,
    };
  }

  const nu = new Date();
  const [bijgewerkt] = await db
    .update(schema.partnerCommissions)
    .set({
      status: "UITBETAALBAAR",
      payableAt: nu,
      payableCheck: {
        gecontroleerdOp: nu.toISOString(),
        totaalCents: stand.totaalCents,
        betaaldCents: stand.betaaldCents,
        controles: mollie.controles,
      },
      updatedAt: nu,
    })
    .where(
      and(
        eq(schema.partnerCommissions.id, commissie.id),
        eq(schema.partnerCommissions.status, "WACHT_OP_BETALING"),
      ),
    )
    .returning();

  if (!bijgewerkt) {
    // Een gelijktijdige controle was ons voor; die heeft ook gemaild.
    return { ok: true, melding: "Commissie is zojuist al vrijgegeven.", data: { status: "UITBETAALBAAR", stand } };
  }

  await logActivity({
    actorUserId,
    action: "COMMISSION_PAYABLE",
    objectType: "partner_commission",
    objectId: commissie.id,
    oldValue: { status: "WACHT_OP_BETALING" },
    newValue: { status: "UITBETAALBAAR", totaalCents: stand.totaalCents, betaaldCents: stand.betaaldCents },
  });
  await logJourneyEvent(
    leadId,
    "partner_commissie",
    `Partnercommissie uitbetaalbaar: klant volledig betaald (geverifieerd bij Mollie)`,
    { actor: actorUserId ? "admin" : "systeem", internal: true, commissieId: commissie.id },
  );

  const mail = await mailPartner(commissie.id, "uitbetaalbaar");
  return {
    ok: true,
    melding:
      "Commissie is uitbetaalbaar. " +
      (mail.ok ? "De partner is per e-mail geïnformeerd." : `Let op: ${mail.melding}`),
    data: { status: "UITBETAALBAAR", stand },
  };
}

/**
 * Na elke verwerkte betaling: is daarmee een partnercommissie vrijgekomen?
 * Aangeroepen vanuit de betaalverwerking. Gooit nooit — een commissie mag de
 * verwerking van een klantbetaling niet kunnen breken.
 */
export async function commissieNaBetaling(commerceId: string): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    const [rij] = await db
      .select({ leadId: schema.commerce.leadId, partnerId: schema.leads.affiliatePartnerId })
      .from(schema.commerce)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.commerce.leadId))
      .where(eq(schema.commerce.id, commerceId))
      .limit(1);
    if (!rij?.partnerId) return;
    await controleerCommissie(rij.leadId, null);
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "partner_commissie.na_betaling_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
  }
}

/* ------------------------------------------------------ uitbetalingsflow -- */

async function laadCommissie(commissieId: string) {
  const db = getDb();
  if (!db) return null;
  const [rij] = await db
    .select({ commissie: schema.partnerCommissions, partner: schema.partners })
    .from(schema.partnerCommissions)
    .innerJoin(schema.partners, eq(schema.partners.id, schema.partnerCommissions.partnerId))
    .where(eq(schema.partnerCommissions.id, commissieId))
    .limit(1);
  return rij ?? null;
}

/**
 * Stap 1 — de beheerder zet de overschrijving klaar.
 *
 * Bankgegevens komen bij voorkeur van de partner zelf (Profiel). Heeft die ze
 * nog niet ingevuld, dan kan de beheerder ze hier vastleggen; dat gebeurt
 * versleuteld op het partnerprofiel en staat in de auditlog (gemaskeerd).
 * Rekeninghouder en IBAN worden daarna bevroren op de commissie.
 */
export async function bereidUitbetalingVoor(
  commissieId: string,
  actorUserId: string,
  invoer: { rekeninghouder?: string; iban?: string },
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };
  const rij = await laadCommissie(commissieId);
  if (!rij) return { ok: false, melding: "Commissie niet gevonden." };
  const { commissie, partner } = rij;
  if (commissie.status !== "UITBETAALBAAR") {
    return { ok: false, melding: `Kan niet voorbereiden: status is "${COMMISSIE_STATUS_LABEL[commissie.status]}".` };
  }

  let naam = partner.rekeninghouder?.trim() ?? "";
  let iban = normalizeIban(decryptField(partner.ibanEnc));
  const nieuweNaam = invoer.rekeninghouder?.trim() ?? "";
  const nieuweIban = normalizeIban(invoer.iban ?? "");

  if (nieuweIban || nieuweNaam) {
    if (!nieuweNaam || !isValidIban(nieuweIban)) {
      return { ok: false, melding: "Vul zowel de rekeninghouder als een geldig IBAN in." };
    }
    if (nieuweNaam !== naam || nieuweIban !== iban) {
      await db
        .update(schema.partners)
        .set({ rekeninghouder: nieuweNaam, ibanEnc: encryptField(nieuweIban) })
        .where(eq(schema.partners.id, partner.id));
      await logActivity({
        actorUserId,
        action: "PARTNER_BANK_DETAILS_SET_BY_ADMIN",
        objectType: "partner",
        objectId: partner.id,
        oldValue: { rekeninghouder: naam || null, iban: iban ? maskIban(iban) : null },
        newValue: { rekeninghouder: nieuweNaam, iban: maskIban(nieuweIban) },
        reason: "Vastgelegd bij het voorbereiden van een commissie-uitbetaling",
      });
      naam = nieuweNaam;
      iban = nieuweIban;
    }
  }

  if (!naam || !isValidIban(iban)) {
    return {
      ok: false,
      melding:
        "Er zijn nog geen geldige bankgegevens. Vraag de partner ze in te vullen onder Profiel, of vul ze hier in.",
    };
  }

  const nu = new Date();
  const [klaar] = await db
    .update(schema.partnerCommissions)
    .set({
      status: "VOORBEREID",
      preparedAt: nu,
      preparedByUserId: actorUserId,
      payeeName: naam,
      payeeIbanEnc: encryptField(iban),
      updatedAt: nu,
    })
    .where(
      and(
        eq(schema.partnerCommissions.id, commissieId),
        eq(schema.partnerCommissions.status, "UITBETAALBAAR"),
      ),
    )
    .returning({ id: schema.partnerCommissions.id });
  if (!klaar) return { ok: false, melding: "De commissie is intussen gewijzigd. Vernieuw de pagina." };

  await logActivity({
    actorUserId,
    action: "COMMISSION_PAYOUT_PREPARED",
    objectType: "partner_commission",
    objectId: commissieId,
    oldValue: { status: "UITBETAALBAAR" },
    newValue: { status: "VOORBEREID", amountCents: commissie.amountCents, rekeninghouder: naam, iban: maskIban(iban) },
  });
  await logJourneyEvent(commissie.leadId, "partner_commissie", `Uitbetaling partnercommissie voorbereid (${euro(commissie.amountCents)})`, {
    actor: "admin",
    internal: true,
    commissieId,
  });
  return { ok: true, melding: "Uitbetaling voorbereid. Wacht op goedkeuring door een financieel bevoegde." };
}

/**
 * Stap 2 — goedkeuren. Alleen voor een financieel bevoegde (de action
 * controleert dat). Mollie wordt hier nog één keer live nagevraagd: tussen
 * vrijgave en goedkeuring kan er een terugboeking zijn geweest.
 */
export async function keurUitbetalingGoed(commissieId: string, actorUserId: string): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };
  const rij = await laadCommissie(commissieId);
  if (!rij) return { ok: false, melding: "Commissie niet gevonden." };
  const { commissie } = rij;
  if (commissie.status !== "VOORBEREID") {
    return { ok: false, melding: `Kan niet goedkeuren: status is "${COMMISSIE_STATUS_LABEL[commissie.status]}".` };
  }

  const stand = await betaalStand(commissie.leadId);
  if (!stand?.volledigBetaald) {
    return { ok: false, melding: "De klant staat niet (meer) als volledig betaald. Niet goedgekeurd." };
  }
  const mollie = await verifieerBijMollie(stand);
  if (!mollie.ok) {
    await logActivity({
      actorUserId,
      action: "COMMISSION_APPROVAL_BLOCKED",
      objectType: "partner_commission",
      objectId: commissieId,
      newValue: { controles: mollie.controles },
      reason: mollie.reden,
    });
    return { ok: false, melding: `Niet goedgekeurd — Mollie-controle: ${mollie.reden ?? "onbekende fout"}` };
  }

  const nu = new Date();
  const [goed] = await db
    .update(schema.partnerCommissions)
    .set({ status: "GOEDGEKEURD", approvedAt: nu, approvedByUserId: actorUserId, updatedAt: nu })
    .where(
      and(
        eq(schema.partnerCommissions.id, commissieId),
        eq(schema.partnerCommissions.status, "VOORBEREID"),
      ),
    )
    .returning({ id: schema.partnerCommissions.id });
  if (!goed) return { ok: false, melding: "De commissie is intussen gewijzigd. Vernieuw de pagina." };

  await logActivity({
    actorUserId,
    action: "COMMISSION_PAYOUT_APPROVED",
    objectType: "partner_commission",
    objectId: commissieId,
    oldValue: { status: "VOORBEREID" },
    newValue: { status: "GOEDGEKEURD", controles: mollie.controles },
  });
  await logJourneyEvent(commissie.leadId, "partner_commissie", "Uitbetaling partnercommissie goedgekeurd", {
    actor: "admin",
    internal: true,
    commissieId,
  });
  return { ok: true, melding: "Goedgekeurd. Voer nu de bankoverschrijving uit en leg die daarna hier vast." };
}

/**
 * Stap 3 — vastleggen dat de bankoverschrijving is uitgevoerd. Alleen voor
 * een financieel bevoegde, alleen vanuit GOEDGEKEURD, en alleen met
 * bankdatum, kenmerk en exact het commissiebedrag. Daarna één bevestiging aan
 * de partner; mislukt die mail, dan blijft de status kloppen (het geld ís
 * overgemaakt) en kan de mail opnieuw worden verstuurd.
 */
export async function markeerUitbetaald(
  commissieId: string,
  actorUserId: string,
  invoer: { datum: string; referentie: string; bedrag: string },
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };
  const rij = await laadCommissie(commissieId);
  if (!rij) return { ok: false, melding: "Commissie niet gevonden." };
  const { commissie } = rij;
  if (commissie.status === "UITBETAALD") {
    return { ok: false, melding: "Deze commissie is al uitbetaald. Een tweede uitbetaling is niet mogelijk." };
  }
  if (commissie.status !== "GOEDGEKEURD") {
    return { ok: false, melding: `Kan niet als uitbetaald markeren: status is "${COMMISSIE_STATUS_LABEL[commissie.status]}".` };
  }

  const gelezen = leesUitbetaling(invoer, commissie.amountCents);
  if (!gelezen.ok) return { ok: false, melding: gelezen.reden };

  const nu = new Date();
  const [betaald] = await db
    .update(schema.partnerCommissions)
    .set({
      status: "UITBETAALD",
      paidAt: gelezen.datum,
      paidByUserId: actorUserId,
      paidAmountCents: gelezen.bedragCents,
      paymentReference: gelezen.referentie,
      updatedAt: nu,
    })
    .where(
      and(
        eq(schema.partnerCommissions.id, commissieId),
        eq(schema.partnerCommissions.status, "GOEDGEKEURD"),
      ),
    )
    .returning({ id: schema.partnerCommissions.id });
  if (!betaald) {
    return { ok: false, melding: "De commissie is intussen gewijzigd (mogelijk al uitbetaald). Vernieuw de pagina." };
  }

  await logActivity({
    actorUserId,
    action: "COMMISSION_PAID",
    objectType: "partner_commission",
    objectId: commissieId,
    oldValue: { status: "GOEDGEKEURD" },
    newValue: {
      status: "UITBETAALD",
      paidAt: gelezen.datum.toISOString(),
      amountCents: gelezen.bedragCents,
      referentie: gelezen.referentie,
    },
  });
  await logJourneyEvent(commissie.leadId, "partner_commissie", `Partnercommissie uitbetaald (${euro(gelezen.bedragCents)}, kenmerk ${gelezen.referentie})`, {
    actor: "admin",
    internal: true,
    commissieId,
  });

  const mail = await mailPartner(commissieId, "uitbetaald");
  return {
    ok: true,
    melding:
      "Vastgelegd als uitbetaald. " +
      (mail.ok ? "De partner heeft een bevestiging ontvangen." : `Let op: ${mail.melding}`),
  };
}

/**
 * Terug naar UITBETAALBAAR — bijvoorbeeld bij verkeerde bankgegevens. Kan
 * alleen zolang er nog niets is overgemaakt.
 */
export async function trekVoorbereidingIn(
  commissieId: string,
  actorUserId: string,
  reden: string,
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };
  if (!reden.trim()) return { ok: false, melding: "Geef een reden op." };
  const rij = await laadCommissie(commissieId);
  if (!rij) return { ok: false, melding: "Commissie niet gevonden." };
  const vorige = rij.commissie.status;
  if (vorige !== "VOORBEREID" && vorige !== "GOEDGEKEURD") {
    return { ok: false, melding: `Niets in te trekken: status is "${COMMISSIE_STATUS_LABEL[vorige]}".` };
  }
  const [terug] = await db
    .update(schema.partnerCommissions)
    .set({
      status: "UITBETAALBAAR",
      preparedAt: null,
      preparedByUserId: null,
      payeeName: null,
      payeeIbanEnc: null,
      approvedAt: null,
      approvedByUserId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.partnerCommissions.id, commissieId), eq(schema.partnerCommissions.status, vorige)))
    .returning({ id: schema.partnerCommissions.id });
  if (!terug) return { ok: false, melding: "De commissie is intussen gewijzigd. Vernieuw de pagina." };

  await logActivity({
    actorUserId,
    action: "COMMISSION_PAYOUT_WITHDRAWN",
    objectType: "partner_commission",
    objectId: commissieId,
    oldValue: { status: vorige },
    newValue: { status: "UITBETAALBAAR" },
    reason: reden.trim(),
  });
  return { ok: true, melding: "Voorbereiding ingetrokken; de commissie staat weer op uitbetaalbaar." };
}

/* ------------------------------------------------------------------ mail -- */

/**
 * Eén bericht per moment per commissie. Eerst claimen (zet het tijdstip
 * alleen als het nog leeg is), dan versturen; mislukt het versturen, dan
 * wordt de claim teruggedraaid zodat een nieuwe poging mogelijk blijft. Zo
 * gaan er bij gelijktijdige aanroepen nooit twee mails uit.
 *
 * "uitbetaald" vereist dat de commissie echt op UITBETAALD staat — een
 * bevestiging over een overschrijving die niet heeft plaatsgevonden kan niet.
 */
export async function mailPartner(
  commissieId: string,
  moment: "uitbetaalbaar" | "uitbetaald",
): Promise<Uitkomst> {
  const db = getDb();
  if (!db) return { ok: false, melding: "Database niet geconfigureerd." };
  const kolom =
    moment === "uitbetaald"
      ? schema.partnerCommissions.paidMailSentAt
      : schema.partnerCommissions.payableMailSentAt;
  const vereist: CommissieStatus[] =
    moment === "uitbetaald" ? ["UITBETAALD"] : ["UITBETAALBAAR", "VOORBEREID", "GOEDGEKEURD"];

  const [geclaimd] = await db
    .update(schema.partnerCommissions)
    .set(moment === "uitbetaald" ? { paidMailSentAt: new Date() } : { payableMailSentAt: new Date() })
    .where(
      and(
        eq(schema.partnerCommissions.id, commissieId),
        isNull(kolom),
        inArray(schema.partnerCommissions.status, vereist),
      ),
    )
    .returning();
  if (!geclaimd) return { ok: false, melding: "Dit bericht is al verstuurd of past niet bij de huidige status." };

  const terugdraaien = () =>
    db
      .update(schema.partnerCommissions)
      .set(moment === "uitbetaald" ? { paidMailSentAt: null } : { payableMailSentAt: null })
      .where(eq(schema.partnerCommissions.id, commissieId));

  try {
    const [ontvanger] = await db
      .select({
        email: schema.users.email,
        naam: schema.users.naam,
        voornaam: schema.partners.voornaam,
        bedrijfsnaam: schema.leads.bedrijfsnaam,
      })
      .from(schema.partners)
      .innerJoin(schema.users, eq(schema.users.id, schema.partners.userId))
      .innerJoin(schema.leads, eq(schema.leads.id, geclaimd.leadId))
      .where(eq(schema.partners.id, geclaimd.partnerId))
      .limit(1);
    if (!ontvanger?.email) {
      await terugdraaien();
      return { ok: false, melding: "Geen e-mailadres bekend voor deze partner; er is niets verstuurd." };
    }

    const voornaam = ontvanger.voornaam?.trim() || ontvanger.naam.trim().split(/\s+/)[0] || "partner";
    const bedrag = euro(geclaimd.amountCents);
    const uitbetaling =
      moment === "uitbetaald" && geclaimd.paidAt && geclaimd.paymentReference
        ? {
            datum: geclaimd.paidAt.toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Europe/Amsterdam",
            }),
            referentie: geclaimd.paymentReference,
            ibanGemaskeerd: geclaimd.payeeIbanEnc ? maskIban(decryptField(geclaimd.payeeIbanEnc)) : undefined,
          }
        : undefined;

    const mail = await sendPartnerCommissie(
      ontvanger.email,
      voornaam,
      moment,
      bedrag,
      ontvanger.bedrijfsnaam?.trim() || undefined,
      uitbetaling,
    );
    if (!mail.ok) {
      await terugdraaien();
      await logJourneyEvent(geclaimd.leadId, "partner_commissie_mail_failed", `Commissiebericht (${moment}) aan partner mislukt: ${mail.error.message}`, {
        internal: true,
        commissieId,
      });
      return { ok: false, melding: `het bericht aan de partner kon niet worden verstuurd (${mail.error.message}). Probeer het opnieuw.` };
    }

    await logJourneyEvent(
      geclaimd.leadId,
      "partner_notified",
      `Partner geïnformeerd (commissie ${moment}): ${ontvanger.email}`,
      { internal: true, moment: `commissie-${moment}`, partnerId: geclaimd.partnerId, commissieId },
    );
    await logActivity({
      action: moment === "uitbetaald" ? "COMMISSION_PAID_MAIL_SENT" : "COMMISSION_PAYABLE_MAIL_SENT",
      objectType: "partner_commission",
      objectId: commissieId,
      newValue: { ontvanger: ontvanger.email, providerId: mail.id },
    });
    return { ok: true, melding: `Bericht verstuurd naar ${ontvanger.email}.` };
  } catch (err) {
    await terugdraaien();
    throw err;
  }
}

/* --------------------------------------------------------------- weergave -- */

export type CommissieRegel = {
  leadId: string;
  bedrijfsnaam: string;
  stage: string;
  leadStatus: string;
  commissie: PartnerCommission | null;
  stand: BetaalStand | null;
  namen: Record<string, string>;
  /** Alleen voor de beheerder: gemaskeerd IBAN van de bevroren begunstigde. */
  ibanGemaskeerd: string | null;
  /** Volledig IBAN — uitsluitend gevuld voor een financieel bevoegde vanaf GOEDGEKEURD. */
  ibanVoluit: string | null;
};

/**
 * Alle aanbrengingen van een partner met hun commissie en de betaalstand van
 * de klant — voor het adminscherm. Het volledige IBAN wordt alleen
 * meegegeven aan wie financieel bevoegd is, en pas wanneer er daadwerkelijk
 * overgemaakt moet worden.
 */
export async function commissieOverzichtAdmin(
  partnerId: string,
  opts: { financieelBevoegd: boolean },
): Promise<CommissieRegel[]> {
  const db = getDb();
  if (!db) return [];
  const leads = await db
    .select({
      id: schema.leads.id,
      bedrijfsnaam: schema.leads.bedrijfsnaam,
      stage: schema.leads.stage,
      status: schema.leads.status,
    })
    .from(schema.leads)
    .where(eq(schema.leads.affiliatePartnerId, partnerId))
    .orderBy(asc(schema.leads.createdAt));
  const commissies = await db
    .select()
    .from(schema.partnerCommissions)
    .where(eq(schema.partnerCommissions.partnerId, partnerId));
  const perLead = new Map(commissies.map((c) => [c.leadId, c]));

  const userIds = new Set<string>();
  for (const c of commissies) {
    for (const id of [c.preparedByUserId, c.approvedByUserId, c.paidByUserId]) if (id) userIds.add(id);
  }
  const namen: Record<string, string> = {};
  if (userIds.size > 0) {
    const rijen = await db
      .select({ id: schema.users.id, naam: schema.users.naam })
      .from(schema.users)
      .where(inArray(schema.users.id, [...userIds]));
    for (const r of rijen) namen[r.id] = r.naam;
  }

  // Ook een commissie op een aanvraag die inmiddels aan een ander hangt hoort
  // zichtbaar te blijven — die is van deze partner.
  const leadIds = new Set(leads.map((l) => l.id));
  const losse = commissies.filter((c) => !leadIds.has(c.leadId));
  const extra = losse.length
    ? await db
        .select({
          id: schema.leads.id,
          bedrijfsnaam: schema.leads.bedrijfsnaam,
          stage: schema.leads.stage,
          status: schema.leads.status,
        })
        .from(schema.leads)
        .where(inArray(schema.leads.id, losse.map((c) => c.leadId)))
    : [];

  const regels: CommissieRegel[] = [];
  for (const l of [...leads, ...extra]) {
    const c = perLead.get(l.id) ?? null;
    if (!c && !commissieRegistreerbaar(l.stage, l.status)) continue;
    const iban = c?.payeeIbanEnc ? decryptField(c.payeeIbanEnc) : "";
    regels.push({
      leadId: l.id,
      bedrijfsnaam: l.bedrijfsnaam,
      stage: l.stage,
      leadStatus: l.status,
      commissie: c,
      stand: await betaalStand(l.id),
      namen,
      ibanGemaskeerd: iban ? maskIban(iban) : null,
      ibanVoluit:
        iban && opts.financieelBevoegd && (c?.status === "GOEDGEKEURD" || c?.status === "VOORBEREID")
          ? iban
          : null,
    });
  }
  return regels;
}

export type PartnerCommissieRegel = {
  leadId: string;
  bedrijfsnaam: string;
  amountCents: number;
  groep: PartnerCommissieGroep;
  label: string;
  /** Alleen bij uitbetaald: de datum van de overschrijving. */
  paidAt: Date | null;
};

/**
 * Het commissie-overzicht voor het partnerportaal, strikt voor de eigen
 * partner. Geregistreerde commissies zijn leidend; een aanbreng die al
 * akkoord is maar (nog) geen rij heeft, telt mee als "wacht op betaling".
 * Geen klantbedragen of betaalgegevens — alleen de eigen commissie.
 */
export async function commissieOverzichtPartner(partnerId: string, commissionCents: number) {
  const db = getDb();
  const leeg = { regels: [] as PartnerCommissieRegel[], totaal: { opgebouwd: 0, wacht: 0, beschikbaar: 0, uitbetaald: 0 } };
  if (!db) return leeg;

  const [leads, commissies] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        bedrijfsnaam: schema.leads.bedrijfsnaam,
        stage: schema.leads.stage,
        status: schema.leads.status,
      })
      .from(schema.leads)
      .where(eq(schema.leads.affiliatePartnerId, partnerId))
      .orderBy(asc(schema.leads.createdAt)),
    db
      .select({
        leadId: schema.partnerCommissions.leadId,
        bedrijfsnaam: schema.leads.bedrijfsnaam,
        status: schema.partnerCommissions.status,
        amountCents: schema.partnerCommissions.amountCents,
        paidAt: schema.partnerCommissions.paidAt,
      })
      .from(schema.partnerCommissions)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.partnerCommissions.leadId))
      .where(eq(schema.partnerCommissions.partnerId, partnerId)),
  ]);

  const regels: PartnerCommissieRegel[] = commissies.map((c) => ({
    leadId: c.leadId,
    bedrijfsnaam: c.bedrijfsnaam,
    amountCents: c.amountCents,
    groep: partnerCommissieGroep(c.status),
    label: PARTNER_COMMISSIE_LABEL[c.status],
    paidAt: c.status === "UITBETAALD" ? c.paidAt : null,
  }));
  const geregistreerd = new Set(commissies.map((c) => c.leadId));
  for (const l of leads) {
    if (geregistreerd.has(l.id) || !commissieRegistreerbaar(l.stage, l.status)) continue;
    regels.push({
      leadId: l.id,
      bedrijfsnaam: l.bedrijfsnaam,
      amountCents: commissionCents,
      groep: "wacht",
      label: PARTNER_COMMISSIE_LABEL.WACHT_OP_BETALING,
      paidAt: null,
    });
  }

  const totaal = { opgebouwd: 0, wacht: 0, beschikbaar: 0, uitbetaald: 0 };
  for (const r of regels) {
    if (r.groep === "vervallen") continue;
    totaal.opgebouwd += r.amountCents;
    totaal[r.groep] += r.amountCents;
  }
  return { regels, totaal };
}
