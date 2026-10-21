import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { maakTestDb } from "./test-db.mts";

/**
 * Aanvullende opdrachten, van begin tot eind, tegen een echte (in-process)
 * Postgres. Een klant die al live is krijgt een uitbreiding: concept →
 * versturen → akkoord → aanbetaling via (nep-)Mollie → bouw → oplevering met
 * een gewijzigd maandbedrag → eindbetaling → afgerond.
 *
 * Met de randgevallen uit de opdracht: twee opdrachten tegelijk, een verlopen
 * en een vervangen versie, een mislukte betaling, dubbele (en gelijktijdige)
 * webhooks, herhaald klikken, een bestaand abonnement, btw en afronding op de
 * facturen, klantisolatie, en de bestaande journey die onaangeroerd blijft.
 *
 * Mollie is een nepclient die zich gedraagt als de echte API; mails gaan naar
 * de recorder in tests/mail-stub.mjs. Er wordt niets echts geraakt.
 */

process.env.MOLLIE_API_KEY = "test_opdrachten";
process.env.AUTH_SECRET ??= "test-geheim-alleen-voor-de-testrunner-0123456789";

/* ------------------------------------------------------------ nep-Mollie -- */

type NepBetaling = {
  id: string;
  status: string;
  amount: { currency: string; value: string };
  method?: string;
  metadata?: Record<string, string>;
};
const mollieBetalingen = new Map<string, NepBetaling>();
const abonnementUpdates: { id: string; customerId: string; amount: { value: string } }[] = [];
const abonnementAangemaakt: unknown[] = [];
let mollieAbonnementStatus = "active";
let teller = 0;

(globalThis as Record<string, unknown>).__fakeMollie = {
  payments: {
    create: async (p: NepBetaling) => {
      const id = `tr_opd${++teller}`;
      mollieBetalingen.set(id, { ...p, id, status: "open" });
      return { id, getCheckoutUrl: () => `https://mollie.test/${id}` };
    },
    get: async (id: string) => {
      const b = mollieBetalingen.get(id);
      if (!b) throw new Error("niet gevonden");
      return { ...b, getCheckoutUrl: () => (b.status === "open" ? `https://mollie.test/${id}` : null) };
    },
  },
  customers: { get: async (id: string) => ({ id }), create: async () => ({ id: "cst_nieuw" }) },
  customerMandates: { page: async () => [{ id: "mdt_1", status: "valid" }] },
  customerSubscriptions: {
    page: async () => [{ id: "sub_bestaand", status: "active" }],
    get: async (id: string) => ({ id, status: mollieAbonnementStatus }),
    create: async (p: unknown) => {
      abonnementAangemaakt.push(p);
      return { id: "sub_tweede" };
    },
    update: async (id: string, p: { customerId: string; amount: { value: string } }) => {
      abonnementUpdates.push({ id, ...p });
      return { id };
    },
  },
};

function mollieZet(id: string, status: string) {
  const b = mollieBetalingen.get(id);
  assert.ok(b, `onbekende Mollie-betaling ${id}`);
  b.status = status;
  if (status === "paid") b.method = "ideal";
}

type OpgenomenMail = { type: string; vars?: Record<string, string>; to?: string; ctaUrl?: string; proef?: boolean };
const mails = () => ((globalThis as Record<string, unknown>).__verzondenMails as OpgenomenMail[]) ?? [];
const mailsVan = (type: string, aan?: string) =>
  mails().filter((m) => m.type === type && !m.proef && (!aan || m.to === aan));

/* ------------------------------------------------------------- opzetten -- */

const { db } = await maakTestDb();
const { schema } = await import("../lib/db/index.ts");
const acties = await import("../app/actions/opdrachten.ts");
const service = await import("../lib/opdrachten/service.ts");
const { berekenOpdracht, euroNaarCenten, maandInclBtw } = await import("../lib/opdrachten/bedragen.ts");
const { processPaymentByMollieId, paidTotal } = await import("../lib/commerce.ts");
const { getTimeline } = await import("../lib/journey.ts");
const { hashToken } = await import("../lib/auth/crypto.ts");
const { kalenderdag, dagenLater } = await import("../lib/proposal-geldigheid.ts");

const ADMIN_TOKEN = randomBytes(24).toString("base64url");
const alsAdmin = () => ((globalThis as Record<string, unknown>).__testCookies = { dw_session: ADMIN_TOKEN });
const alsKlant = () => ((globalThis as Record<string, unknown>).__testCookies = {});

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

