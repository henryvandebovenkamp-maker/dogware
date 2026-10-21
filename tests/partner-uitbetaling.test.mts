import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { maakTestDb } from "./test-db.mts";

/**
 * Partnercommissies uitbetalen en het e-mailadres van een partner wijzigen,
 * tegen een echte (in-process) Postgres.
 *
 * Nagebootst is precies het geval waarvoor dit gebouwd is: een partner die
 * een klant aanbracht, een klant die in twee termijnen (50/50) betaalde, en
 * een vaste commissie van € 500. Er staat geen echte naam of echt adres in.
 *
 * Mollie is een nepclient die zich gedraagt als de echte API; mails gaan naar
 * de recorder in tests/mail-stub.mjs. Er wordt niets echts geraakt.
 */

process.env.MOLLIE_API_KEY = "test_integratie";
process.env.AUTH_SECRET ??= "test-geheim-alleen-voor-de-testrunner-0123456789";

/* ------------------------------------------------------------ nep-Mollie -- */

type NepBetaling = {
  id: string;
  status: string;
  amount: { currency: string; value: string };
  amountRefunded?: { currency: string; value: string };
  amountChargedBack?: { currency: string; value: string };
  method?: string;
};
const mollie = new Map<string, NepBetaling>();
let mollieOpvragingen = 0;
(globalThis as Record<string, unknown>).__fakeMollie = {
  payments: {
    get: async (id: string) => {
      mollieOpvragingen++;
      const b = mollie.get(id);
      if (!b) throw new Error("niet gevonden");
      return { ...b, getCheckoutUrl: () => null };
    },
  },
};

type Mail = { type: string; to?: string; moment?: string; ctaUrl?: string; uitbetaling?: Record<string, string> };
const mails = () => ((globalThis as Record<string, unknown>).__verzondenMails as Mail[]) ?? [];
const mailsVan = (type: string, moment?: string) =>
  mails().filter((m) => m.type === type && (!moment || m.moment === moment));

/* ------------------------------------------------------------- opzetten -- */

const { db } = await maakTestDb();
const { schema } = await import("../lib/db/index.ts");
const { hashToken } = await import("../lib/auth/crypto.ts");
const commissies = await import("../lib/partner-commissies.ts");
const commissieActies = await import("../app/actions/partner-commissies.ts");
const partnerActies = await import("../app/actions/partners.ts");
const emailActies = await import("../app/actions/email-wijziging.ts");
const { processPaymentByMollieId } = await import("../lib/commerce.ts");
const regels = await import("../lib/commissie.ts");
const { FINANCE_ROLE } = await import("../lib/finance-role.ts");

const IDLE = { status: "idle" as const };
const fd = (velden: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(velden)) f.set(k, v);
  return f;
};

