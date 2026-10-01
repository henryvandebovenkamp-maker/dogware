import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { maakTestDb } from "./test-db.mts";

/**
 * De commerciële onboarding van een demo-klant, van voorstel tot iDEAL —
 * tegen een echte (in-process) Postgres, met de echte serveracties.
 *
 * Aanleiding: een klant zag "Dit voorstel is verlopen" en kon niet verder,
 * terwijl hij wilde tekenen en betalen. Deze test legt de regels vast die dat
 * voor iedereen voorkomen:
 *
 *  - een voorstel verloopt alleen vóór acceptatie; daarna blokkeert de
 *    geldigheidsdatum niets meer (overeenkomst, tekenen, betalen);
 *  - verloopt het vóór acceptatie, dan verlengt de beheerder het met één
 *    handeling en kan de klant meteen verder;
 *  - akkoord, tekenen, betaling starten en de webhook zijn idempotent;
 *  - bedragen komen uitsluitend uit de bevroren, getekende overeenkomst;
 *  - het ene dossier kan nooit aan het andere komen.
 *
 * Mollie is een nepclient die zich gedraagt als de echte API. Er gaat geen
 * mail de deur uit en er wordt geen echte betaling gestart.
 */

process.env.MOLLIE_API_KEY = "test_integratie";
process.env.AUTH_SECRET ??= "test-geheim-alleen-voor-de-testrunner-0123456789";

/* ------------------------------------------------------------ nep-Mollie -- */

type NepBetaling = {
  id: string;
  status: string;
  amount: { currency: string; value: string };
  customerId?: string | null;
  sequenceType?: string;
  mandateId?: string;
  method?: string;
  metadata?: Record<string, string>;
  redirectUrl?: string;
};
const mollieBetalingen = new Map<string, NepBetaling>();
let teller = 0;
let aanmakenFaalt = false;

(globalThis as Record<string, unknown>).__fakeMollie = {
  payments: {
    create: async (p: NepBetaling) => {
      if (aanmakenFaalt) throw new Error("Mollie tijdelijk onbereikbaar");
      const id = `tr_onb${++teller}`;
      mollieBetalingen.set(id, { ...p, id, status: "open" });
      return { id, getCheckoutUrl: () => `https://mollie.test/${id}` };
    },
    get: async (id: string) => {
      const b = mollieBetalingen.get(id);
      if (!b) throw new Error("niet gevonden");
      return { ...b, getCheckoutUrl: () => (b.status === "open" ? `https://mollie.test/${id}` : null) };
    },
  },
  customers: { get: async (id: string) => ({ id }), create: async () => ({ id: "cst_onb" }) },
  customerMandates: { page: async () => [] },
  customerSubscriptions: { page: async () => [], create: async () => ({ id: "sub_onb" }) },
};

function mollieZet(id: string, status: string) {
  const b = mollieBetalingen.get(id);
  assert.ok(b, `onbekende Mollie-betaling ${id}`);
  b.status = status;
  if (status === "paid") b.method = "ideal";
}

type OpgenomenMail = { type: string; to?: string; vars?: Record<string, string>; ctaUrl?: string };
const mails = () => ((globalThis as Record<string, unknown>).__verzondenMails as OpgenomenMail[]) ?? [];
const mailsAan = (email: string, type: string) => mails().filter((m) => m.to === email && m.type === type);

/* ------------------------------------------------------------- opzetten -- */

const { db } = await maakTestDb();
const { schema } = await import("../lib/db/index.ts");
const acties = await import("../app/actions/commerce.ts");
const { processPaymentByMollieId } = await import("../lib/commerce.ts");
const { getActiveProposal, readPricing, createOrGetDraft } = await import("../lib/proposals.ts");
const { voorstelVoorKlant } = await import("../lib/klantweergave.ts");
const { agreementPricing, getCurrentAgreement } = await import("../lib/agreements.ts");
const { hashToken } = await import("../lib/auth/crypto.ts");
const { kalenderdag, dagenLater } = await import("../lib/proposal-geldigheid.ts");