/** Een klant die al live is, met een lopend abonnement en een betaalde oorspronkelijke opdracht. */
async function liveKlant(naam: string, opties: { abonnement?: boolean } = {}) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: naam,
      naam: "Miranda Voorbeeld",
      email: `${naam.toLowerCase().replace(/\W/g, "")}@voorbeeld.test`,
      plaats: "Utrecht",
      journeyVariant: "direct",
      source: "handmatig",
      stage: "actief",
      status: "klant geworden",
    })
    .returning();
  const metAbonnement = opties.abonnement !== false;
  const [commerce] = await db
    .insert(schema.commerce)
    .values({
      leadId: lead.id,
      status: "ACTIVE_CUSTOMER",
      projectCents: 250_000,
      monthlyCents: 4_900,
      portalToken: randomBytes(32).toString("base64url"),
      mollieCustomerId: metAbonnement ? "cst_bestaand" : null,
      mollieMandateId: metAbonnement ? "mdt_1" : null,
      mollieSubscriptionId: metAbonnement ? "sub_bestaand" : null,
      liveAt: new Date(),
      activeCustomerAt: new Date(),
    })
    .returning();
  // De historische, al betaalde aanbetaling van de oorspronkelijke website.
  await db.insert(schema.payments).values({
    commerceId: commerce.id,
    type: "DEPOSIT",
    status: "PAID",
    amountCents: 151_250,
    paidAt: new Date(),
    processedAt: new Date(),
    molliePaymentId: `tr_hist_${naam.length}_${randomBytes(3).toString("hex")}`,
  });
  return { lead, commerce, token: commerce.portalToken! };
}

async function opdracht(id: string) {
  const [o] = await db.select().from(schema.extraOrders).where(eq(schema.extraOrders.id, id)).limit(1);
  return o;
}

async function nieuwConcept(
  leadId: string,
  invoer: Partial<Record<string, string>> = {},
): Promise<string> {
  alsAdmin();
  const r = await acties.nieuweOpdracht(leadId);
  assert.equal(r.status, "success", r.message);
  const opgeslagen = await acties.bewaarOpdracht(leadId, r.id!, {
    titel: "Module Workshops",
    omschrijving: "Workshops online laten boeken en betalen.",
    werkzaamheden: "Workshoppagina's\nInschrijven en betalen\nDeelnemerslijst in het beheer",
    prijs: "1250",
    maandDelta: "",
    geldigTot: dagenLater(kalenderdag(new Date()), 14),
    interneNotitie: "GEHEIM-INTERN: korting overwogen, niet doen.",
    ...invoer,
  });
  assert.equal(opgeslagen.status, "success", opgeslagen.message);
  return r.id!;
}

async function betaal(token: string, id: string, soort: "aanbetaling" | "eindbetaling", status = "paid") {
  alsKlant();
  const r = await acties.betaalOpdrachtActie(token, id, soort);
  assert.equal(r.status, "success", r.message);
  const mollieId = r.checkoutUrl!.split("/").pop()!;
  mollieZet(mollieId, status);
  await processPaymentByMollieId(mollieId);
  return mollieId;
}

/* ================================================================ tests == */

describe("1. bedragen: server-side, in hele centen, sluitend", () => {
  it("splitst prijs en btw zó dat de termijnen exact optellen", () => {
    for (const ex of [125_000, 99_999, 1, 33_333, 1_000_001]) {
      const b = berekenOpdracht({ priceExVatCents: ex, vatPercent: 21, depositPercent: 50 });
      assert.equal(b.aanbetaling.exVatCents + b.eindbetaling.exVatCents, b.exVatCents);
      assert.equal(b.aanbetaling.vatCents + b.eindbetaling.vatCents, b.vatCents);
      assert.equal(b.aanbetaling.inclVatCents + b.eindbetaling.inclVatCents, b.inclVatCents);
      assert.equal(b.vatCents, Math.round((ex * 21) / 100));
    }
    const b = berekenOpdracht({ priceExVatCents: 125_000, vatPercent: 21 });
    assert.equal(b.inclVatCents, 151_250);
    assert.equal(b.aanbetaling.inclVatCents, 75_625);
    assert.equal(b.eindbetaling.inclVatCents, 75_625);
  });

  it("leest euro-invoer zonder floats", () => {
    assert.equal(euroNaarCenten("1.250,50"), 125_050);
    assert.equal(euroNaarCenten("1250.5"), 125_050);
    assert.equal(euroNaarCenten("-10"), -1_000);
    assert.equal(euroNaarCenten("€ 15,00"), 1_500);
    assert.equal(euroNaarCenten("abc"), null);
    assert.equal(euroNaarCenten("1,2,3"), null);
  });
});