/** Een ingelogde gebruiker met een sessietoken; geeft het token terug. */
async function gebruiker(email: string, rollen: string[], primair: string) {
  const [u] = await db
    .insert(schema.users)
    .values({ email, naam: email.split("@")[0], role: primair as "SUPER_ADMIN", status: "ACTIVE" })
    .returning();
  for (const role of rollen) {
    await db.insert(schema.userRoles).values({ userId: u.id, role: role as "SUPER_ADMIN" });
  }
  const token = randomBytes(24).toString("base64url");
  await db.insert(schema.sessions).values({
    userId: u.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return { user: u, token };
}
const als = (token: string | null) => {
  (globalThis as Record<string, unknown>).__testCookies = token ? { dw_session: token } : {};
};

const beheerder = await gebruiker("beheer@dogware.test", ["SUPER_ADMIN"], "SUPER_ADMIN");
const financieel = await gebruiker("financien@dogware.test", ["SUPER_ADMIN", FINANCE_ROLE], "SUPER_ADMIN");
const partnerAccount = await gebruiker("partner-oud@voorbeeld.test", ["AFFILIATE_PARTNER"], "AFFILIATE_PARTNER");
const anderAccount = await gebruiker("bezet@voorbeeld.test", ["CUSTOMER"], "CUSTOMER");

const [partner] = await db
  .insert(schema.partners)
  .values({
    userId: partnerAccount.user.id,
    referralCode: "TESTCODE7",
    commissionCents: 50_000,
    status: "ACTIVE",
    voornaam: "Partner",
  })
  .returning();

let teller = 0;
/**
 * Een aangebrachte klant met getekende 50/50-overeenkomst (€ 2.500 excl. btw
 * = € 3.025 incl.) en twee termijnen. `betaald` zegt welke termijnen al
 * betaald zijn, in onze administratie én bij Mollie.
 */
async function klant(naam: string, betaald: { aanbetaling: boolean; rest: boolean }) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: naam,
      naam: "Klant",
      email: `klant${++teller}@voorbeeld.test`,
      plaats: "Utrecht",
      source: "referral",
      affiliatePartnerId: partner.id,
      referralCodeSnapshot: partner.referralCode,
      attributionModel: "FIRST_TOUCH",
      stage: "mandaat",
      status: "klant geworden",
    })
    .returning();
  const [commerce] = await db
    .insert(schema.commerce)
    .values({ leadId: lead.id, status: "SUBSCRIPTION_SCHEDULED", projectCents: 250_000, monthlyCents: 18_000 })
    .returning();
  const [proposal] = await db
    .insert(schema.proposals)
    .values({ commerceId: commerce.id, leadId: lead.id, version: 1 } as typeof schema.proposals.$inferInsert)
    .returning();
  const config = {
    projectCents: 250_000,
    setupCents: 0,
    discountType: "none",
    discountValue: 0,
    vatPercent: 21,
    depositPercent: 50,
    monthlyCents: 18_000,
    freeMonths: 0,
    introDiscountPercent: 0,
    introDiscountMonths: 0,
  };
  await db.insert(schema.agreements).values({
    commerceId: commerce.id,
    leadId: lead.id,
    proposalId: proposal.id,
    proposalVersion: 1,
    status: "SIGNED",
    voorwaardenVersie: "dw-1.0",
    pricing: { config },
    signedAt: new Date(),
    agreesOpdracht: true,
    agreesInvestering: true,
    agreesTermijnen: true,
    agreesMaandbedrag: true,
    agreesVoorwaarden: true,
    agreesBevoegd: true,
  });

  const termijn = async (type: "DEPOSIT" | "FINAL_PAYMENT", isBetaald: boolean) => {
    const id = `tr_${type.toLowerCase()}_${teller}`;
    mollie.set(id, {
      id,
      status: isBetaald ? "paid" : "open",
      amount: { currency: "EUR", value: "1512.50" },
      amountRefunded: { currency: "EUR", value: "0.00" },
    });
    await db.insert(schema.payments).values({
      commerceId: commerce.id,
      type,
      status: isBetaald ? "PAID" : "OPEN",
      amountCents: 151_250,
      molliePaymentId: id,
      paidAt: isBetaald ? new Date() : null,
      processedAt: isBetaald ? new Date() : null,
    });
    return id;
  };
  const aanbetaling = await termijn("DEPOSIT", betaald.aanbetaling);
  const rest = await termijn("FINAL_PAYMENT", betaald.rest);
  return { lead, commerce, mollieIds: { aanbetaling, rest } };
}

async function commissieVan(leadId: string) {
  const [c] = await db
    .select()
    .from(schema.partnerCommissions)
    .where(eq(schema.partnerCommissions.leadId, leadId));
  return c ?? null;
}

after(() => {
  for (const k of ["__testDb", "__testCookies", "__fakeMollie", "__mailFaalt"]) {
    delete (globalThis as Record<string, unknown>)[k];
  }
});

/* ================================================================= tests == */