const IDLE = { status: "idle" as const };
const ADMIN_TOKEN = randomBytes(24).toString("base64url");
const alsAdmin = () => ((globalThis as Record<string, unknown>).__testCookies = { dw_session: ADMIN_TOKEN });
const alsKlant = () => ((globalThis as Record<string, unknown>).__testCookies = {});
function formulier(velden: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(velden)) fd.set(k, v);
  return fd;
}
const vandaag = () => kalenderdag(new Date());

const TEKEN = {
  naam: "Test Ondertekenaar",
  functie: "Eigenaar",
  email: "klant@voorbeeld.test",
  telefoon: "0600000000",
  bedrijfsnaam: "Voorbeeld Kattenbedrijf",
  adres: "Straat 1",
  postcode: "1234 AB",
  plaats: "Utrecht",
  kvk: "12345678",
  agreesOpdracht: true,
  agreesInvestering: true,
  agreesTermijnen: true,
  agreesMaandbedrag: true,
  agreesVoorwaarden: true,
  agreesBevoegd: true,
};

{
  const [admin] = await db
    .insert(schema.users)
    .values({ email: "admin@dogware.test", naam: "Beheerder", role: "SUPER_ADMIN", status: "ACTIVE" })
    .returning();
  await db.insert(schema.userRoles).values({ userId: admin.id, role: "SUPER_ADMIN" });
  await db.insert(schema.sessions).values({
    userId: admin.id,
    tokenHash: hashToken(ADMIN_TOKEN),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
}

after(() => {
  delete (globalThis as Record<string, unknown>).__testDb;
  delete (globalThis as Record<string, unknown>).__testCookies;
  delete (globalThis as Record<string, unknown>).__fakeMollie;
});

/** Een demo-klant met een verstuurd voorstel, via de echte adminacties. */
async function demoKlantMetVoorstel(naam: string) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: naam,
      naam: "Klant Voorbeeld",
      email: `${naam.toLowerCase().replace(/\W/g, "")}@voorbeeld.test`,
      plaats: "Utrecht",
      journeyVariant: "demo",
      source: "handmatig",
    })
    .returning();

  alsAdmin();
  const opgeslagen = await acties.saveCommerceConfig(
    IDLE,
    formulier({
      leadId: lead.id,
      project: "2000",
      setup: "0",
      discountType: "none",
      discountValue: "0",
      vat: "21",
      depositPercent: "50",
      monthly: "49",
      freeMonths: "0",
      introPercent: "0",
      introMonths: "0",
      startRule: "na-oplevering",
      paymentPlan: "50-50",
      installmentCount: "6",
      installmentStart: "bij-akkoord",
    }),
  );
  assert.equal(opgeslagen.status, "success", opgeslagen.message);
  assert.equal((await acties.createProposalDraft(IDLE, formulier({ leadId: lead.id }))).status, "success");
  const verstuurd = await acties.sendProposal(IDLE, formulier({ leadId: lead.id }));
  assert.equal(verstuurd.status, "success", verstuurd.message);
  alsKlant();

  const [commerce] = await db.select().from(schema.commerce).where(eq(schema.commerce.leadId, lead.id));
  return { lead, commerce, token: commerce.portalToken! };
}

/** De klok verzetten zonder de klok te verzetten: de vervaldatum naar het verleden. */
async function laatVerlopen(commerceId: string) {
  await db
    .update(schema.proposals)
    .set({ geldigTot: new Date(Date.now() - 2 * 86_400_000) })
    .where(eq(schema.proposals.commerceId, commerceId));
}

const voorstelVan = async (commerceId: string) => (await getActiveProposal(commerceId))!;
const betalingenVan = (commerceId: string) =>
  db.select().from(schema.payments).where(eq(schema.payments.commerceId, commerceId));
const eventsVan = (leadId: string, kind: string) =>
  db
    .select()
    .from(schema.journeyEvents)
    .where(and(eq(schema.journeyEvents.leadId, leadId), eq(schema.journeyEvents.kind, kind)));

