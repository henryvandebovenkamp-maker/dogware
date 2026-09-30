import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { maakTestDb } from "./test-db.mts";

/**
 * De betaalregeling van begin tot eind, tegen een echte (in-process) Postgres.
 *
 * Geen broncode-grep maar de echte keten: admin stelt de regeling in en
 * verstuurt de opdrachtbevestiging → klant tekent → betaalschema ontstaat →
 * klant betaalt via (nep-)Mollie → webhook verwerkt → factuur, termijn,
 * tijdlijn, mail → volgende termijn → oplevering → abonnement → livegang →
 * laatste termijn. Met de randgevallen: dubbelklik, webhook twee keer (ook
 * gelijktijdig), mislukte betaling, afwijkend bedrag, dubbele betaling, te
 * late termijn, andere klant, en de bestaande 50/50-flow ernaast.
 *
 * Mollie is vervangen door een nepclient die zich gedraagt als de echte API:
 * de webhook haalt de status daar op, net als in productie. Mails gaan naar
 * de recorder in tests/mail-stub.mjs. Er wordt niets echts geraakt.
 *
 * Er zit geen klantnaam in de code; de bedragen van de eerste case (€ 2.500
 * in 6 termijnen) staan hier alleen als voorbeeld.
 */

process.env.MOLLIE_API_KEY = "test_integratie";

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
};
const mollieBetalingen = new Map<string, NepBetaling>();
const mandaten: { id: string; status: string }[] = [];
const abonnementen: Record<string, unknown>[] = [];
let teller = 0;

(globalThis as Record<string, unknown>).__fakeMollie = {
  payments: {
    create: async (p: NepBetaling & { customerId?: string }) => {
      const id = `tr_int${++teller}`;
      mollieBetalingen.set(id, { ...p, id, status: "open" });
      return { id, getCheckoutUrl: () => `https://mollie.test/${id}` };
    },
    get: async (id: string) => {
      const b = mollieBetalingen.get(id);
      if (!b) throw new Error("niet gevonden");
      return { ...b, getCheckoutUrl: () => (b.status === "open" ? `https://mollie.test/${id}` : null) };
    },
  },
  customers: {
    get: async (id: string) => ({ id }),
    create: async () => ({ id: "cst_int" }),
  },
  customerMandates: { page: async () => mandaten },
  customerSubscriptions: {
    page: async () => [],
    create: async (p: Record<string, unknown>) => {
      abonnementen.push(p);
      return { id: `sub_int${abonnementen.length}` };
    },
  },
};

/** Zet een betaling bij "Mollie" op een status, zoals de bank dat zou doen. */
function mollieZet(id: string, status: string, extra: Partial<NepBetaling> = {}) {
  const b = mollieBetalingen.get(id);
  assert.ok(b, `onbekende Mollie-betaling ${id}`);
  b.status = status;
  if (status === "paid") {
    b.method = "ideal";
    if (b.sequenceType === "first") {
      b.mandateId = "mdt_int";
      if (!mandaten.length) mandaten.push({ id: "mdt_int", status: "valid" });
    }
  }
  Object.assign(b, extra);
}

const mails = () =>
  ((globalThis as Record<string, unknown>).__verzondenMails as { type: string; vars?: Record<string, string> }[]) ?? [];
const mailsVan = (type: string) => mails().filter((m) => m.type === type);

/* ------------------------------------------------------------- opzetten -- */

const { db } = await maakTestDb();
const { schema } = await import("../lib/db/index.ts");
const acties = await import("../app/actions/commerce.ts");
const { processPaymentByMollieId } = await import("../lib/commerce.ts");
const { scheduleForCommerce, loadSchemaWeergave } = await import("../lib/payment-schedule.ts");
const { runTermijnRonde } = await import("../lib/payment-reminders.ts");
const { nextAction } = await import("../lib/journey-next.ts");
const { regelingStand, termijnStatus } = await import("../lib/payment-plan.ts");
const { hashToken } = await import("../lib/auth/crypto.ts");

const IDLE = { status: "idle" as const };
const ADMIN_TOKEN = randomBytes(24).toString("base64url");

function alsAdmin() {
  (globalThis as Record<string, unknown>).__testCookies = { dw_session: ADMIN_TOKEN };
}
function alsKlant() {
  (globalThis as Record<string, unknown>).__testCookies = {};
}
function formulier(velden: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(velden)) fd.set(k, v);
  return fd;
}