describe("pure regels", () => {
  it("volledig betaald vraagt een getekende overeenkomst en een totaal boven nul", () => {
    assert.equal(regels.volledigBetaald({ getekend: true, totaalCents: 302_500, betaaldCents: 302_500 }), true);
    assert.equal(regels.volledigBetaald({ getekend: true, totaalCents: 302_500, betaaldCents: 151_250 }), false);
    assert.equal(regels.volledigBetaald({ getekend: false, totaalCents: 302_500, betaaldCents: 302_500 }), false);
    assert.equal(regels.volledigBetaald({ getekend: true, totaalCents: 0, betaaldCents: 0 }), false);
  });

  it("een Mollie-betaling telt alleen als hij betaald, exact en niet teruggeboekt is", () => {
    const ok = { status: "paid", amount: { value: "1512.50" } };
    assert.deepEqual(regels.beoordeelMollieBetaling(151_250, ok), { ok: true });
    assert.equal(regels.beoordeelMollieBetaling(151_250, { ...ok, status: "open" }).ok, false);
    assert.equal(regels.beoordeelMollieBetaling(151_250, { ...ok, amount: { value: "1512.49" } }).ok, false);
    assert.equal(regels.beoordeelMollieBetaling(151_250, { ...ok, amountRefunded: { value: "10.00" } }).ok, false);
    assert.equal(regels.beoordeelMollieBetaling(151_250, { ...ok, amountChargedBack: { value: "1512.50" } }).ok, false);
    assert.equal(regels.beoordeelMollieBetaling(151_250, null).ok, false);
  });

  it("een uitbetaling vraagt bankdatum, kenmerk en exact het commissiebedrag", () => {
    const nu = new Date("2026-10-21T10:00:00Z");
    assert.equal(regels.leesUitbetaling({ datum: "2026-10-21", referentie: "BANK-123", bedrag: "500,00" }, 50_000, nu).ok, true);
    assert.equal(regels.leesUitbetaling({ datum: "2026-10-21", referentie: "BANK-123", bedrag: "500" }, 50_000, nu).ok, true);
    assert.equal(regels.leesUitbetaling({ datum: "2026-10-21", referentie: "BANK-123", bedrag: "500.00" }, 50_000, nu).ok, true);
    assert.equal(regels.leesUitbetaling({ datum: "2026-10-21", referentie: "BANK-123", bedrag: "499,99" }, 50_000, nu).ok, false);
    assert.equal(regels.leesUitbetaling({ datum: "2026-12-01", referentie: "BANK-123", bedrag: "500" }, 50_000, nu).ok, false);
    assert.equal(regels.leesUitbetaling({ datum: "", referentie: "BANK-123", bedrag: "500" }, 50_000, nu).ok, false);
    assert.equal(regels.leesUitbetaling({ datum: "2026-10-21", referentie: "x", bedrag: "500" }, 50_000, nu).ok, false);
  });
});

