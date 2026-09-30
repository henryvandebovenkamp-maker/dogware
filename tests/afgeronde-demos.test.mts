import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { maakTestDb } from "./test-db.mts";

/**
 * Aanvragen als werkvoorraad, afgeronde demo's als apart archief.
 *
 * Tegen een echte (in-process) Postgres en via de echte flows: een demo
 * afronden, een aanvraag met de hand op afgevallen zetten, heropenen — en dan
 * kijken waar elke aanvraag in de lijst belandt. Het draait om één regel: een
 * afgeronde demo is iets anders dan "afgevallen".
 */

process.env.AUTH_SECRET ??= "test-geheim-alleen-voor-de-testrunner-0123456789";

const { db } = await maakTestDb();
const { schema } = await import("../lib/db/index.ts");
const afronding = await import("../lib/demo-afronding.ts");
const tekst = await import("../lib/demo-afronding-tekst.ts");
const { laadAanvragen } = await import("../lib/aanvragen-lijst.ts");
const { aanvragenWeergave } = await import("../lib/aanvragen-weergave.ts");
const leadActies = await import("../app/admin/(portal)/leads/[id]/actions.ts");
const { hashToken } = await import("../lib/auth/crypto.ts");

const ADMIN_TOKEN = randomBytes(24).toString("base64url");
const [admin] = await db
  .insert(schema.users)
  .values({ email: "admin@dogware.test", naam: "Beheerder", role: "SUPER_ADMIN", status: "ACTIVE" })
  .returning();
await db.insert(schema.userRoles).values({ userId: admin.id, role: "SUPER_ADMIN" });
await db.insert(schema.sessions).values({ userId: admin.id, tokenHash: hashToken(ADMIN_TOKEN), expiresAt: new Date(Date.now() + 86_400_000) });
const alsAdmin = () => ((globalThis as Record<string, unknown>).__testCookies = { dw_session: ADMIN_TOKEN });
const alsNiemand = () => ((globalThis as Record<string, unknown>).__testCookies = {});

after(() => {
  delete (globalThis as Record<string, unknown>).__testDb;
  delete (globalThis as Record<string, unknown>).__testCookies;
});

const PDF = Buffer.from("%PDF-1.7\n%%EOF");
const maak = async () => ({ pdf: PDF, paginas: 13, schermen: 10, routes: [] });
const dagenGeleden = (n: number) => new Date(Date.now() - n * 86_400_000);

async function aanvraag(naam: string, over: Partial<typeof schema.leads.$inferInsert> = {}) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: naam,
      naam: `Contact ${naam}`,
      email: `${naam.toLowerCase().replace(/\W/g, "")}@voorbeeld.test`,
      plaats: "Oosterhout",
      source: "website",
      journeyVariant: "demo",
      stage: "demo-verstuurd",
      status: "demo verstuurd",
      demoDomain: `https://${naam.toLowerCase().replace(/\W/g, "")}-demo.vercel.app/`,
      demoSentAt: dagenGeleden(35),
      referralCodeSnapshot: "PARTNERX",
      ...over,
    })
    .returning();
  return lead;
}

async function rondAf(leadId: string) {
  const v = await afronding.bereidDemoAfrondingVoor({ leadId, actorId: admin.id, maak });
  if (!v.ok) throw new Error(v.reden);
  const s = await afronding.verstuurDemoAfsluiting({ leadId, documentId: v.documentId, actorId: admin.id, onderwerp: v.onderwerp, tekst: v.tekst });
  assert.equal(s.ok, true);
  return v.documentId;
}

async function zetStatus(id: string, status: string) {
  alsAdmin();
  const fd = new FormData();
  fd.set("id", id);
  fd.set("status", status);
  fd.set("notities", "");
  const r = await leadActies.updateLead({ status: "idle" }, fd);
  assert.equal(r.status, "success", r.message);
}

const vind = async (id: string) => (await laadAanvragen())!.find((a) => a.lead.id === id)!;

/* --------------------------------------------------------------- puur -- */