const TEKEN = {
  naam: "Test Ondertekenaar",
  functie: "Eigenaar",
  email: "klant@voorbeeld.test",
  telefoon: "0600000000",
  bedrijfsnaam: "Voorbeeld Hondenbedrijf",
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

// Bovenaan en niet in before(): de describe-blokken bouwen hun klant al tijdens het opzetten.
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

/**
 * Een nieuwe klant met een afspraak, tot en met een verstuurde
 * opdrachtbevestiging. Loopt via de echte adminacties.
 */
async function klantMetOpdracht(opties: {
  plan: "50-50" | "volledig" | "termijnen";
  aantal?: number;
  projectCents?: number;
  monthlyCents?: number;
  naam: string;
}) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: opties.naam,
      naam: "Klant Voorbeeld",
      email: `${opties.naam.toLowerCase().replace(/\W/g, "")}@voorbeeld.test`,
      plaats: "Utrecht",
      journeyVariant: "direct",
      source: "handmatig",
    })
    .returning();

  alsAdmin();
  const opgeslagen = await acties.saveCommerceConfig(
    IDLE,
    formulier({
      leadId: lead.id,
      project: String((opties.projectCents ?? 250_000) / 100),
      setup: "0",
      discountType: "none",
      discountValue: "0",
      vat: "21",
      depositPercent: "50",
      monthly: String((opties.monthlyCents ?? 18_000) / 100),
      freeMonths: "0",
      introPercent: "0",
      introMonths: "0",
      startRule: "na-oplevering",
      paymentPlan: opties.plan,
      installmentCount: String(opties.aantal ?? 6),
      installmentStart: "bij-akkoord",
    }),
  );
  assert.equal(opgeslagen.status, "success", opgeslagen.message);
  const aangemaakt = await acties.createProposalDraft(IDLE, formulier({ leadId: lead.id }));
  assert.equal(aangemaakt.status, "success", aangemaakt.message);
  const verstuurd = await acties.sendProposal(IDLE, formulier({ leadId: lead.id }));
  assert.equal(verstuurd.status, "success", verstuurd.message);
  alsKlant();

  const [commerce] = await db
    .select()
    .from(schema.commerce)
    .where(eq(schema.commerce.leadId, lead.id));
  return { lead, commerce, token: commerce.portalToken! };
}

async function betalingenVan(commerceId: string) {
  return db.select().from(schema.payments).where(eq(schema.payments.commerceId, commerceId));
}

/** Start een betaling als klant en geef het Mollie-id terug. */
async function start(token: string, soort: "deposit" | "final" | "termijn") {
  alsKlant();
  const res = await acties.startPayment(token, soort);
  assert.equal(res.status, "success", res.message);
  assert.ok(res.checkoutUrl);
  return res.checkoutUrl!.split("/").pop()!;
}

/** Laat een termijn "vervallen" door de klok te verzetten: vervaldatum = nu + dagen. */
async function zetVervaldatum(commerceId: string, volgnummer: number, dagenVanafNu: number) {
  await db
    .update(schema.paymentInstallments)
    .set({ dueAt: new Date(Date.now() + dagenVanafNu * 86_400_000) })
    .where(
      and(
        eq(schema.paymentInstallments.commerceId, commerceId),
        eq(schema.paymentInstallments.volgnummer, volgnummer),
      ),
    );
}

/*
 * Alle klanten vooraf en één voor één. node:test bouwt describe-blokken
 * tegelijk op; de sessiecookie en de mailrecorder zijn gedeeld, dus opzetten
 * in de blokken zelf zou door elkaar lopen.
 */
const KLANTEN = {
  ZES: await klantMetOpdracht({ plan: "termijnen", aantal: 6, naam: "Termijnen Hondenschool" }),
  A: await klantMetOpdracht({ plan: "termijnen", aantal: 3, naam: "Klant A" }),
  B: await klantMetOpdracht({ plan: "termijnen", aantal: 3, naam: "Klant B" }),
  VOLLEDIG: await klantMetOpdracht({ plan: "volledig", naam: "Volledig Uitlaatservice" }),
  NIEUW5050: await klantMetOpdracht({ plan: "50-50", naam: "Nieuw Vijftig Trimsalon" }),
  HISTORISCH: await klantMetOpdracht({ plan: "50-50", naam: "Historisch Pension" }),
  VIJF: await klantMetOpdracht({ plan: "termijnen", aantal: 5, naam: "Vijf Termijnen Kennel" }),
};