describe("2. The Happy Dogs: Module Workshops van begin tot eind", () => {
  let k: Awaited<ReturnType<typeof liveKlant>>;
  let paidVooraf = 0;
  let id = "";
  let updatesVooraf = 0;
  before(async () => {
    k = await liveKlant("The Happy Dogs");
    paidVooraf = await paidTotal(k.commerce.id);
    updatesVooraf = abonnementUpdates.length;
  });

  it("maakt een concept met automatisch opslaan, zonder iets te versturen", async () => {
    id = await nieuwConcept(k.lead.id, { maandDelta: "10" });
    const o = await opdracht(id);
    assert.equal(o.status, "CONCEPT");
    assert.equal(o.volgnummer, 1);
    assert.equal(o.priceExVatCents, 125_000);
    assert.equal(o.monthlyDeltaCents, 1_000);
    assert.equal(mailsVan("opdracht-sent", k.lead.email).length, 0);
  });

  it("verstuurt een vaste versie met een persoonlijke link", async () => {
    alsAdmin();
    const r = await acties.opdrachtActie(k.lead.id, id, "versturen");
    assert.equal(r.status, "success", r.message);
    const o = await opdracht(id);
    assert.equal(o.status, "VERZONDEN");
    assert.equal(o.version, 1);
    const versies = await service.listVersies(id);
    assert.equal(versies.length, 1);
    const mail = mailsVan("opdracht-sent", k.lead.email).at(-1)!;
    assert.equal(mail.to, k.lead.email);
    assert.match(mail.ctaUrl!, new RegExp(`/traject/${k.token}/opdracht/${id}$`));
    assert.match(mail.vars!.extra!, /maandbedrag .* omhoog naar €\s59,00 excl\. btw/);
    // Een concept bewerken kan nu niet meer.
    const bewerk = await acties.bewaarOpdracht(k.lead.id, id, { titel: "stiekem anders" });
    assert.equal(bewerk.status, "error");
  });

  it("weigert een akkoord zonder expliciet akkoord op het nieuwe maandbedrag", async () => {
    alsKlant();
    const r = await acties.accepteerOpdrachtActie(k.token, id, {
      versie: 1,
      naam: "Miranda",
      agreesOpdracht: true,
      agreesMaandbedrag: false,
    });
    assert.equal(r.status, "error");
    assert.match(r.message!, /maandbedrag/);
  });

  it("legt één akkoord vast, ook bij twee gelijktijdige kliks", async () => {
    alsKlant();
    const invoer = { versie: 1, naam: "Miranda Voorbeeld", agreesOpdracht: true, agreesMaandbedrag: true };
    const [a, b] = await Promise.all([
      acties.accepteerOpdrachtActie(k.token, id, invoer),
      acties.accepteerOpdrachtActie(k.token, id, invoer),
    ]);
    assert.equal(a.status, "success", a.message);
    assert.equal(b.status, "success", b.message);
    const o = await opdracht(id);
    assert.equal(o.status, "AKKOORD");
    assert.equal(o.acceptedVersion, 1);
    assert.equal(o.acceptedName, "Miranda Voorbeeld");
    assert.ok(o.acceptedIpHash);
    assert.ok(o.agreesMaandbedrag);
    const events = (await getTimeline(k.lead.id)).filter((e) => e.kind === "extra_order_accepted");
    assert.equal(events.length, 1);
    assert.equal(mailsVan("opdracht-accepted", k.lead.email).length, 1);
    const docs = await db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.extraOrderId, id), eq(schema.documents.type, "EXTRA_ORDER")));
    assert.equal(docs.length, 2, "de verstuurde versie én het akkoord liggen vast");
  });

  it("de bouw kan niet starten vóór de aanbetaling", async () => {
    alsAdmin();
    const r = await acties.opdrachtActie(k.lead.id, id, "start-bouw");
    assert.equal(r.status, "error");
  });

  it("herhaald klikken op Betaal aanbetaling geeft één betaalverzoek", async () => {
    alsKlant();
    const [a, b] = await Promise.all([
      acties.betaalOpdrachtActie(k.token, id, "aanbetaling"),
      acties.betaalOpdrachtActie(k.token, id, "aanbetaling"),
    ]);
    const urls = [a, b].filter((r) => r.checkoutUrl).map((r) => r.checkoutUrl);
    assert.ok(urls.length >= 1);
    const c = await acties.betaalOpdrachtActie(k.token, id, "aanbetaling");
    assert.equal(c.checkoutUrl, urls[0], "een derde klik gaat naar dezelfde checkout");
    const rijen = await service.betalingenVan(id);
    assert.equal(rijen.filter((p) => p.status !== "FAILED").length, 1);
    assert.equal(rijen[0].amountCents, 75_625);
  });

  it("verwerkt de aanbetaling één keer, ook bij dubbele en gelijktijdige webhooks", async () => {
    const [p] = await service.betalingenVan(id);
    mollieZet(p.molliePaymentId!, "paid");
    await Promise.all([
      processPaymentByMollieId(p.molliePaymentId!),
      processPaymentByMollieId(p.molliePaymentId!),
    ]);
    await processPaymentByMollieId(p.molliePaymentId!);
    const o = await opdracht(id);
    assert.equal(o.status, "AANBETAALD");
    const facturen = await db
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.extraOrderId, id), eq(schema.documents.type, "INVOICE_EXTRA_DEPOSIT")));
    assert.equal(facturen.length, 1);
    assert.equal(facturen[0].netExVatCents, 62_500);
    assert.equal(facturen[0].vatCents, 13_125);
    assert.equal(facturen[0].totalInclVatCents, 75_625);
    assert.equal(facturen[0].status, "BETAALD");
    assert.equal(mailsVan("opdracht-deposit-received", k.lead.email).length, 1);
    // Bij ingang "oplevering" verandert het maandbedrag nu nog niet.
    assert.equal(abonnementUpdates.length, updatesVooraf);
  });

  it("start de bouw, levert op en past het BESTAANDE abonnement aan", async () => {
    alsAdmin();
    assert.equal((await acties.opdrachtActie(k.lead.id, id, "start-bouw")).status, "success");
    assert.equal(mailsVan("opdracht-build-started", k.lead.email).length, 1);
    // Twee keer opleveren: één keer effect.
    const [a, b] = await Promise.all([
      acties.opdrachtActie(k.lead.id, id, "opleveren"),
      acties.opdrachtActie(k.lead.id, id, "opleveren"),
    ]);
    assert.equal([a, b].filter((r) => r.status === "success").length, 1);
    assert.equal(mailsVan("opdracht-delivered", k.lead.email).length, 1);
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.monthlyCents, 5_900);
    assert.equal(c.mollieSubscriptionId, "sub_bestaand", "geen tweede abonnement");
    assert.equal(abonnementAangemaakt.length, 0, "er is geen abonnement bijgemaakt");
    assert.equal(abonnementUpdates.length - updatesVooraf, 1);
    assert.equal(abonnementUpdates.at(-1)!.id, "sub_bestaand");
    assert.equal(abonnementUpdates.at(-1)!.amount.value, (maandInclBtw(5_900, 21) / 100).toFixed(2));
    // De dagelijkse ronde doet daarna niets meer.
    await service.runOpdrachtRonde();
    assert.equal(abonnementUpdates.length - updatesVooraf, 1);
  });

  it("de eindbetaling rondt de opdracht af, met een sluitende factuur", async () => {
    await betaal(k.token, id, "eindbetaling");
    const o = await opdracht(id);
    assert.equal(o.status, "AFGEROND");
    assert.ok(o.finalPaidAt && o.completedAt);
    assert.equal(mailsVan("opdracht-completed", k.lead.email).length, 1);
    const facturen = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.extraOrderId, id));
    const inv = facturen.filter((d) => d.type.startsWith("INVOICE_EXTRA"));
    assert.equal(inv.length, 2);
    assert.equal(inv.reduce((s, d) => s + d.totalInclVatCents, 0), 151_250);
    assert.equal(inv.reduce((s, d) => s + d.vatCents, 0), 26_250);
    assert.notEqual(inv[0].nummer, inv[1].nummer);
  });

  it("de website blijft live & actief en de oorspronkelijke opdracht onaangeroerd", async () => {
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, k.lead.id));
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(lead.stage, "actief");
    assert.equal(lead.status, "klant geworden");
    assert.equal(c.status, "ACTIVE_CUSTOMER");
    assert.equal(await paidTotal(k.commerce.id), paidVooraf, "betaald van de website verandert niet");
  });

  it("de interne notitie lekt nergens naar de klant", async () => {
    const klantTijdlijn = await getTimeline(k.lead.id, "klant");
    const alles = await getTimeline(k.lead.id, "admin");
    for (const e of alles) assert.doesNotMatch(e.label, /GEHEIM-INTERN/);
    assert.ok(klantTijdlijn.every((e) => !e.internal));
    for (const m of mails()) assert.doesNotMatch(JSON.stringify(m), /GEHEIM-INTERN/);
  });
});