describe("wat een afgeronde demo is (puur)", () => {
  const t = (d: number) => new Date(Date.UTC(2026, 8, d));
  it("afgevallen + laatste gebeurtenis is een geslaagde afronding", () => {
    assert.deepEqual(tekst.demoAfgerondOp("afgevallen", { demoAfgerond: t(30), heropend: null, handmatigAfgevallen: null }), t(30));
  });
  it("met de hand afgevallen zonder demo-afronding: géén afgeronde demo", () => {
    assert.equal(tekst.demoAfgerondOp("afgevallen", { demoAfgerond: null, heropend: null, handmatigAfgevallen: t(30) }), null);
  });
  it("afgerond, heropend en daarna met de hand afgevallen: géén afgeronde demo", () => {
    assert.equal(tekst.demoAfgerondOp("afgevallen", { demoAfgerond: t(10), heropend: t(12), handmatigAfgevallen: t(20) }), null);
  });
  it("afgerond maar weer actief: géén afgeronde demo", () => {
    assert.equal(tekst.demoAfgerondOp("demo verstuurd", { demoAfgerond: t(10), heropend: null, handmatigAfgevallen: null }), null);
  });
  it("heropend en daarna opnieuw afgerond: wél, met de nieuwe datum", () => {
    assert.deepEqual(tekst.demoAfgerondOp("afgevallen", { demoAfgerond: t(25), heropend: t(12), handmatigAfgevallen: null }), t(25));
  });
});

/* --------------------------------------------------------- de lijst -- */