describe("1–3. e-mailadres van de partner wijzigen", () => {
  it("een gewone klant of een anonieme bezoeker kan niets aanvragen", async () => {
    als(anderAccount.token);
    const r = await partnerActies.requestPartnerEmailChange(IDLE, fd({ partnerId: partner.id, email: "x@voorbeeld.test" }));
    assert.equal(r.status, "error");
    als(null);
    const r2 = await partnerActies.requestPartnerEmailChange(IDLE, fd({ partnerId: partner.id, email: "x@voorbeeld.test" }));
    assert.equal(r2.status, "error");
  });

  it("een adres van een ander account wordt geweigerd — nooit een tweede account", async () => {
    als(beheerder.token);
    const r = await partnerActies.requestPartnerEmailChange(IDLE, fd({ partnerId: partner.id, email: "Bezet@Voorbeeld.test" }));
    assert.equal(r.status, "error");
    assert.match(r.message ?? "", /ander DogWare-account/);
  });

  it("aanvragen verandert nog niets; alleen bevestigen vanaf het nieuwe adres doet dat", async () => {
    // Een klant met een al aangemaakte commissie, om te zien dat die blijft staan.
    const { lead } = await klant("Bewaarde Klant", { aanbetaling: true, rest: false });
    als(beheerder.token);
    await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }));
    const commissieVooraf = await commissieVan(lead.id);
    assert.ok(commissieVooraf);

    const r = await partnerActies.requestPartnerEmailChange(
      IDLE,
      fd({ partnerId: partner.id, email: "Admin@Nieuw-Adres.test", reason: "Nieuw adres op verzoek van de partner" }),
    );
    assert.equal(r.status, "success", r.message);

    const bevestig = mailsVan("email-wijziging", "bevestigen").at(-1);
    assert.equal(bevestig?.to, "admin@nieuw-adres.test");
    assert.equal(mailsVan("email-wijziging", "aangevraagd").at(-1)?.to, "partner-oud@voorbeeld.test");

    const [ongewijzigd] = await db.select().from(schema.users).where(eq(schema.users.id, partnerAccount.user.id));
    assert.equal(ongewijzigd.email, "partner-oud@voorbeeld.test", "adres mag pas na bevestiging wijzigen");

    const token = bevestig!.ctaUrl!.split("/email-bevestigen/")[1];
    als(null); // bevestigen kan zonder sessie: het token is het bewijs
    const ok = await emailActies.bevestigEmailActie(IDLE, fd({ token }));
    assert.equal(ok.status, "success", ok.message);

    const [na] = await db.select().from(schema.users).where(eq(schema.users.id, partnerAccount.user.id));
    assert.equal(na.email, "admin@nieuw-adres.test");
    const [p] = await db.select().from(schema.partners).where(eq(schema.partners.id, partner.id));
    assert.equal(p.userId, partnerAccount.user.id, "zelfde account");
    assert.equal(p.referralCode, "TESTCODE7", "zelfde referralcode en dus dezelfde link");
    const [l] = await db.select().from(schema.leads).where(eq(schema.leads.id, lead.id));
    assert.equal(l.affiliatePartnerId, partner.id, "klant blijft gekoppeld");
    const commissieNa = await commissieVan(lead.id);
    assert.deepEqual(
      { id: commissieNa?.id, bedrag: commissieNa?.amountCents, partner: commissieNa?.partnerId },
      { id: commissieVooraf.id, bedrag: 50_000, partner: partner.id },
      "commissie blijft behouden",
    );
    const aantalPartners = await db.select().from(schema.partners).where(eq(schema.partners.userId, partnerAccount.user.id));
    assert.equal(aantalPartners.length, 1, "geen tweede partneraccount");

    // Lopende sessies van het oude adres zijn ingetrokken.
    const sessies = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, partnerAccount.user.id));
    assert.equal(sessies.length, 0);
    assert.equal(mailsVan("email-wijziging", "gewijzigd").at(-1)?.to, "admin@nieuw-adres.test");

    // De link werkt één keer.
    const nogmaals = await emailActies.bevestigEmailActie(IDLE, fd({ token }));
    assert.equal(nogmaals.status, "error");

    // Auditlog.
    const audit = await db.select().from(schema.activityLog).where(eq(schema.activityLog.objectId, partnerAccount.user.id));
    assert.ok(audit.some((a) => a.action === "EMAIL_CHANGE_REQUESTED"));
    assert.ok(audit.some((a) => a.action === "EMAIL_CHANGED"));
  });
});