describe("3. twee opdrachten tegelijk, met elk een eigen maandwijziging", () => {
  let k: Awaited<ReturnType<typeof liveKlant>>;
  let updatesVooraf = 0;
  let a = "";
  let b = "";
  before(async () => {
    k = await liveKlant("Twee Tegelijk");
    updatesVooraf = abonnementUpdates.length;
    const gisteren = dagenLater(kalenderdag(new Date()), -1);
    a = await nieuwConcept(k.lead.id, { titel: "Webshop", maandDelta: "15", maandIngang: "datum", maandIngangDatum: gisteren });
    b = await nieuwConcept(k.lead.id, { titel: "Nieuwsbrief", maandDelta: "5", maandIngang: "datum", maandIngangDatum: gisteren });
  });

  it("krijgen elk een eigen volgnummer en status", async () => {
    assert.equal((await opdracht(a)).volgnummer, 1);
    assert.equal((await opdracht(b)).volgnummer, 2);
  });

  it("tellen hun verschil op, zonder elkaar te overschrijven", async () => {
    alsAdmin();
    for (const id of [a, b]) assert.equal((await acties.opdrachtActie(k.lead.id, id, "versturen")).status, "success");
    alsKlant();
    for (const id of [a, b]) {
      const r = await acties.accepteerOpdrachtActie(k.token, id, {
        versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: true,
      });
      assert.equal(r.status, "success", r.message);
    }
    // De ingangsdatum is al bereikt: de wijziging gaat in zodra de aanbetaling binnen is.
    await betaal(k.token, a, "aanbetaling");
    await betaal(k.token, b, "aanbetaling");
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.monthlyCents, 4_900 + 1_500 + 500);
    assert.equal(abonnementUpdates.length - updatesVooraf, 2);
    assert.equal(abonnementUpdates.at(-1)!.amount.value, (maandInclBtw(6_900, 21) / 100).toFixed(2));
    assert.equal((await opdracht(a)).status, "AANBETAALD");
    assert.equal((await opdracht(b)).status, "AANBETAALD");
  });
});

