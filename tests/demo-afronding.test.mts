import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { maakTestDb } from "./test-db.mts";

/**
 * Demo afronden, van begin tot eind tegen een echte (in-process) Postgres.
 *
 * De browser is vervangen door een nep-`maak` die een kleine PDF teruggeeft
 * (of faalt zoals de echte dat zou doen). De echte schermafbeeldingen worden
 * los getest tegen een live demo; hier gaat het om de journey: niets naar de
 * klant vóór bevestiging, geen status bij een mislukte PDF of mail, nooit
 * twee afsluitmails, heropenen, en herkomst die bewaard blijft.
 */

process.env.AUTH_SECRET ??= "test-geheim-alleen-voor-de-testrunner-0123456789";

const { db } = await maakTestDb();
const { schema } = await import("../lib/db/index.ts");
const afronding = await import("../lib/demo-afronding.ts");
const tekst = await import("../lib/demo-afronding-tekst.ts");
const acties = await import("../app/actions/demo-afronding.ts");
const { DemoPdfFout } = await import("../lib/demo-pdf/maak.ts");
const { leidAf } = await import("../lib/aanvragen.ts");
const { hashToken } = await import("../lib/auth/crypto.ts");

type Mail = { type: string; to?: string; proef?: boolean; onderwerp?: string; alineas?: string[]; bijlage?: { bestandsnaam: string; grootte: number } };
const mails = () => ((globalThis as Record<string, unknown>).__verzondenMails as Mail[]) ?? [];
const afsluitmails = () => mails().filter((m) => m.type === "demo-afsluiting");
const zetMailFaalt = (v: boolean) => ((globalThis as Record<string, unknown>).__mailFaalt = v);

const NU = new Date("2026-09-30T08:00:00Z");
const dagenGeleden = (n: number) => new Date(NU.getTime() - n * 86_400_000);
const PDF = Buffer.from("%PDF-1.7\n% nep-pdf voor de test\n%%EOF");
const goedeMaak = async () => ({ pdf: PDF, paginas: 13, schermen: 10, routes: [{ pad: "/", titel: "Home", soort: "home" as const }] });

const ADMIN_TOKEN = randomBytes(24).toString("base64url");
const [admin] = await db
  .insert(schema.users)
  .values({ email: "admin@dogware.test", naam: "Beheerder", role: "SUPER_ADMIN", status: "ACTIVE" })
  .returning();
await db.insert(schema.userRoles).values({ userId: admin.id, role: "SUPER_ADMIN" });
await db.insert(schema.sessions).values({ userId: admin.id, tokenHash: hashToken(ADMIN_TOKEN), expiresAt: new Date(Date.now() + 86_400_000) });
const [partnerUser] = await db
  .insert(schema.users)
  .values({ email: "partner@dogware.test", naam: "Partner", role: "AFFILIATE_PARTNER", status: "ACTIVE" })
  .returning();
const [partner] = await db
  .insert(schema.partners)
  .values({ userId: partnerUser.id, referralCode: "PARTNERX" })
  .returning();

const alsAdmin = () => ((globalThis as Record<string, unknown>).__testCookies = { dw_session: ADMIN_TOKEN });
const alsNiemand = () => ((globalThis as Record<string, unknown>).__testCookies = {});

after(() => {
  delete (globalThis as Record<string, unknown>).__testDb;
  delete (globalThis as Record<string, unknown>).__testCookies;
  delete (globalThis as Record<string, unknown>).__mailFaalt;
});

beforeEach(() => zetMailFaalt(false));