async function start(token: string, soort: "deposit" | "final" | "termijn" = "deposit") {
  alsKlant();
  const res = await acties.startPayment(token, soort);
  assert.equal(res.status, "success", res.message);
  return res.checkoutUrl!.split("/").pop()!;
}

const KLANTEN = {
  /** Geaccepteerd vlak vóór de vervaldatum, tekent en betaalt de dag erna. */
  LAAT: await demoKlantMetVoorstel("Laat Akkoord Kattenhotel"),
  /** Verloopt vóór acceptatie; de beheerder verlengt. */
  VERLOPEN: await demoKlantMetVoorstel("Verlopen Trimsalon"),
  /** Voor de betaal-randgevallen. */
  BETAAL: await demoKlantMetVoorstel("Betaal Uitlaatservice"),
  /** Een ander dossier, voor de isolatie. */
  ANDER: await demoKlantMetVoorstel("Ander Hondenpension"),
};

/* =========================================================================
 * 1. Geaccepteerd voorstel blijft de basis, ook na de geldigheidsdatum
 * ========================================================================= */

describe("geaccepteerd vlak vóór de vervaldatum → de dag erna tekenen en betalen", () => {
  const k = KLANTEN.LAAT;

  it("een geldig voorstel kan worden geaccepteerd, met naam, moment, versie en audit", async () => {
    const p = await voorstelVan(k.commerce.id);
    alsKlant();
    const res = await acties.acceptProposal(k.token, "Annet Voorbeeld", p.version);
    assert.equal(res.status, "success", res.message);
    const na = await voorstelVan(k.commerce.id);
    assert.equal(na.status, "ACCEPTED");
    assert.equal(na.acceptedName, "Annet Voorbeeld");
    assert.ok(na.acceptedAt);
    assert.ok(na.acceptedIpHash);
    assert.equal((await eventsVan(k.lead.id, "proposal_accepted")).length, 1);
    assert.ok(await getCurrentAgreement(k.commerce.id), "de overeenkomst staat meteen klaar");
  });

  it("nog een keer akkoord (dubbelklik/refresh) verandert niets en mailt niet opnieuw", async () => {
    const p = await voorstelVan(k.commerce.id);
    const mailsVoor = mailsAan(k.lead.email, "proposal-accepted").length;
    const res = await Promise.all([
      acties.acceptProposal(k.token, "Iemand Anders", p.version),
      acties.acceptProposal(k.token, "Iemand Anders", p.version),
    ]);
    assert.ok(res.every((r) => r.status === "success"));
    assert.equal((await voorstelVan(k.commerce.id)).acceptedName, "Annet Voorbeeld");
    assert.equal((await eventsVan(k.lead.id, "proposal_accepted")).length, 1);
    assert.equal(mailsAan(k.lead.email, "proposal-accepted").length, mailsVoor);
  });

  it("de geldigheidsdatum verstrijkt — het klantportaal toont géén 'verlopen'", async () => {
    await laatVerlopen(k.commerce.id);
    const p = await voorstelVan(k.commerce.id);
    const weergave = voorstelVoorKlant(p, readPricing(p, k.commerce), { direct: false, token: k.token, pad: "" });
    assert.equal(weergave.verlopen, false);
    assert.equal(weergave.geaccepteerd, true);
  });

  it("de overeenkomst is te tekenen na de geldigheidsdatum (ook als de klant de pagina eerst opende)", async () => {
    const agreement = (await getCurrentAgreement(k.commerce.id))!;
    // Openen van de pagina zet VIEWED; tekenen moet dan nog steeds kunnen.
    await db.update(schema.agreements).set({ status: "VIEWED", viewedAt: new Date() }).where(eq(schema.agreements.id, agreement.id));
    alsKlant();
    const res = await acties.signAgreement(k.token, { ...TEKEN, agreementId: agreement.id });
    assert.equal(res.status, "success", res.message);
    const getekend = (await getCurrentAgreement(k.commerce.id))!;
    assert.equal(getekend.status, "SIGNED");
    assert.equal(getekend.signerName, TEKEN.naam);
    assert.equal(getekend.proposalVersion, (await voorstelVan(k.commerce.id)).version);
    assert.ok(getekend.signedIpHash && getekend.signedAt);
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, k.lead.id));
    assert.equal(lead.stage, "aanbetaling");
  });

  it("de eerste termijn: bedrag server-side uit de getekende overeenkomst, juiste koppelingen", async () => {
    const id = await start(k.token);
    const [b] = await betalingenVan(k.commerce.id);
    const agreement = (await getCurrentAgreement(k.commerce.id))!;
    const verwacht = agreementPricing(agreement).betaalregeling!.termijnen[0].inclVatCents;
    assert.equal(b.amountCents, verwacht);
    // € 2.000 excl. → € 2.420 incl. 21% btw → 50% = € 1.210
    assert.equal(b.amountCents, 121_000);
    assert.equal(mollieBetalingen.get(id)?.amount.value, "1210.00");
    assert.equal(b.type, "DEPOSIT");
    assert.equal(b.agreementId, agreement.id);
    assert.equal(b.proposalId, agreement.proposalId);
    assert.equal(b.commerceId, k.commerce.id);
    assert.equal(mollieBetalingen.get(id)?.metadata?.commerceId, k.commerce.id);
    assert.equal(mollieBetalingen.get(id)?.metadata?.paymentId, b.id);
    assert.match(mollieBetalingen.get(id)?.redirectUrl ?? "", new RegExp(`/traject/${k.token}/betaald$`));
  });

  it("betaald via iDEAL → webhook (meerdere keren) → één factuur, bouwfase, één mail", async () => {
    const [b] = await betalingenVan(k.commerce.id);
    mollieZet(b.molliePaymentId!, "paid");
    await Promise.all([processPaymentByMollieId(b.molliePaymentId!), processPaymentByMollieId(b.molliePaymentId!)]);
    await processPaymentByMollieId(b.molliePaymentId!);
    const [na] = await betalingenVan(k.commerce.id);
    assert.equal(na.status, "PAID");
    assert.equal(na.method, "ideal");
    const facturen = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, b.id));
    assert.equal(facturen.length, 1);
    assert.equal(mailsAan(k.lead.email, "deposit-received").length, 1);
    assert.equal((await eventsVan(k.lead.id, "deposit_paid")).length, 1);
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.status, "BUILDING");
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, k.lead.id));
    assert.equal(lead.stage, "gestart");
  });

  it("een betaalde termijn is nooit opnieuw betaalbaar", async () => {
    alsKlant();
    const res = await acties.startPayment(k.token, "deposit");
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /al voldaan/);
    assert.equal((await betalingenVan(k.commerce.id)).length, 1);
  });
});