describe("5–6. commissie wordt pas uitbetaalbaar na volledige, geverifieerde betaling", () => {
  it("een onbetaalde restbetaling houdt de commissie op 'wacht op betaling' — zonder mail", async () => {
    const { lead } = await klant("Half Betaald", { aanbetaling: true, rest: false });
    als(beheerder.token);
    const voor = mailsVan("partner-commissie").length;
    const r = await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }));
    assert.equal(r.status, "success");
    assert.match(r.message ?? "", /Nog niet uitbetaalbaar/);
    const c = await commissieVan(lead.id);
    assert.equal(c?.status, "WACHT_OP_BETALING");
    assert.equal(c?.amountCents, 50_000);
    assert.equal(mailsVan("partner-commissie").length, voor);

    // Voorbereiden kan niet.
    const v = await commissieActies.bereidUitbetalingVoorActie(IDLE, fd({ commissieId: c!.id, rekeninghouder: "P. Partner", iban: "NL91ABNA0417164300" }));
    assert.equal(v.status, "error");
  });

  it("betaald in onze administratie maar teruggestort bij Mollie: niet vrijgegeven", async () => {
    const { lead, mollieIds } = await klant("Teruggestort", { aanbetaling: true, rest: true });
    mollie.get(mollieIds.rest)!.amountRefunded = { currency: "EUR", value: "1512.50" };
    als(beheerder.token);
    const r = await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }));
    assert.equal(r.status, "error");
    assert.match(r.message ?? "", /teruggestort/);
    assert.equal((await commissieVan(lead.id))?.status, "WACHT_OP_BETALING");
  });

  it("zonder Mollie-configuratie wordt niets vrijgegeven (fail closed)", async () => {
    const { lead } = await klant("Zonder Mollie", { aanbetaling: true, rest: true });
    const key = process.env.MOLLIE_API_KEY;
    delete process.env.MOLLIE_API_KEY;
    try {
      als(beheerder.token);
      const r = await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }));
      assert.equal(r.status, "error");
      assert.equal((await commissieVan(lead.id))?.status, "WACHT_OP_BETALING");
    } finally {
      process.env.MOLLIE_API_KEY = key;
    }
  });

  it("de webhook van de laatste termijn maakt de commissie uitbetaalbaar en mailt één keer", async () => {
    const { lead, mollieIds } = await klant("Via Webhook", { aanbetaling: true, rest: false });
    // Eerste keer: alleen registratie (wacht op betaling).
    als(beheerder.token);
    await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }));

    // De klant betaalt de restbetaling; Mollie stuurt de webhook (twee keer, tegelijk).
    mollie.get(mollieIds.rest)!.status = "paid";
    const voor = mailsVan("partner-commissie", "uitbetaalbaar").length;
    await Promise.all([processPaymentByMollieId(mollieIds.rest), processPaymentByMollieId(mollieIds.rest)]);

    const c = await commissieVan(lead.id);
    assert.equal(c?.status, "UITBETAALBAAR");
    assert.ok(c?.payableMailSentAt);
    const nieuw = mailsVan("partner-commissie", "uitbetaalbaar").slice(voor);
    assert.equal(nieuw.length, 1, "precies één bericht");
    assert.equal(nieuw[0].to, "admin@nieuw-adres.test", "naar het bevestigde nieuwe adres");
  });
});