describe("werkvoorraad en afgeronde demo's", async () => {
  const actief = await aanvraag("Actieve Kennel");
  const afgerond = await aanvraag("Walk and Care Test", { naam: "Robin Voorbeeld", email: "info@walk-care.test" });
  const ouder = await aanvraag("Oudere Afronding");
  const geenInteresse = await aanvraag("Geen Interesse BV", { stage: "aangevraagd", status: "nieuw", demoSentAt: null, demoDomain: null });

  const pdfOuder = await rondAf(ouder.id);
  await new Promise((r) => setTimeout(r, 15));
  const pdfAfgerond = await rondAf(afgerond.id);
  await zetStatus(geenInteresse.id, "afgevallen");

  it("een actieve demo blijft bij Aanvragen", async () => {
    const a = await vind(actief.id);
    assert.equal(a.afleiding.afgerondeDemo, false);
    assert.equal(a.demoAfsluiting, null);
  });

  it("een afgeronde demo verdwijnt uit Aanvragen en staat bij Afgeronde demo's", async () => {
    const alle = (await laadAanvragen())!;
    const w = aanvragenWeergave(alle, { archief: false, bakje: null, zoek: "" });
    assert.ok(!w.werkvoorraad.some((a) => a.lead.id === afgerond.id));
    assert.ok(!w.zichtbaar.some((a) => a.lead.id === afgerond.id));
    assert.ok(w.afgerondeDemos.some((a) => a.lead.id === afgerond.id));
    const a = await vind(afgerond.id);
    assert.equal(a.demoAfsluiting?.pdfId, pdfAfgerond);
    assert.equal(a.demoAfsluiting?.mailNaar, "info@walk-care.test");
  });

  it("een met de hand afgevallen aanvraag is GEEN afgeronde demo", async () => {
    const a = await vind(geenInteresse.id);
    assert.equal(a.afleiding.afgerondeDemo, false);
    assert.equal(a.afleiding.bakje, "afgevallen");
    const alle = (await laadAanvragen())!;
    const w = aanvragenWeergave(alle, { archief: false, bakje: null, zoek: "" });
    assert.ok(!w.afgerondeDemos.some((x) => x.lead.id === geenInteresse.id));
    assert.ok(!w.lopend.some((x) => x.lead.id === geenInteresse.id), "niet in 'Alles' van de werkvoorraad");
    const bakje = aanvragenWeergave(alle, { archief: false, bakje: "afgevallen", zoek: "" });
    assert.ok(bakje.zichtbaar.some((x) => x.lead.id === geenInteresse.id), "wel vindbaar via het bakje Afgevallen");
    const [e] = await db.select().from(schema.journeyEvents).where(and(eq(schema.journeyEvents.leadId, geenInteresse.id), eq(schema.journeyEvents.kind, "aanvraag_afgevallen")));
    assert.ok(e?.internal, "de handmatige statuswijziging staat intern op de tijdlijn");
  });

  it("zoeken in de afgeronde demo's: op bedrijfsnaam, contactpersoon en e-mail", async () => {
    const alle = (await laadAanvragen())!;
    for (const q of ["walk and care", "Robin", "info@walk-care.test"]) {
      const w = aanvragenWeergave(alle, { archief: true, bakje: null, zoek: q });
      assert.deepEqual(w.zichtbaar.map((a) => a.lead.id), [afgerond.id], q);
    }
  });

  it("sortering: meest recent afgerond bovenaan", async () => {
    const w = aanvragenWeergave((await laadAanvragen())!, { archief: true, bakje: null, zoek: "" });
    const ids = w.afgerondeDemos.map((a) => a.lead.id);
    assert.ok(ids.indexOf(afgerond.id) < ids.indexOf(ouder.id));
  });

  it("de PDF blijft gekoppeld en bewaard", async () => {
    const [bestand] = await db.select().from(schema.documentFiles).where(eq(schema.documentFiles.documentId, pdfOuder));
    assert.ok(bestand);
  });

  it("heropenen: terug in Aanvragen, journey kan verder, en alle historie blijft", async () => {
    const res = await afronding.heropenAanvraag({ leadId: afgerond.id, actorId: admin.id });
    assert.equal(res.ok, true);
    const a = await vind(afgerond.id);
    assert.equal(a.afleiding.afgerondeDemo, false);
    assert.equal(a.lead.status, "demo verstuurd");
    assert.equal(a.afleiding.bakje !== "afgevallen", true);
    const w = aanvragenWeergave((await laadAanvragen())!, { archief: false, bakje: null, zoek: "" });
    assert.ok(w.lopend.some((x) => x.lead.id === afgerond.id), "weer in de werkvoorraad");
    assert.ok(!w.afgerondeDemos.some((x) => x.lead.id === afgerond.id));
    assert.equal(a.afleiding.actie.cta?.action, "demo-akkoord", "de normale journey (Klant wil doorgaan) is terug");

    // Historie blijft historie.
    const docs = await db.select().from(schema.documents).where(and(eq(schema.documents.leadId, afgerond.id), eq(schema.documents.type, "DEMO_PDF")));
    assert.equal(docs.length, 1);
    assert.ok(docs[0].sentAt, "de PDF staat nog als verstuurd geregistreerd");
    const mails = await db.select().from(schema.emails).where(and(eq(schema.emails.leadId, afgerond.id), eq(schema.emails.soort, "demo-afsluiting")));
    assert.equal(mails.length, 1);
    const kinds = (await db.select().from(schema.journeyEvents).where(eq(schema.journeyEvents.leadId, afgerond.id))).map((e) => e.kind);
    for (const k of ["demo_pdf_gemaakt", "email_sent", "demo_afgerond", "aanvraag_heropend"]) assert.ok(kinds.includes(k), k);
    assert.equal(a.lead.referralCodeSnapshot, "PARTNERX", "de herkomst blijft");
  });

  it("met de hand terugzetten telt ook als heropenen; daarna met de hand afgevallen is géén afgeronde demo", async () => {
    await zetStatus(ouder.id, "demo verstuurd");
    assert.equal((await vind(ouder.id)).afleiding.afgerondeDemo, false);
    await zetStatus(ouder.id, "afgevallen");
    const a = await vind(ouder.id);
    assert.equal(a.afleiding.afgerondeDemo, false, "afgevallen om een andere reden dan de demo-afronding");
    assert.equal(a.afleiding.bakje, "afgevallen");
  });

  it("alleen een beheerder kan de status wijzigen", async () => {
    alsNiemand();
    const fd = new FormData();
    fd.set("id", actief.id);
    fd.set("status", "afgevallen");
    assert.equal((await leadActies.updateLead({ status: "idle" }, fd)).message, "Geen toegang.");
    assert.equal((await vind(actief.id)).lead.status, "demo verstuurd");
  });
});