/* =========================================================================
 * 1. Zes termijnen — de volledige keten
 * ========================================================================= */

describe("zes termijnen: van opdrachtbevestiging tot laatste termijn", () => {
  const k = KLANTEN.ZES;

  it("de verstuurde versie bevat het bevroren schema, exact € 2.500", async () => {
    const [p] = await db.select().from(schema.proposals).where(eq(schema.proposals.commerceId, k.commerce.id));
    const r = (p.pricing as { betaalregeling: { termijnen: { exVatCents: number; inclVatCents: number }[] } })
      .betaalregeling;
    assert.deepEqual(r.termijnen.map((t) => t.exVatCents), [41_667, 41_667, 41_667, 41_667, 41_667, 41_665]);
    assert.equal(r.termijnen.reduce((s, t) => s + t.exVatCents, 0), 250_000);
    assert.equal(r.termijnen.reduce((s, t) => s + t.inclVatCents, 0), 302_500);
    const mail = mailsVan("agreement-ready").find((m) => (m as { to?: string }).to === k.lead.email);
    assert.match(mail?.vars?.regeling ?? "", /zes maandelijkse termijnen/);
    const historisch = mailsVan("agreement-ready").find(
      (m) => (m as { to?: string }).to === KLANTEN.NIEUW5050.lead.email,
    );
    assert.deepEqual(historisch?.vars, {}, "bij 50/50 blijft de mail zoals hij was");
  });

  it("vóór ondertekening kan er niet betaald worden", async () => {
    alsKlant();
    const res = await acties.startPayment(k.token, "deposit");
    assert.equal(res.status, "error");
    assert.equal((await betalingenVan(k.commerce.id)).length, 0);
  });

  it("ondertekenen legt het schema vast: 6 termijnen, maandelijks, met akkoord op de regeling", async () => {
    alsKlant();
    const res = await acties.signAgreement(k.token, TEKEN);
    assert.equal(res.status, "success", res.message);
    const rijen = await scheduleForCommerce(k.commerce.id);
    assert.equal(rijen.length, 6);
    assert.deepEqual(rijen.map((r) => r.amountInclVatCents), [50_417, 50_417, 50_417, 50_417, 50_417, 50_415]);
    // Kalendermaanden, niet "+30 dagen": dezelfde dag van de maand (of de laatste).
    const dagen = rijen.map((r) => r.dueAt!.getUTCDate());
    const eerste = dagen[0];
    for (const [i, d] of dagen.entries()) {
      const m = rijen[i].dueAt!;
      const laatsteDag = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
      assert.equal(d, Math.min(eerste, laatsteDag));
    }
    const [event] = await db
      .select()
      .from(schema.journeyEvents)
      .where(and(eq(schema.journeyEvents.leadId, k.lead.id), eq(schema.journeyEvents.kind, "payment_plan_agreed")));
    assert.ok(event, "het akkoord op de regeling staat op de tijdlijn");
    assert.equal(mailsVan("agreement-signed").at(-1)?.vars?.amount?.replace(/ /g, " "), "€ 504,17");
  });

  it("nog een keer tekenen maakt niets dubbel", async () => {
    alsKlant();
    await acties.signAgreement(k.token, TEKEN);
    assert.equal((await scheduleForCommerce(k.commerce.id)).length, 6);
  });

  it("een dubbelklik levert één betaling en dezelfde checkout op", async () => {
    const a = await start(k.token, "termijn"); // termijn 1 loopt via de aanbetaling
    const b = await start(k.token, "deposit");
    assert.equal(a, b);
    const tegelijk = await Promise.all([
      acties.startPayment(k.token, "deposit"),
      acties.startPayment(k.token, "deposit"),
    ]);
    assert.ok(tegelijk.every((r) => r.status === "success"));
    const actief = (await betalingenVan(k.commerce.id)).filter((p) => ["CREATED", "OPEN", "PENDING"].includes(p.status));
    assert.equal(actief.length, 1, "hooguit één lopende betaling per termijn");
    assert.equal(actief[0].amountCents, 50_417, "bedrag komt uit het getekende schema");
    assert.equal(actief[0].type, "DEPOSIT");
    assert.equal(actief[0].sequenceType, "first", "het mandaat ontstaat bij de eerste betaling onder de regeling");
  });

  it("een mislukte betaling: termijn blijft open, klant krijgt een mail en kan opnieuw", async () => {
    const [open] = (await betalingenVan(k.commerce.id)).filter((p) => p.status === "OPEN");
    mollieZet(open.molliePaymentId!, "failed");
    await processPaymentByMollieId(open.molliePaymentId!);
    const [termijn] = await scheduleForCommerce(k.commerce.id);
    assert.equal(termijn.status, "GEPLAND");
    const [poging] = (await betalingenVan(k.commerce.id)).filter((p) => p.id === open.id);
    assert.equal(poging.status, "FAILED");
    assert.equal(termijnStatus({ status: termijn.status, dueAt: termijn.dueAt, laatstePoging: "FAILED" }), "mislukt");
    assert.equal(mailsVan("installment-failed").length, 1);
    const nieuw = await start(k.token, "deposit");
    assert.notEqual(nieuw, open.molliePaymentId);
  });

  it("betaald: webhook twee keer (ook gelijktijdig) → één factuur, één mail, termijn 1 betaald", async () => {
    const [open] = (await betalingenVan(k.commerce.id)).filter((p) => p.status === "OPEN");
    mollieZet(open.molliePaymentId!, "paid");
    const voor = mailsVan("deposit-received").length;
    await Promise.all([processPaymentByMollieId(open.molliePaymentId!), processPaymentByMollieId(open.molliePaymentId!)]);
    await processPaymentByMollieId(open.molliePaymentId!);

    const facturen = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, open.id));
    assert.equal(facturen.length, 1);
    assert.equal(facturen[0].type, "INVOICE_DEPOSIT");
    assert.equal(facturen[0].netExVatCents, 41_667);
    assert.equal(facturen[0].vatCents, 8_750);
    assert.match(facturen[0].titel, /termijn 1 van 6/);
    assert.equal(mailsVan("deposit-received").length, voor + 1);

    const [termijn] = await scheduleForCommerce(k.commerce.id);
    assert.equal(termijn.status, "BETAALD");
    assert.equal(termijn.documentId, facturen[0].id);
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.status, "BUILDING");
    const [l] = await db.select().from(schema.leads).where(eq(schema.leads.id, k.lead.id));
    assert.equal(l.stage, "gestart");
  });

  it("termijn 2 blijft gepland tot hij aan de beurt is", async () => {
    alsKlant();
    const res = await acties.startPayment(k.token, "termijn");
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /kun je betalen vanaf/);
  });

  it("een afwijkend bedrag van Mollie wordt niet als betaald verwerkt", async () => {
    await zetVervaldatum(k.commerce.id, 2, 0);
    const id = await start(k.token, "termijn");
    mollieZet(id, "paid", { amount: { currency: "EUR", value: "1.00" } });
    await processPaymentByMollieId(id);
    const t2 = (await scheduleForCommerce(k.commerce.id))[1];
    assert.equal(t2.status, "GEPLAND");
    const [p] = (await betalingenVan(k.commerce.id)).filter((x) => x.molliePaymentId === id);
    assert.match(p.failureReason ?? "", /Bedrag wijkt af/);
    assert.equal(p.processedAt, null);
    const facturen = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, p.id));
    assert.equal(facturen.length, 0);
    // Opruimen zoals de beheerder dat na controle zou doen.
    await db.update(schema.payments).set({ status: "CANCELED" }).where(eq(schema.payments.id, p.id));
  });

  it("termijn 2 betaald → eigen factuur ‘termijn 2 van 6’ en een ontvangstmail met het restant", async () => {
    const id = await start(k.token, "termijn");
    const [p] = (await betalingenVan(k.commerce.id)).filter((x) => x.molliePaymentId === id);
    assert.equal(p.type, "INSTALLMENT");
    assert.equal(p.amountCents, 50_417);
    mollieZet(id, "paid");
    await processPaymentByMollieId(id);
    await processPaymentByMollieId(id);
    const [factuur] = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, p.id));
    assert.equal(factuur.type, "INVOICE_INSTALLMENT");
    assert.match(factuur.titel, /termijn 2 van 6/);
    const mail = mailsVan("installment-received").at(-1);
    assert.match((mail?.vars?.regeling ?? "").replace(/\u00a0/g, " "), /Nog te betalen: € 1\.666,66 excl\. btw in 4 termijnen/);

    const { weergave } = await loadSchemaWeergave(k.commerce.id, [{ id: factuur.id, nummer: factuur.nummer }]);
    assert.equal(weergave?.voortgang.betaaldAantal, 2);
    assert.equal(weergave?.voortgang.betaaldEx.replace(/ /g, " "), "€ 833,34");
    assert.equal(weergave?.voortgang.openEx.replace(/ /g, " "), "€ 1.666,66");
    assert.equal(weergave?.voortgang.volgende?.exVat.replace(/ /g, " "), "€ 416,67");
  });

  it("een tweede betaling voor dezelfde termijn wordt gemeld, niet stil verwerkt", async () => {
    const t2 = (await scheduleForCommerce(k.commerce.id))[1];
    const [dubbel] = await db
      .insert(schema.payments)
      .values({
        commerceId: k.commerce.id,
        type: "INSTALLMENT",
        status: "OPEN",
        amountCents: 50_417,
        molliePaymentId: "tr_dubbel",
        installmentId: t2.id,
      })
      .returning();
    mollieBetalingen.set("tr_dubbel", { id: "tr_dubbel", status: "paid", amount: { currency: "EUR", value: "504.17" } });
    const voor = mailsVan("installment-received").length;
    await processPaymentByMollieId("tr_dubbel");
    const [event] = await db
      .select()
      .from(schema.journeyEvents)
      .where(and(eq(schema.journeyEvents.leadId, k.lead.id), eq(schema.journeyEvents.kind, "installment_double_payment")));
    assert.ok(event?.internal, "intern gemeld aan de beheerder");
    assert.equal(mailsVan("installment-received").length, voor, "geen tweede bevestiging");
    const na = (await scheduleForCommerce(k.commerce.id))[1];
    assert.notEqual(na.paymentId, dubbel.id, "de termijn blijft aan de eerste betaling hangen");
  });

  it("een te late termijn: één automatische herinnering, en de admin ziet het", async () => {
    await zetVervaldatum(k.commerce.id, 3, -10);
    const voor = mailsVan("installment-reminder").length;
    const r1 = await runTermijnRonde();
    const r2 = await runTermijnRonde();
    assert.equal(r1.herinnerd, 1);
    assert.equal(r2.herinnerd, 0, "nooit twee keer dezelfde herinnering");
    assert.equal(mailsVan("installment-reminder").length, voor + 1);

    const rijen = await scheduleForCommerce(k.commerce.id);
    const stand = regelingStand(rijen);
    const volgende = nextAction(
      {
        stage: "gestart",
        variant: "direct",
        commerceStatus: "BUILDING",
        demoVerstuurd: false,
        demoLinksKlaar: false,
        heeftConcept: false,
        voorstelVerstuurd: true,
        voorstelBekeken: true,
        voorstelGeaccepteerd: true,
        overeenkomstGetekend: true,
        aanbetalingBetaald: true,
        opleveringKlaar: false,
        restbetalingBetaald: false,
        mandaatActief: false,
        live: false,
        heeftAbonnement: true,
        regeling: stand,
      },
      k.lead.id,
    );
    assert.equal(volgende.cta?.action, "termijn-herinneren");
  });

  it("livegang wordt geweigerd zolang een verschuldigde termijn openstaat", async () => {
    alsAdmin();
    const opgeleverd = await acties.markDeliveryReady(IDLE, formulier({ leadId: k.lead.id }));
    assert.equal(opgeleverd.status, "success", opgeleverd.message);
    assert.equal(mailsVan("delivery-ready-plan").length, 1);
    // Het mandaat ontstond bij termijn 1; het abonnement staat nu los ingepland.
    assert.equal(abonnementen.length, 1);
    assert.equal((abonnementen[0].amount as { value: string }).value, "217.80");
    const live = await acties.markWebsiteLive(IDLE, formulier({ leadId: k.lead.id }));
    assert.equal(live.status, "error");
    assert.match(live.message ?? "", /Termijn 3 van 6/);
  });

  it("na de achterstallige termijn mag de website live — met termijnen die nog doorlopen", async () => {
    const id = await start(k.token, "termijn");
    mollieZet(id, "paid");
    await processPaymentByMollieId(id);
    alsAdmin();
    const live = await acties.markWebsiteLive(IDLE, formulier({ leadId: k.lead.id }));
    assert.equal(live.status, "success", live.message);
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.status, "ACTIVE_CUSTOMER");
  });

  it("de laatste termijnen: alles telt exact op, en de afronding meldt zich één keer", async () => {
    for (const n of [4, 5, 6]) {
      await zetVervaldatum(k.commerce.id, n, 0);
      const id = await start(k.token, "termijn");
      mollieZet(id, "paid");
      await processPaymentByMollieId(id);
    }
    const rijen = await scheduleForCommerce(k.commerce.id);
    assert.ok(rijen.every((r) => r.status === "BETAALD"));
    assert.equal(mailsVan("installments-complete").length, 1);
    const alle = (
      await db.select().from(schema.documents).where(eq(schema.documents.commerceId, k.commerce.id))
    ).filter((d) => d.type.startsWith("INVOICE"));
    // De dubbele betaling van hierboven is echt geld en dus ook gefactureerd,
    // zodat de beheerder hem kan crediteren. De termijnen zelf wijzen elk naar
    // precies één factuur.
    assert.equal(alle.length, 7);
    const facturen = alle.filter((d) => rijen.some((r) => r.documentId === d.id));
    assert.equal(facturen.length, 6);
    assert.equal(facturen.reduce((s, d) => s + d.netExVatCents, 0), 250_000);
    assert.equal(facturen.reduce((s, d) => s + d.vatCents, 0), 52_500);
    assert.equal(facturen.reduce((s, d) => s + d.totalInclVatCents, 0), 302_500);
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.status, "ACTIVE_CUSTOMER", "een actieve klant wordt niet teruggezet");
    alsKlant();
    const res = await acties.startPayment(k.token, "termijn");
    assert.equal(res.status, "error");
  });
});