async function demoAanvraag(over: Partial<typeof schema.leads.$inferInsert> = {}) {
  const [lead] = await db
    .insert(schema.leads)
    .values({
      bedrijfsnaam: "Walk&Care",
      naam: "Robin Smout",
      email: `robin-${randomBytes(3).toString("hex")}@walk-care.test`,
      plaats: "Oosterhout",
      source: "website",
      journeyVariant: "demo",
      stage: "demo-verstuurd",
      status: "demo verstuurd",
      demoDomain: "https://walk-care-demo.vercel.app/",
      demoPortalUrl: "https://walk-care-demo.vercel.app/login",
      demoSentAt: dagenGeleden(35),
      affiliatePartnerId: partner.id,
      firstTouchPartnerId: partner.id,
      referralCodeSnapshot: "PARTNERX",
      ...over,
    })
    .returning();
  return lead;
}

const leesLead = async (id: string) => (await db.select().from(schema.leads).where(eq(schema.leads.id, id)))[0];
const events = async (id: string) => db.select().from(schema.journeyEvents).where(eq(schema.journeyEvents.leadId, id));
const demoDocs = async (id: string) =>
  db.select().from(schema.documents).where(and(eq(schema.documents.leadId, id), eq(schema.documents.type, "DEMO_PDF")));

/* ---------------------------------------------------------------- tekst -- */

describe("de mail en de controles (puur)", () => {
  it("aanhef met de voornaam, nooit de bedrijfsnaam", () => {
    const m = tekst.standaardAfsluitmail({ naam: "Robin Smout", bedrijfsnaam: "Walk&Care", demoSentAt: dagenGeleden(35), nu: NU });
    assert.match(m.tekst, /^Hoi Robin,/);
    assert.match(m.tekst, /Een paar weken geleden heb ik met veel plezier een voorbeeldwebsite voor Walk&Care voor je gemaakt/);
    assert.match(m.tekst, /als bijlage bij deze e-mail/);
    assert.doesNotMatch(m.tekst, /niet gereageerd|laatste kans/i);
    assert.equal(m.onderwerp, "Je voorbeeldwebsite voor Walk&Care, om te bewaren");
  });

  it("ontbrekende voornaam, of de bedrijfsnaam in het naamveld: gewoon 'Hoi,'", () => {
    assert.match(tekst.standaardAfsluitmail({ naam: "  ", bedrijfsnaam: "Walk&Care", demoSentAt: null, nu: NU }).tekst, /^Hoi,\n/);
    assert.match(tekst.standaardAfsluitmail({ naam: "Walk&Care", bedrijfsnaam: "Walk&Care", demoSentAt: null, nu: NU }).tekst, /^Hoi,\n/);
    assert.equal(tekst.voornaamVan("robin smout"), "Robin");
  });

  it("bestandsnaam zoals afgesproken, met versie bij een tweede PDF", () => {
    assert.equal(tekst.bestandsnaamVoor("Walk&Care", NU), "walk-care-dogware-demo-2026-09-30.pdf");
    assert.equal(tekst.bestandsnaamVoor("Hondenschool Idéfix", NU, 2), "hondenschool-idefix-dogware-demo-2026-09-30-v2.pdf");
  });

  it("alinea's uit de editor: lege regel scheidt, enkele regel voegt samen", () => {
    assert.deepEqual(tekst.alineasUit("Hoi Robin,\n\nRegel een\nloopt door.\n\n\nSlot"), ["Hoi Robin,", "Regel een loopt door.", "Slot"]);
  });

  it("afronden mag alleen bij een verstuurde demo in de demofase, met URL en e-mailadres", () => {
    const basis = { journeyVariant: "demo" as const, demoSentAt: NU, demoDomain: "https://x.vercel.app", email: "a@b.nl", status: "demo verstuurd" as const, stage: "demo-verstuurd" as const };
    assert.equal(tekst.magDemoAfronden(basis).ok, true);
    assert.equal(tekst.magDemoAfronden({ ...basis, email: "" }).ok, false);
    assert.equal(tekst.magDemoAfronden({ ...basis, demoDomain: null }).ok, false);
    assert.equal(tekst.magDemoAfronden({ ...basis, demoSentAt: null }).ok, false);
    assert.equal(tekst.magDemoAfronden({ ...basis, status: "afgevallen" }).ok, false);
    assert.equal(tekst.magDemoAfronden({ ...basis, stage: "voorstel-verstuurd" }).ok, false);
    assert.equal(tekst.magDemoAfronden({ ...basis, journeyVariant: "direct" }).ok, false);
  });
});