/* =========================================================================
 * 2. Verlopen vóór acceptatie → beheerder verlengt → klant kan meteen verder
 * ========================================================================= */

describe("verlopen vóór acceptatie, daarna verlengd", () => {
  const k = KLANTEN.VERLOPEN;

  it("verlopen: accepteren weigert met een menselijke melding", async () => {
    await laatVerlopen(k.commerce.id);
    const p = await voorstelVan(k.commerce.id);
    const weergave = voorstelVoorKlant(p, readPricing(p, k.commerce), { direct: false, token: k.token, pad: "" });
    assert.equal(weergave.verlopen, true);
    alsKlant();
    const res = await acties.acceptProposal(k.token, "Klant Voorbeeld", p.version);
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /niet meer actief/);
    assert.doesNotMatch(res.message ?? "", /expired|invalid/i);
  });

  it("de beheerder ziet het als eigen actie en kan geen herinnering naar een dode pagina sturen", async () => {
    alsAdmin();
    const res = await acties.sendReminder(IDLE, formulier({ leadId: k.lead.id, soort: "voorstel" }));
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /Verleng eerst de geldigheid/);
  });

  it("verlengen naar het verleden of voor een ander dossier kan niet", async () => {
    alsAdmin();
    const p = await voorstelVan(k.commerce.id);
    const gisteren = dagenLater(vandaag(), -1);
    const r1 = await acties.extendProposalValidity(IDLE, formulier({ leadId: k.lead.id, proposalId: p.id, geldigTot: gisteren }));
    assert.equal(r1.status, "error");
    const ander = await voorstelVan(KLANTEN.ANDER.commerce.id);
    const r2 = await acties.extendProposalValidity(
      IDLE,
      formulier({ leadId: k.lead.id, proposalId: ander.id, geldigTot: dagenLater(vandaag(), 14) }),
    );
    assert.equal(r2.status, "error");
    assert.match(r2.message ?? "", /hoort niet bij deze aanvraag/);
    const anderNa = await voorstelVan(KLANTEN.ANDER.commerce.id);
    assert.equal(anderNa.geldigTot?.getTime(), ander.geldigTot?.getTime(), "het andere dossier is onaangeroerd");
  });

  it("zonder adminsessie kan niemand verlengen", async () => {
    alsKlant();
    const p = await voorstelVan(k.commerce.id);
    const res = await acties.extendProposalValidity(
      IDLE,
      formulier({ leadId: k.lead.id, proposalId: p.id, geldigTot: dagenLater(vandaag(), 14) }),
    );
    assert.equal(res.status, "error");
  });

  it("verlengen: alleen de datum verandert; inhoud, versie en prijzen blijven exact gelijk", async () => {
    const voor = await voorstelVan(k.commerce.id);
    alsAdmin();
    const res = await acties.extendProposalValidity(
      IDLE,
      formulier({ leadId: k.lead.id, proposalId: voor.id, geldigTot: dagenLater(vandaag(), 14), mailKlant: "on" }),
    );
    assert.equal(res.status, "success", res.message);
    const na = await voorstelVan(k.commerce.id);
    assert.equal(na.id, voor.id);
    assert.equal(na.version, voor.version);
    assert.deepEqual(na.pricing, voor.pricing);
    assert.equal(na.titel, voor.titel);
    assert.equal(kalenderdag(na.geldigTot!), dagenLater(vandaag(), 14));
    const [event] = await eventsVan(k.lead.id, "proposal_validity_changed");
    assert.ok(event, "de wijziging staat op de tijdlijn");
    assert.equal(event.actor, "admin");
    const mail = mailsAan(k.lead.email, "proposal-reminder").at(-1);
    assert.match(mail?.vars?.extra ?? "", /geldig tot en met/);
    const [audit] = await db.select().from(schema.activityLog).where(eq(schema.activityLog.action, "PROPOSAL_VALIDITY_CHANGED"));
    assert.ok(audit, "en in het auditlog");
  });

  it("na verlengen kan de klant meteen accepteren, en daarna tekenen en betalen", async () => {
    const p = await voorstelVan(k.commerce.id);
    alsKlant();
    assert.equal((await acties.acceptProposal(k.token, "Klant Voorbeeld", p.version)).status, "success");
    assert.equal((await acties.signAgreement(k.token, TEKEN)).status, "success");
    await start(k.token);
  });

  it("een geaccepteerd voorstel is niet meer te verlengen (de datum doet dan niet meer mee)", async () => {
    alsAdmin();
    const p = await voorstelVan(k.commerce.id);
    const res = await acties.extendProposalValidity(
      IDLE,
      formulier({ leadId: k.lead.id, proposalId: p.id, geldigTot: dagenLater(vandaag(), 20) }),
    );
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /al geaccepteerd/);
  });
});