/* =========================================================================
 * 2. Autorisatie en afscherming
 * ========================================================================= */

describe("afscherming tussen klanten en rollen", () => {
  const a = KLANTEN.A;
  const b = KLANTEN.B;

  it("een onbekende of geraden link geeft niets", async () => {
    alsKlant();
    const res = await acties.startPayment("x".repeat(43), "termijn");
    assert.equal(res.status, "error");
    assert.match(res.message ?? "", /niet \(meer\) geldig/);
  });

  it("een klant ziet en betaalt alleen zijn eigen schema", async () => {
    alsKlant();
    await acties.signAgreement(a.token, TEKEN);
    await acties.signAgreement(b.token, TEKEN);
    await start(a.token, "deposit");
    const vanB = await betalingenVan(b.commerce.id);
    assert.equal(vanB.length, 0, "betalen via link A raakt klant B nooit");
    const { rijen } = await loadSchemaWeergave(a.commerce.id, []);
    assert.ok(rijen.every((r) => r.commerceId === a.commerce.id));
  });

  it("adminacties vragen een beheerder", async () => {
    alsKlant();
    const res = await acties.saveCommerceConfig(IDLE, formulier({ leadId: a.lead.id, paymentPlan: "volledig" }));
    assert.equal(res.status, "error");
    assert.equal(res.message, "Geen toegang.");
    const herinnering = await acties.sendReminder(IDLE, formulier({ leadId: a.lead.id, soort: "termijn" }));
    assert.equal(herinnering.message, "Geen toegang.");
  });

  it("een gewijzigde afspraak na ondertekening verandert het getekende schema niet", async () => {
    alsAdmin();
    await acties.saveCommerceConfig(
      IDLE,
      formulier({ leadId: a.lead.id, project: "9999", paymentPlan: "termijnen", installmentCount: "12" }),
    );
    const rijen = await scheduleForCommerce(a.commerce.id);
    assert.equal(rijen.length, 3);
    assert.equal(rijen.reduce((s, r) => s + r.amountExVatCents, 0), 250_000);
    alsKlant();
  });
});