/* -------------------------------------------------------------- journey -- */

describe("demo afronden: 35 dagen oud, met eerdere herinnering", async () => {
  const lead = await demoAanvraag();
  await db.insert(schema.journeyEvents).values({ leadId: lead.id, kind: "email_sent", label: "E-mail verstuurd (demo-reminder)", actor: "systeem" });
  let documentId = "";

  it("voorbereiden: PDF bewaard bij de aanvraag, niets naar de klant, status ongewijzigd", async () => {
    const res = await afronding.bereidDemoAfrondingVoor({ leadId: lead.id, actorId: admin.id, nu: NU, maak: goedeMaak });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    documentId = res.documentId;
    assert.equal(res.bestandsnaam, "walk-care-dogware-demo-2026-09-30.pdf");
    assert.match(res.tekst, /^Hoi Robin,/);

    const [doc] = await demoDocs(lead.id);
    assert.equal(doc.visibleToCustomer, false);
    assert.equal(doc.sentAt, null);
    const snap = doc.snapshot as Record<string, unknown>;
    assert.equal(snap.demoUrl, "https://walk-care-demo.vercel.app/");
    assert.equal(snap.versie, 1);
    assert.equal(snap.paginas, 13);
    assert.equal(typeof snap.sha256, "string");
    const [bestand] = await db.select().from(schema.documentFiles).where(eq(schema.documentFiles.documentId, doc.id));
    assert.equal(Buffer.from(bestand.inhoud).toString(), PDF.toString(), "het bestand zelf staat in de database");

    assert.equal((await leesLead(lead.id)).status, "demo verstuurd");
    assert.equal(afsluitmails().length, 0);
    assert.ok((await events(lead.id)).some((e) => e.kind === "demo_pdf_gemaakt" && e.internal));
  });

  it("proef naar mezelf: gaat naar henry@dogware.nl met de PDF, verandert niets", async () => {
    const res = await afronding.verstuurDemoAfsluiting({ leadId: lead.id, documentId, actorId: admin.id, onderwerp: "Onderwerp", tekst: "Hoi Robin,\n\nTest", proef: true });
    assert.equal(res.ok, true);
    const m = afsluitmails().at(-1)!;
    assert.equal(m.to, "henry@dogware.nl");
    assert.equal(m.proef, true);
    assert.equal(m.bijlage?.bestandsnaam, "walk-care-dogware-demo-2026-09-30.pdf");
    assert.equal((await leesLead(lead.id)).status, "demo verstuurd");
    assert.equal((await demoDocs(lead.id))[0].sentAt, null);
    assert.equal(afsluitmails().filter((x) => x.to === lead.email).length, 0, "de klant krijgt niets");
  });

  it("Resend mislukt: niets afgerond, claim vrijgegeven, fout gelogd", async () => {
    zetMailFaalt(true);
    const res = await afronding.verstuurDemoAfsluiting({ leadId: lead.id, documentId, actorId: admin.id, onderwerp: "Onderwerp", tekst: "Hoi Robin,\n\nTest" });
    assert.equal(res.ok, false);
    assert.equal((await leesLead(lead.id)).status, "demo verstuurd");
    assert.equal((await demoDocs(lead.id))[0].sentAt, null, "opnieuw proberen kan");
    const [log] = await db.select().from(schema.emails).where(and(eq(schema.emails.leadId, lead.id), eq(schema.emails.soort, "demo-afsluiting")));
    assert.equal(log.status, "FAILED");
  });

  it("dubbele klik (ook gelijktijdig): precies één afsluitmail", async () => {
    const [a, b] = await Promise.all([
      afronding.verstuurDemoAfsluiting({ leadId: lead.id, documentId, actorId: admin.id, onderwerp: "Je voorbeeldwebsite", tekst: "Hoi Robin,\n\nEen paar weken geleden…" }),
      afronding.verstuurDemoAfsluiting({ leadId: lead.id, documentId, actorId: admin.id, onderwerp: "Je voorbeeldwebsite", tekst: "Hoi Robin,\n\nEen paar weken geleden…" }),
    ]);
    assert.equal([a, b].filter((r) => r.ok).length, 1);
    assert.equal(afsluitmails().filter((x) => x.to === lead.email).length, 1);
    const nogEens = await afronding.verstuurDemoAfsluiting({ leadId: lead.id, documentId, actorId: admin.id, onderwerp: "x", tekst: "y" });
    assert.equal(nogEens.ok, false, "na afronden gaat er niets meer uit");
    assert.equal(afsluitmails().filter((x) => x.to === lead.email).length, 1);
  });

  it("na verzending: afgerond, geregistreerd, en de herkomst is er nog", async () => {
    const l = await leesLead(lead.id);
    assert.equal(l.status, "afgevallen");
    assert.equal(l.stage, "demo-verstuurd", "de stage blijft staan voor heropenen");
    assert.equal(l.affiliatePartnerId, partner.id);
    assert.equal(l.firstTouchPartnerId, partner.id);
    assert.equal(l.referralCodeSnapshot, "PARTNERX");
    assert.equal(l.source, "website");
    assert.equal(l.demoDomain, "https://walk-care-demo.vercel.app/", "de demo-URL blijft bewaard");

    const e = await events(lead.id);
    const afgerond = e.find((x) => x.kind === "demo_afgerond");
    assert.ok(afgerond && afgerond.internal && afgerond.actor === "admin");
    assert.equal((afgerond.meta as { door?: string }).door, admin.id);
    assert.ok(e.some((x) => x.kind === "email_sent" && /Afsluitmail verstuurd aan Robin Smout/.test(x.label)));

    const [doc] = await demoDocs(lead.id);
    assert.ok(doc.sentAt);
    assert.equal(doc.sentTo, lead.email);

    const afgerondOp = tekst.demoAfgerondOp(l.status, { demoAfgerond: afgerond.createdAt, heropend: null, handmatigAfgevallen: null });
    assert.ok(afgerondOp, "dit is een afgeronde demo");
    const a = leidAf({ id: l.id, stage: l.stage, status: l.status, demoSentAt: l.demoSentAt, laatsteContactAt: null, snapshot: { stage: l.stage, demoVerstuurd: true } as never, demoAfgerondAt: afgerondOp }, NU);
    assert.equal(a.afgerondeDemo, true);
    assert.equal(a.actieNodig, false);

    const [activiteit] = await db.select().from(schema.activityLog).where(eq(schema.activityLog.action, "DEMO_CLOSED"));
    assert.equal(activiteit.actorUserId, admin.id);
  });

  it("heropenen: status terug, journey kan verder, en later opnieuw afronden kan (PDF v2)", async () => {
    const res = await afronding.heropenAanvraag({ leadId: lead.id, actorId: admin.id });
    assert.equal(res.ok, true);
    assert.equal((await leesLead(lead.id)).status, "demo verstuurd");
    assert.ok((await events(lead.id)).some((e) => e.kind === "aanvraag_heropend"));
    assert.equal((await afronding.heropenAanvraag({ leadId: lead.id, actorId: admin.id })).ok, false, "twee keer heropenen kan niet");

    const opnieuw = await afronding.bereidDemoAfrondingVoor({ leadId: lead.id, actorId: admin.id, nu: NU, maak: goedeMaak });
    assert.equal(opnieuw.ok, true);
    if (opnieuw.ok) assert.equal(opnieuw.bestandsnaam, "walk-care-dogware-demo-2026-09-30-v2.pdf");
    assert.equal((await demoDocs(lead.id)).length, 2, "de eerste PDF blijft bewaard");
  });
});