describe("4. verlopen en vervangen voorstellen", () => {
  let k: Awaited<ReturnType<typeof liveKlant>>;
  before(async () => {
    k = await liveKlant("Verloopt");
  });

  it("een verlopen opdracht kan niet worden geaccepteerd, na verlengen wel", async () => {
    const id = await nieuwConcept(k.lead.id);
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "versturen");
    await db
      .update(schema.extraOrders)
      .set({ geldigTot: new Date(Date.now() - 3 * 86_400_000) })
      .where(eq(schema.extraOrders.id, id));
    alsKlant();
    const invoer = { versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: false };
    const r = await acties.accepteerOpdrachtActie(k.token, id, invoer);
    assert.equal(r.status, "error");
    assert.match(r.message!, /niet meer geldig/);
    alsAdmin();
    const herinner = await acties.opdrachtActie(k.lead.id, id, "herinneren");
    assert.equal(herinner.status, "error", "geen herinnering voor een verlopen opdracht");
    const v = await acties.verlengOpdrachtActie(k.lead.id, id, dagenLater(kalenderdag(new Date()), 7));
    assert.equal(v.status, "success", v.message);
    alsKlant();
    assert.equal((await acties.accepteerOpdrachtActie(k.token, id, invoer)).status, "success");
  });

  it("een vervangen versie kan niet meer worden geaccepteerd", async () => {
    const id = await nieuwConcept(k.lead.id, { prijs: "800" });
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "versturen");
    assert.equal((await acties.opdrachtActie(k.lead.id, id, "aanpassen")).status, "success");
    alsKlant();
    const oud = await acties.accepteerOpdrachtActie(k.token, id, {
      versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: false,
    });
    assert.equal(oud.status, "error");
    assert.match(oud.message!, /aangepast/);
    alsAdmin();
    await acties.bewaarOpdracht(k.lead.id, id, { titel: "Module Workshops", werkzaamheden: "Iets", prijs: "900", geldigTot: dagenLater(kalenderdag(new Date()), 14) });
    await acties.opdrachtActie(k.lead.id, id, "versturen");
    alsKlant();
    const v1 = await acties.accepteerOpdrachtActie(k.token, id, {
      versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: false,
    });
    assert.equal(v1.status, "error", "akkoord op versie 1 terwijl versie 2 klaarstaat");
    const v2 = await acties.accepteerOpdrachtActie(k.token, id, {
      versie: 2, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: false,
    });
    assert.equal(v2.status, "success", v2.message);
    const o = await opdracht(id);
    assert.equal(o.acceptedVersion, 2);
    const versies = await service.listVersies(id);
    assert.deepEqual(versies.map((v) => v.status), ["GEACCEPTEERD", "VERVANGEN"]);
    const inhoud = o.acceptedSnapshot as { bedragen: { exVatCents: number } };
    assert.equal(inhoud.bedragen.exVatCents, 90_000);
  });
});