/* =========================================================================
 * 3. Versies: nooit stilzwijgend iets anders accepteren of tekenen
 * ========================================================================= */

describe("versies", () => {
  const k = KLANTEN.ANDER;

  it("een nieuwe versie van een verlopen voorstel krijgt een verse geldigheid", async () => {
    await laatVerlopen(k.commerce.id);
    alsAdmin();
    const lead = (await db.select().from(schema.leads).where(eq(schema.leads.id, k.lead.id)))[0];
    const draft = await createOrGetDraft(k.commerce, lead, null);
    assert.ok(draft);
    assert.ok(draft.geldigTot!.getTime() > Date.now() + 25 * 86_400_000);
    assert.equal(kalenderdag(draft.geldigTot!), dagenLater(vandaag(), 30));
  });

  it("versturen met een datum in het verleden weigert", async () => {
    alsAdmin();
    const draft = await db.select().from(schema.proposals).where(and(eq(schema.proposals.commerceId, k.commerce.id), eq(schema.proposals.status, "DRAFT")));
    await db.update(schema.proposals).set({ geldigTot: new Date(Date.now() - 86_400_000) }).where(eq(schema.proposals.id, draft[0].id));
    const res = await acties.sendProposal(IDLE, formulier({ leadId: k.lead.id }));
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /in het verleden/);
    await acties.saveProposalDraft(k.lead.id, { geldigTot: dagenLater(vandaag(), 10) });
    const ok = await acties.sendProposal(IDLE, formulier({ leadId: k.lead.id }));
    assert.equal(ok.status, "success", ok.message);
  });

  it("de opgeslagen datum uit de editor is het einde van die dag in Nederland", async () => {
    const p = await voorstelVan(k.commerce.id);
    assert.equal(kalenderdag(p.geldigTot!), dagenLater(vandaag(), 10));
  });

  it("akkoord op een oude versie (oude tab) accepteert de nieuwe niet stilzwijgend", async () => {
    const nieuw = await voorstelVan(k.commerce.id);
    assert.equal(nieuw.version, 2);
    alsKlant();
    const res = await acties.acceptProposal(k.token, "Klant Voorbeeld", 1);
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /nieuwere versie/);
    assert.equal((await voorstelVan(k.commerce.id)).acceptedAt, null);
  });

  it("tekenen van een overeenkomst die intussen vervangen is, weigert", async () => {
    alsKlant();
    const nieuw = await voorstelVan(k.commerce.id);
    assert.equal((await acties.acceptProposal(k.token, "Klant Voorbeeld", nieuw.version)).status, "success");
    const res = await acties.signAgreement(k.token, { ...TEKEN, agreementId: "00000000-0000-0000-0000-000000000000" });
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /bijgewerkt/);
    assert.notEqual((await getCurrentAgreement(k.commerce.id))?.status, "SIGNED");
  });

  it("een dubbele klik op tekenen levert één handtekening, één document, één tijdlijnregel", async () => {
    alsKlant();
    const agreement = (await getCurrentAgreement(k.commerce.id))!;
    const res = await Promise.all([
      acties.signAgreement(k.token, { ...TEKEN, agreementId: agreement.id }),
      acties.signAgreement(k.token, { ...TEKEN, agreementId: agreement.id }),
    ]);
    assert.ok(res.every((r) => r.status === "success"), JSON.stringify(res));
    const getekend = await db.select().from(schema.agreements).where(and(eq(schema.agreements.commerceId, k.commerce.id), eq(schema.agreements.status, "SIGNED")));
    assert.equal(getekend.length, 1);
    assert.equal((await eventsVan(k.lead.id, "agreement_signed")).length, 1);
    const docs = await db.select().from(schema.documents).where(and(eq(schema.documents.commerceId, k.commerce.id), eq(schema.documents.type, "AGREEMENT")));
    assert.equal(docs.length, 1);
    // En een refresh daarna: nog steeds één.
    assert.equal((await acties.signAgreement(k.token, TEKEN)).status, "success");
    assert.equal((await eventsVan(k.lead.id, "agreement_signed")).length, 1);
  });
});