describe("wat misgaat, laat de aanvraag zoals hij was", async () => {
  it("demo onbereikbaar / PDF mislukt: geen document, geen status, wel een interne regel", async () => {
    const lead = await demoAanvraag({ demoSentAt: dagenGeleden(40) });
    const res = await afronding.bereidDemoAfrondingVoor({
      leadId: lead.id,
      actorId: admin.id,
      nu: NU,
      maak: async () => {
        throw new DemoPdfFout("ONBEREIKBAAR", "De voorbeeldwebsite walk-care-demo.vercel.app is niet bereikbaar.");
      },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reden, /niet bereikbaar/);
    assert.equal((await demoDocs(lead.id)).length, 0);
    assert.equal((await leesLead(lead.id)).status, "demo verstuurd");
    assert.ok((await events(lead.id)).some((e) => e.kind === "demo_pdf_mislukt" && e.internal));
  });

  it("zonder e-mailadres of demo-URL begint het niet eens", async () => {
    const zonderMail = await demoAanvraag({ email: "" });
    const r1 = await afronding.bereidDemoAfrondingVoor({ leadId: zonderMail.id, actorId: admin.id, maak: goedeMaak });
    assert.equal(r1.ok, false);
    const zonderUrl = await demoAanvraag({ demoDomain: null });
    const r2 = await afronding.bereidDemoAfrondingVoor({ leadId: zonderUrl.id, actorId: admin.id, maak: goedeMaak });
    assert.equal(r2.ok, false);
    assert.equal((await demoDocs(zonderMail.id)).length + (await demoDocs(zonderUrl.id)).length, 0);
  });

  it("demo zonder herinnering: afronden werkt net zo", async () => {
    const lead = await demoAanvraag({ demoSentAt: dagenGeleden(30) });
    const res = await afronding.bereidDemoAfrondingVoor({ leadId: lead.id, actorId: admin.id, nu: NU, maak: goedeMaak });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const v = await afronding.verstuurDemoAfsluiting({ leadId: lead.id, documentId: res.documentId, actorId: admin.id, onderwerp: res.onderwerp, tekst: res.tekst });
    assert.equal(v.ok, true);
    assert.equal((await leesLead(lead.id)).status, "afgevallen");
  });

  it("een PDF van een andere aanvraag kan niet worden meegestuurd", async () => {
    const a = await demoAanvraag();
    const b = await demoAanvraag();
    const res = await afronding.bereidDemoAfrondingVoor({ leadId: a.id, actorId: admin.id, nu: NU, maak: goedeMaak });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const v = await afronding.verstuurDemoAfsluiting({ leadId: b.id, documentId: res.documentId, actorId: admin.id, onderwerp: "x", tekst: "y" });
    assert.equal(v.ok, false);
    assert.equal((await leesLead(b.id)).status, "demo verstuurd");
  });
});

describe("autorisatie", async () => {
  it("zonder beheerder: geen proef, geen verzending, niet heropenen", async () => {
    const lead = await demoAanvraag();
    alsNiemand();
    const fd = new FormData();
    fd.set("leadId", lead.id);
    fd.set("documentId", "00000000-0000-0000-0000-000000000000");
    fd.set("tekst", "Hoi");
    assert.equal((await acties.verstuurAfsluitmail({ status: "idle" }, fd)).message, "Geen toegang.");
    assert.equal((await acties.heropen({ status: "idle" }, fd)).message, "Geen toegang.");
    alsAdmin();
    const res = await acties.verstuurAfsluitmail({ status: "idle" }, fd);
    assert.equal(res.status, "error", "met beheerder komt hij wel door de poort (en faalt op de onbekende PDF)");
    assert.match(res.message ?? "", /PDF/);
  });
});