describe("5. mislukte en afgebroken betalingen", () => {
  let k: Awaited<ReturnType<typeof liveKlant>>;
  let id = "";
  before(async () => {
    k = await liveKlant("Mislukt");
    id = await nieuwConcept(k.lead.id);
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "versturen");
    alsKlant();
    await acties.accepteerOpdrachtActie(k.token, id, { versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: false });
  });

  it("een mislukte betaling zet niets door, maakt geen factuur en laat opnieuw betalen toe", async () => {
    await betaal(k.token, id, "aanbetaling", "failed");
    assert.equal((await opdracht(id)).status, "AKKOORD");
    const facturen = await db.select().from(schema.documents).where(and(eq(schema.documents.extraOrderId, id), eq(schema.documents.type, "INVOICE_EXTRA_DEPOSIT")));
    assert.equal(facturen.length, 0);
    await betaal(k.token, id, "aanbetaling", "canceled");
    assert.equal((await opdracht(id)).status, "AKKOORD");
    await betaal(k.token, id, "aanbetaling", "paid");
    assert.equal((await opdracht(id)).status, "AANBETAALD");
    const rijen = await service.betalingenVan(id);
    assert.deepEqual(rijen.map((p) => p.status).sort(), ["CANCELED", "FAILED", "PAID"]);
  });

  it("weigert een tweede aanbetaling", async () => {
    alsKlant();
    const r = await acties.betaalOpdrachtActie(k.token, id, "aanbetaling");
    assert.equal(r.status, "error");
  });

  it("intrekken kan niet meer na een betaling", async () => {
    alsAdmin();
    const r = await acties.trekOpdrachtInActie(k.lead.id, id, "test");
    assert.equal(r.status, "error");
  });
});

describe("6. abonnement: geen Mollie-abonnement of een mislukte update", () => {
  it("zonder lopend abonnement wordt alleen de afspraak aangepast", async () => {
    const k = await liveKlant("Zonder Abonnement", { abonnement: false });
    const voor = abonnementUpdates.length;
    const id = await nieuwConcept(k.lead.id, { maandDelta: "12,50" });
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "versturen");
    alsKlant();
    const kort = await acties.accepteerOpdrachtActie(k.token, id, { versie: 1, naam: "K", agreesOpdracht: true, agreesMaandbedrag: true });
    assert.equal(kort.status, "error", "een naam van één letter is geen akkoord");
    const ok = await acties.accepteerOpdrachtActie(k.token, id, { versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: true });
    assert.equal(ok.status, "success", ok.message);
    await betaal(k.token, id, "aanbetaling");
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "start-bouw");
    await acties.opdrachtActie(k.lead.id, id, "opleveren");
    const [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.monthlyCents, 4_900 + 1_250);
    assert.equal(abonnementUpdates.length, voor);
    assert.equal(abonnementAangemaakt.length, 0);
  });

  it("lukt de Mollie-update niet, dan blijft alles zoals het was en probeert de ronde het later opnieuw", async () => {
    const k = await liveKlant("Mollie Plat");
    const id = await nieuwConcept(k.lead.id, { maandDelta: "20" });
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "versturen");
    alsKlant();
    const kort = await acties.accepteerOpdrachtActie(k.token, id, { versie: 1, naam: "K", agreesOpdracht: true, agreesMaandbedrag: true });
    assert.equal(kort.status, "error", "een naam van één letter is geen akkoord");
    const ok = await acties.accepteerOpdrachtActie(k.token, id, { versie: 1, naam: "Klant", agreesOpdracht: true, agreesMaandbedrag: true });
    assert.equal(ok.status, "success", ok.message);
    await betaal(k.token, id, "aanbetaling");
    alsAdmin();
    await acties.opdrachtActie(k.lead.id, id, "start-bouw");
    mollieAbonnementStatus = "canceled";
    await acties.opdrachtActie(k.lead.id, id, "opleveren");
    let [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.monthlyCents, 4_900, "teruggedraaid");
    assert.equal((await opdracht(id)).maandToegepastAt, null);
    mollieAbonnementStatus = "active";
    const r = await service.runOpdrachtRonde();
    assert.ok(r.maandAangepast >= 1);
    [c] = await db.select().from(schema.commerce).where(eq(schema.commerce.id, k.commerce.id));
    assert.equal(c.monthlyCents, 6_900);
  });
});