/* =========================================================================
 * 3. Alles ineens, de nieuwe 50/50 en de bestaande (historische) 50/50
 * ========================================================================= */

describe("in één keer", () => {
  const k = KLANTEN.VOLLEDIG;

  it("één betaling van het volledige bedrag, die ook het mandaat vestigt", async () => {
    alsKlant();
    await acties.signAgreement(k.token, TEKEN);
    const rijen = await scheduleForCommerce(k.commerce.id);
    assert.equal(rijen.length, 1);
    assert.equal(rijen[0].amountInclVatCents, 302_500);
    const id = await start(k.token, "deposit");
    const [p] = await betalingenVan(k.commerce.id);
    assert.equal(p.amountCents, 302_500);
    assert.equal(p.sequenceType, "first");
    mollieZet(id, "paid");
    await processPaymentByMollieId(id);
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.status, "FULLY_PAID");
    alsKlant();
    const slot = await acties.startPayment(k.token, "final");
    assert.equal(slot.status, "error", "er is geen slotbetaling bij deze regeling");
  });
});

describe("50/50 — nieuw, met schema", () => {
  const k = KLANTEN.NIEUW5050;

  it("€ 2.500 → twee termijnen van € 1.512,50 incl. (€ 1.250 excl.)", async () => {
    alsKlant();
    await acties.signAgreement(k.token, TEKEN);
    const rijen = await scheduleForCommerce(k.commerce.id);
    assert.deepEqual(rijen.map((r) => r.amountExVatCents), [125_000, 125_000]);
    assert.deepEqual(rijen.map((r) => r.amountInclVatCents), [151_250, 151_250]);
    assert.equal(rijen[1].dueAt, null, "de tweede helft hangt aan de oplevering");
  });

  it("aanbetaling en restbetaling lopen via de bestaande flow en koppelen aan het schema", async () => {
    const id = await start(k.token, "deposit");
    const [p] = await betalingenVan(k.commerce.id);
    assert.equal(p.amountCents, 151_250);
    assert.equal(p.sequenceType, "oneoff", "bij 50/50 bewust géén mandaat bij de eerste termijn");
    mollieZet(id, "paid");
    await processPaymentByMollieId(id);
    alsKlant();
    assert.equal((await acties.startPayment(k.token, "final")).status, "error", "pas na oplevering");
    alsAdmin();
    await acties.markDeliveryReady(IDLE, formulier({ leadId: k.lead.id }));
    assert.ok((await scheduleForCommerce(k.commerce.id))[1].dueAt, "vervaldatum gezet bij oplevering");
    const slot = await start(k.token, "final");
    const [finaal] = (await betalingenVan(k.commerce.id)).filter((x) => x.type === "FINAL_PAYMENT");
    assert.equal(finaal.amountCents, 151_250);
    assert.equal(finaal.sequenceType, "first", "het mandaat ontstaat, zoals altijd, bij de tweede termijn");
    mollieZet(slot, "paid");
    await processPaymentByMollieId(slot);
    const rijen = await scheduleForCommerce(k.commerce.id);
    assert.ok(rijen.every((r) => r.status === "BETAALD"));
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.ok(["FULLY_PAID", "SUBSCRIPTION_SCHEDULED"].includes(c.status));

    // De twee facturen samen sluiten exact op de opdracht, per kolom.
    const facturen = await db.select().from(schema.documents).where(eq(schema.documents.commerceId, k.commerce.id));
    const betaalFacturen = facturen.filter((f) => f.paymentId);
    assert.equal(betaalFacturen.length, 2);
    assert.equal(betaalFacturen.reduce((s, f) => s + f.netExVatCents, 0), 250_000, "som netto");
    assert.equal(betaalFacturen.reduce((s, f) => s + f.vatCents, 0), 52_500, "som btw");
    assert.equal(betaalFacturen.reduce((s, f) => s + f.totalInclVatCents, 0), 302_500, "som incl.");
  });
});