/* =========================================================================
 * 4. iDEAL / Mollie — de randgevallen
 * ========================================================================= */

describe("Mollie: aanmaken, annuleren, pending, retries, terugkeer", () => {
  const k = KLANTEN.BETAAL;

  it("voorbereiding: akkoord en getekend", async () => {
    alsKlant();
    const p = await voorstelVan(k.commerce.id);
    assert.equal((await acties.acceptProposal(k.token, "Klant Voorbeeld", p.version)).status, "success");
    assert.equal((await acties.signAgreement(k.token, TEKEN)).status, "success");
  });

  it("Mollie faalt bij aanmaken → nette melding, poging FAILED, opnieuw proberen lukt", async () => {
    aanmakenFaalt = true;
    alsKlant();
    const res = await acties.startPayment(k.token, "deposit");
    aanmakenFaalt = false;
    assert.equal(res.status, "error");
    assert.doesNotMatch(res.message ?? "", /undefined|null|Error/);
    const [mislukt] = await betalingenVan(k.commerce.id);
    assert.equal(mislukt.status, "FAILED");
    await start(k.token);
  });

  it("dubbelklik / oude betaallink: dezelfde checkout, geen tweede betaling", async () => {
    const a = await start(k.token);
    const tegelijk = await Promise.all([acties.startPayment(k.token, "deposit"), acties.startPayment(k.token, "deposit")]);
    assert.ok(tegelijk.every((r) => r.status === "success"));
    assert.ok(tegelijk.every((r) => r.checkoutUrl?.endsWith(a)));
    const lopend = (await betalingenVan(k.commerce.id)).filter((p) => ["CREATED", "OPEN", "PENDING"].includes(p.status));
    assert.equal(lopend.length, 1);
  });

  it("klant annuleert bij Mollie; webhook twee keer → één tijdlijnregel, nieuwe poging mogelijk", async () => {
    const [open] = (await betalingenVan(k.commerce.id)).filter((p) => p.status === "OPEN");
    mollieZet(open.molliePaymentId!, "canceled");
    await processPaymentByMollieId(open.molliePaymentId!);
    await processPaymentByMollieId(open.molliePaymentId!);
    assert.equal((await eventsVan(k.lead.id, "payment_failed")).length, 1);
    const id = await start(k.token);
    assert.notEqual(id, open.molliePaymentId);
  });

  it("checkout verlopen zonder webhook → bij een nieuwe poging eerst bij Mollie gecontroleerd", async () => {
    const [open] = (await betalingenVan(k.commerce.id)).filter((p) => p.status === "OPEN");
    mollieZet(open.molliePaymentId!, "expired"); // webhook nooit aangekomen
    const id = await start(k.token);
    assert.notEqual(id, open.molliePaymentId);
    const [oud] = (await betalingenVan(k.commerce.id)).filter((p) => p.id === open.id);
    assert.equal(oud.status, "EXPIRED");
    assert.equal((await eventsVan(k.lead.id, "payment_failed")).length, 2, "ook dit staat op de tijdlijn");
  });

  it("pending bij de bank: één interne tijdlijnregel, geen tweede betaling", async () => {
    const [open] = (await betalingenVan(k.commerce.id)).filter((p) => p.status === "OPEN");
    mollieZet(open.molliePaymentId!, "pending");
    await processPaymentByMollieId(open.molliePaymentId!);
    await processPaymentByMollieId(open.molliePaymentId!);
    const pending = await eventsVan(k.lead.id, "payment_pending");
    assert.equal(pending.length, 1);
    assert.equal(pending[0].internal, true);
    alsKlant();
    const res = await acties.startPayment(k.token, "deposit");
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /nog verwerkt/);
  });

  it("terugkeer vóór de webhook: de terugkeerpagina verifieert bij Mollie; de webhook daarna doet niets dubbel", async () => {
    const [lopend] = (await betalingenVan(k.commerce.id)).filter((p) => p.status === "PENDING");
    mollieZet(lopend.molliePaymentId!, "paid");
    // Wat /traject/[token]/betaald doet bij een nog openstaande betaling:
    await processPaymentByMollieId(lopend.molliePaymentId!);
    const [na] = (await betalingenVan(k.commerce.id)).filter((p) => p.id === lopend.id);
    assert.equal(na.status, "PAID");
    // De webhook komt daarna alsnog (en nog eens).
    await processPaymentByMollieId(lopend.molliePaymentId!);
    await processPaymentByMollieId(lopend.molliePaymentId!);
    assert.equal(mailsAan(k.lead.email, "deposit-received").length, 1);
    const facturen = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, lopend.id));
    assert.equal(facturen.length, 1);
  });

  it("een al betaalde termijn opnieuw betalen kan niet", async () => {
    alsKlant();
    const res = await acties.startPayment(k.token, "deposit");
    assert.equal(res.status, "error");
  });

  it("de terugkeer zelf is geen bewijs: een onbekend Mollie-id verandert niets", async () => {
    const voor = (await betalingenVan(k.commerce.id)).map((p) => p.status).join();
    await processPaymentByMollieId("tr_bestaatniet");
    assert.equal((await betalingenVan(k.commerce.id)).map((p) => p.status).join(), voor);
  });
});