describe("7. autorisatie en klantisolatie", () => {
  let a: Awaited<ReturnType<typeof liveKlant>>;
  let b: Awaited<ReturnType<typeof liveKlant>>;
  let id = "";
  before(async () => {
    a = await liveKlant("Klant A");
    b = await liveKlant("Klant B");
    id = await nieuwConcept(a.lead.id);
    alsAdmin();
    await acties.opdrachtActie(a.lead.id, id, "versturen");
  });

  it("zonder beheerderssessie gebeurt er niets", async () => {
    alsKlant();
    assert.equal((await acties.nieuweOpdracht(a.lead.id)).status, "error");
    assert.equal((await acties.opdrachtActie(a.lead.id, id, "aanpassen")).status, "error");
    assert.equal((await acties.bewaarOpdracht(a.lead.id, id, { titel: "x" })).status, "error");
  });

  it("een opdracht van klant A is niet bereikbaar via klant B", async () => {
    alsKlant();
    const r = await acties.accepteerOpdrachtActie(b.token, id, {
      versie: 1, naam: "Indringer", agreesOpdracht: true, agreesMaandbedrag: false,
    });
    assert.equal(r.status, "error");
    const p = await acties.betaalOpdrachtActie(b.token, id, "aanbetaling");
    assert.equal(p.status, "error");
    assert.equal(await service.getOpdracht(id, b.commerce.id), null);
    alsAdmin();
    const x = await acties.opdrachtActie(b.lead.id, id, "aanpassen");
    assert.equal(x.status, "error", "een beheeractie met de verkeerde klant raakt de opdracht niet");
    assert.equal((await opdracht(id)).status, "VERZONDEN");
  });

  it("een verzonnen actie wordt netjes geweigerd", async () => {
    alsAdmin();
    const r = await acties.opdrachtActie(a.lead.id, id, "constructor" as never);
    assert.equal(r.status, "error");
  });

  it("een ongeldige sleutel opent niets", async () => {
    alsKlant();
    const r = await acties.accepteerOpdrachtActie("x".repeat(43), id, {
      versie: 1, naam: "x", agreesOpdracht: true, agreesMaandbedrag: false,
    });
    assert.equal(r.status, "error");
  });
});

describe("8. de migratie is veilig om te draaien", () => {
  it("voegt alleen toe, en is herhaalbaar", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(new URL("../drizzle/0007_aanvullende_opdrachten.sql", import.meta.url), "utf8");
    assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN|INDEX)/i);
    assert.doesNotMatch(sql, /DELETE\s+FROM|TRUNCATE|UPDATE\s+"/i);
    const kolommen = sql.match(/ADD COLUMN/g) ?? [];
    assert.equal((sql.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length, kolommen.length);
    assert.equal((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length, (sql.match(/CREATE TABLE/g) ?? []).length);
    assert.equal(
      (sql.match(/CREATE (UNIQUE )?INDEX IF NOT EXISTS/g) ?? []).length,
      (sql.match(/CREATE (UNIQUE )?INDEX/g) ?? []).length,
    );
    // En hij draait echt, twee keer achter elkaar, op een database met het volledige schema.
    const { client } = await maakTestDb();
    await client.exec(sql);
    await client.exec(sql);
    (globalThis as Record<string, unknown>).__testDb = db;
  });
});