describe("50/50 — bestaande klant van vóór de betaalregelingen", () => {
  const k = KLANTEN.HISTORISCH;

  it("zonder bevroren regeling ontstaat er geen schema en loopt alles zoals altijd", async () => {
    // Zo zien overeenkomsten eruit die vóór deze wijziging zijn verstuurd.
    const [agr] = await db.select().from(schema.agreements).where(eq(schema.agreements.commerceId, k.commerce.id));
    const { betaalregeling: _weg, ...oud } = agr.pricing as Record<string, unknown>;
    void _weg;
    await db.update(schema.agreements).set({ pricing: oud }).where(eq(schema.agreements.id, agr.id));
    await db.update(schema.proposals).set({ pricing: oud }).where(eq(schema.proposals.commerceId, k.commerce.id));

    alsKlant();
    const res = await acties.signAgreement(k.token, TEKEN);
    assert.equal(res.status, "success", res.message);
    assert.equal((await scheduleForCommerce(k.commerce.id)).length, 0);

    const id = await start(k.token, "deposit");
    const [p] = await betalingenVan(k.commerce.id);
    assert.equal(p.amountCents, 151_250, "de oude berekening: 50% van het totaal incl. btw");
    assert.equal(p.installmentId, null);
    assert.equal(p.sequenceType, "oneoff");
    mollieZet(id, "paid");
    await processPaymentByMollieId(id);
    const [factuur] = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, p.id));
    assert.equal(factuur.type, "INVOICE_DEPOSIT");
    assert.equal(factuur.titel, "Ontwikkeling & inrichting DogWare-platform", "titel ongewijzigd");
    assert.equal(mailsVan("deposit-received").at(-1)?.vars?.regeling, undefined, "mail ongewijzigd");
  });
});