describe("een onderbroken betaalpoging blokkeert de klant niet voorgoed", () => {
  it("een verse poging wordt gerespecteerd, een oude (Mollie nooit bereikt) wordt vrijgegeven", async () => {
    const k = await demoKlantMetVoorstel("Onderbroken Dierenarts");
    alsKlant();
    const p = await voorstelVan(k.commerce.id);
    await acties.acceptProposal(k.token, "Klant Voorbeeld", p.version);
    await acties.signAgreement(k.token, TEKEN);
    const agreement = (await getCurrentAgreement(k.commerce.id))!;
    const [termijn] = await db
      .select()
      .from(schema.paymentInstallments)
      .where(eq(schema.paymentInstallments.agreementId, agreement.id));
    const [hangend] = await db
      .insert(schema.payments)
      .values({
        commerceId: k.commerce.id,
        type: "DEPOSIT",
        amountCents: termijn.amountInclVatCents,
        status: "CREATED",
        agreementId: agreement.id,
        installmentId: termijn.id,
      })
      .returning();

    const vers = await acties.startPayment(k.token, "deposit");
    assert.equal(vers.status, "error");
    assert.match(vers.message ?? "", /moment geduld/);

    await db.update(schema.payments).set({ createdAt: new Date(Date.now() - 10 * 60_000) }).where(eq(schema.payments.id, hangend.id));
    await start(k.token);
    const [oud] = (await betalingenVan(k.commerce.id)).filter((b) => b.id === hangend.id);
    assert.equal(oud.status, "FAILED");
  });
});