describe("4, 7, 9. uitbetalen: voorbereiden → goedkeuren → uitbetaald", () => {
  it("de volledige flow, met rechten, idempotentie en een mislukte mail", async () => {
    const { lead } = await klant("Volledig Betaald", { aanbetaling: true, rest: true });

    // Gelijktijdig twee keer controleren: één commissie, één overgang, één mail.
    als(beheerder.token);
    const voor = mailsVan("partner-commissie", "uitbetaalbaar").length;
    const [a, b] = await Promise.all([
      commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id })),
      commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id })),
    ]);
    assert.ok(a.status === "success" && b.status === "success", `${a.message} / ${b.message}`);
    const alle = await db.select().from(schema.partnerCommissions).where(eq(schema.partnerCommissions.leadId, lead.id));
    assert.equal(alle.length, 1, "nooit een dubbele commissie");
    const c = alle[0];
    assert.equal(c.status, "UITBETAALBAAR");
    assert.equal(c.amountCents, 50_000);
    assert.equal(mailsVan("partner-commissie", "uitbetaalbaar").length - voor, 1);

    // De database weigert zelf een tweede commissie voor dezelfde aanvraag.
    await assert.rejects(
      db.insert(schema.partnerCommissions).values({ partnerId: partner.id, leadId: lead.id, amountCents: 50_000 }),
    );

    // Onbevoegd: een partner of klant kan niets starten.
    als(partnerAccount.token);
    assert.equal((await commissieActies.bereidUitbetalingVoorActie(IDLE, fd({ commissieId: c.id }))).status, "error");
    als(anderAccount.token);
    assert.equal((await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }))).status, "error");

    // Voorbereiden zonder bankgegevens lukt niet; met (door beheer ingevulde) gegevens wel.
    als(beheerder.token);
    const zonder = await commissieActies.bereidUitbetalingVoorActie(IDLE, fd({ commissieId: c.id }));
    assert.equal(zonder.status, "error");
    const fout = await commissieActies.bereidUitbetalingVoorActie(IDLE, fd({ commissieId: c.id, rekeninghouder: "P. Partner", iban: "NL00FOUT0000000000" }));
    assert.equal(fout.status, "error");
    const klaar = await commissieActies.bereidUitbetalingVoorActie(IDLE, fd({ commissieId: c.id, rekeninghouder: "P. Partner", iban: "NL91 ABNA 0417 1643 00" }));
    assert.equal(klaar.status, "success", klaar.message);
    const voorbereid = await commissieVan(lead.id);
    assert.equal(voorbereid?.status, "VOORBEREID");
    assert.ok(voorbereid?.payeeIbanEnc?.startsWith("enc:"), "IBAN versleuteld bevroren");
    const [p] = await db.select().from(schema.partners).where(eq(schema.partners.id, partner.id));
    assert.ok(p.ibanEnc?.startsWith("enc:"), "IBAN versleuteld op het profiel");
    const bankAudit = await db
      .select()
      .from(schema.activityLog)
      .where(and(eq(schema.activityLog.action, "PARTNER_BANK_DETAILS_SET_BY_ADMIN"), eq(schema.activityLog.objectId, partner.id)));
    assert.equal(bankAudit.length, 1);
    assert.ok(!JSON.stringify(bankAudit[0].newValue).includes("0417164300"), "auditlog bevat geen volledig IBAN");

    // Een beheerder zónder financiële bevoegdheid kan niet goedkeuren of uitbetalen.
    const nietGoed = await commissieActies.keurUitbetalingGoedActie(IDLE, fd({ commissieId: c.id }));
    assert.equal(nietGoed.status, "error");
    assert.match(nietGoed.message ?? "", /financieel bevoegde/);
    const nietBetaald = await commissieActies.markeerUitbetaaldActie(
      IDLE,
      fd({ commissieId: c.id, datum: "2026-10-21", referentie: "BANK-1", bedrag: "500", bevestigd: "1" }),
    );
    assert.equal(nietBetaald.status, "error");

    // Als uitbetaald markeren vóór goedkeuring kan ook de financiële beheerder niet.
    als(financieel.token);
    const teVroeg = await commissieActies.markeerUitbetaaldActie(
      IDLE,
      fd({ commissieId: c.id, datum: "2026-10-21", referentie: "BANK-1", bedrag: "500", bevestigd: "1" }),
    );
    assert.equal(teVroeg.status, "error");
    assert.equal((await commissieVan(lead.id))?.status, "VOORBEREID");

    // Goedkeuren: Mollie wordt opnieuw gevraagd.
    const opvragingenVoor = mollieOpvragingen;
    const goed = await commissieActies.keurUitbetalingGoedActie(IDLE, fd({ commissieId: c.id }));
    assert.equal(goed.status, "success", goed.message);
    assert.ok(mollieOpvragingen > opvragingenVoor, "goedkeuren controleert Mollie live");
    assert.equal((await commissieVan(lead.id))?.status, "GOEDGEKEURD");
    // Er is nog niets uitbetaald, dus ook geen betaalbevestiging.
    assert.equal(mailsVan("partner-commissie", "uitbetaald").length, 0);

    // Foutieve invoer verandert niets.
    for (const invoer of [
      { datum: "2026-10-21", referentie: "BANK-1", bedrag: "450", bevestigd: "1" },
      { datum: "2099-01-01", referentie: "BANK-1", bedrag: "500", bevestigd: "1" },
      { datum: "2026-10-21", referentie: "BANK-1", bedrag: "500", bevestigd: "" },
    ]) {
      const r = await commissieActies.markeerUitbetaaldActie(IDLE, fd({ commissieId: c.id, ...invoer }));
      assert.equal(r.status, "error");
    }
    assert.equal((await commissieVan(lead.id))?.status, "GOEDGEKEURD");

    // De mail faalt: de status klopt toch (het geld ís overgemaakt), mail kan opnieuw.
    (globalThis as Record<string, unknown>).__mailFaalt = true;
    const invoer = { commissieId: c.id, datum: "2026-10-20", referentie: "NOTPROVIDED-123", bedrag: "500,00", bevestigd: "1" };
    const [eerste, tweede] = await Promise.all([
      commissieActies.markeerUitbetaaldActie(IDLE, fd(invoer)),
      commissieActies.markeerUitbetaaldActie(IDLE, fd(invoer)),
    ]);
    (globalThis as Record<string, unknown>).__mailFaalt = false;
    assert.equal([eerste, tweede].filter((r) => r.status === "success").length, 1, "precies één uitbetaling");
    const betaald = await commissieVan(lead.id);
    assert.equal(betaald?.status, "UITBETAALD");
    assert.equal(betaald?.paidAmountCents, 50_000);
    assert.equal(betaald?.paymentReference, "NOTPROVIDED-123");
    assert.equal(betaald?.paidByUserId, financieel.user.id);
    assert.equal(betaald?.approvedByUserId, financieel.user.id);
    assert.equal(betaald?.preparedByUserId, beheerder.user.id);
    assert.equal(betaald?.paidMailSentAt, null, "mislukte mail staat niet als verstuurd");

    // Nog een keer uitbetalen kan niet.
    const dubbel = await commissieActies.markeerUitbetaaldActie(IDLE, fd(invoer));
    assert.equal(dubbel.status, "error");
    assert.match(dubbel.message ?? "", /al uitbetaald/);
    // Intrekken na uitbetaling kan niet.
    const intrek = await commissieActies.trekVoorbereidingInActie(IDLE, fd({ commissieId: c.id, reden: "test" }));
    assert.equal(intrek.status, "error");

    // Opnieuw versturen: één keer, naar het nieuwe adres, met de vastgelegde gegevens.
    const opnieuw = await commissieActies.verstuurCommissieMailOpnieuw(IDLE, fd({ commissieId: c.id, moment: "uitbetaald" }));
    assert.equal(opnieuw.status, "success", opnieuw.message);
    const nogEens = await commissieActies.verstuurCommissieMailOpnieuw(IDLE, fd({ commissieId: c.id, moment: "uitbetaald" }));
    assert.equal(nogEens.status, "error");
    const bevestigingen = mailsVan("partner-commissie", "uitbetaald");
    assert.equal(bevestigingen.length, 1);
    assert.equal(bevestigingen[0].to, "admin@nieuw-adres.test");
    assert.equal(bevestigingen[0].uitbetaling?.referentie, "NOTPROVIDED-123");
    assert.match(bevestigingen[0].uitbetaling?.ibanGemaskeerd ?? "", /^NL•• •••• •••• 4300$/);

    // Auditspoor van de hele keten.
    const acties = (await db.select().from(schema.activityLog).where(eq(schema.activityLog.objectId, c.id))).map((a) => a.action);
    for (const verwacht of ["COMMISSION_REGISTERED", "COMMISSION_PAYABLE", "COMMISSION_PAYOUT_PREPARED", "COMMISSION_PAYOUT_APPROVED", "COMMISSION_PAID"]) {
      assert.ok(acties.includes(verwacht), `auditregel ${verwacht} ontbreekt`);
    }
  });

  it("een uitbetaling-bevestiging kan niet uitgaan voor een commissie die niet uitbetaald is", async () => {
    const { lead } = await klant("Niet Uitbetaald", { aanbetaling: true, rest: true });
    als(beheerder.token);
    await commissieActies.controleerCommissieActie(IDLE, fd({ leadId: lead.id }));
    const c = await commissieVan(lead.id);
    const r = await commissies.mailPartner(c!.id, "uitbetaald");
    assert.equal(r.ok, false);
  });
});

describe("partnerportaal: het overzicht klopt per groep", () => {
  it("telt wachtend, beschikbaar en uitbetaald apart op", async () => {
    const { regels: rijen, totaal } = await commissies.commissieOverzichtPartner(partner.id, 50_000);
    const groep = (naam: string) => rijen.find((r) => r.bedrijfsnaam === naam)?.groep;
    assert.equal(groep("Half Betaald"), "wacht");
    assert.equal(groep("Via Webhook"), "beschikbaar");
    assert.equal(groep("Volledig Betaald"), "uitbetaald");
    assert.equal(totaal.uitbetaald, 50_000);
    assert.equal(totaal.opgebouwd, totaal.wacht + totaal.beschikbaar + totaal.uitbetaald);
  });
});