/* =========================================================================
 * 4. De cronroute staat dicht zonder geheim
 * ========================================================================= */

describe("dagelijkse termijnronde", () => {
  it("weigert zonder of met een verkeerd CRON_SECRET", async () => {
    const { GET } = await import("../app/api/cron/termijnen/route.ts");
    delete process.env.CRON_SECRET;
    const zonder = await GET(new Request("https://x.test/api/cron/termijnen") as never);
    assert.equal(zonder.status, 401);
    process.env.CRON_SECRET = "geheim-van-de-test";
    const fout = await GET(
      new Request("https://x.test/api/cron/termijnen", { headers: { authorization: "Bearer iets-anders" } }) as never,
    );
    assert.equal(fout.status, 401);
    const goed = await GET(
      new Request("https://x.test/api/cron/termijnen", { headers: { authorization: "Bearer geheim-van-de-test" } }) as never,
    );
    assert.equal(goed.status, 200);
    delete process.env.CRON_SECRET;
  });
});

/* =========================================================================
 * Vijf termijnen — € 2.500 excl. / € 3.025 incl. — de hele keten
 * ========================================================================= */

describe("vijf termijnen: opslaan → database → versie → tekenen → Mollie → factuur", () => {
  const k = KLANTEN.VIJF;

  it("opgeslagen en opnieuw gelezen uit de database: termijnen, 5 stuks", async () => {
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.paymentPlan, "termijnen");
    assert.equal(c.installmentCount, 5);
    assert.equal(c.projectCents, 250_000);
    assert.equal(c.monthlyCents, 18_000, "het abonnement is een eigen veld");
  });

  it("de verstuurde versie bevat 5 × € 605,00 incl. btw, samen exact € 3.025,00", async () => {
    const [p] = await db.select().from(schema.proposals).where(eq(schema.proposals.commerceId, k.commerce.id));
    assert.equal(p.status, "SENT");
    const r = (p.pricing as { betaalregeling: { soort: string; termijnen: { exVatCents: number; vatCents: number; inclVatCents: number }[] } })
      .betaalregeling;
    assert.equal(r.soort, "termijnen");
    assert.deepEqual(r.termijnen.map((t) => t.inclVatCents), [60_500, 60_500, 60_500, 60_500, 60_500]);
    assert.deepEqual(r.termijnen.map((t) => t.exVatCents), [50_000, 50_000, 50_000, 50_000, 50_000]);
    assert.equal(r.termijnen.reduce((s, t) => s + t.inclVatCents, 0), 302_500);
    const mail = mailsVan("agreement-ready").find((m) => (m as { to?: string }).to === k.lead.email);
    assert.match(mail?.vars?.regeling ?? "", /vijf maandelijkse termijnen/);
  });

  it("tekenen → schema van 5 × € 605,00; Mollie int exact € 605,00; webhook → factuur € 500 + € 105 btw", async () => {
    alsKlant();
    const res = await acties.signAgreement(k.token, TEKEN);
    assert.equal(res.status, "success", res.message);
    const rijen = await scheduleForCommerce(k.commerce.id);
    assert.deepEqual(rijen.map((r) => r.amountInclVatCents), [60_500, 60_500, 60_500, 60_500, 60_500]);
    assert.equal(rijen.reduce((s, r) => s + r.amountInclVatCents, 0), 302_500);

    const id = await start(k.token, "deposit");
    assert.equal(mollieBetalingen.get(id)?.amount.value, "605.00", "Mollie krijgt exact het termijnbedrag");
    const [p] = await betalingenVan(k.commerce.id);
    assert.equal(p.amountCents, 60_500);

    mollieZet(id, "paid");
    await processPaymentByMollieId(id);
    const [factuur] = await db.select().from(schema.documents).where(eq(schema.documents.paymentId, p.id));
    assert.equal(factuur.netExVatCents, 50_000);
    assert.equal(factuur.vatCents, 10_500);
    assert.match(factuur.titel, /termijn 1 van 5/);
    const [eerste] = await scheduleForCommerce(k.commerce.id);
    assert.equal(eerste.status, "BETAALD");
    assert.equal(eerste.documentId, factuur.id);
    assert.equal(
      abonnementen.filter((a) => (a as { metadata?: { commerceId?: string } }).metadata?.commerceId === k.commerce.id).length,
      0,
      "het abonnement start niet mee met een termijn",
    );
  });
});