/* =========================================================================
 * 5. Isolatie tussen dossiers
 * ========================================================================= */

describe("isolatie tussen dossiers", () => {
  it("een verzonnen of verkeerde sleutel geeft nergens toegang", async () => {
    alsKlant();
    const nep = randomBytes(32).toString("base64url");
    assert.equal((await acties.acceptProposal(nep, "Iemand")).status, "error");
    assert.equal((await acties.signAgreement(nep, TEKEN)).status, "error");
    assert.equal((await acties.startPayment(nep, "deposit")).status, "error");
  });

  it("met de sleutel van dossier A gebeurt alles in dossier A", async () => {
    const a = KLANTEN.LAAT;
    const b = KLANTEN.BETAAL;
    const voorB = (await betalingenVan(b.commerce.id)).length;
    alsKlant();
    await acties.startPayment(a.token, "deposit");
    assert.equal((await betalingenVan(b.commerce.id)).length, voorB);
  });

  it("een ingelogde andere klant krijgt met een gelekte link geen toegang", async () => {
    const token = randomBytes(24).toString("base64url");
    const [u] = await db
      .insert(schema.users)
      .values({ email: "vreemde@voorbeeld.test", naam: "Vreemde", role: "CUSTOMER", status: "ACTIVE" })
      .returning();
    await db.insert(schema.sessions).values({ userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
    (globalThis as Record<string, unknown>).__testCookies = { dw_session: token };
    const res = await acties.acceptProposal(KLANTEN.ANDER.token, "Vreemde");
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /niet \(meer\) geldig/);
    alsKlant();
  });
});
