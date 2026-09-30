import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { DogDocument, Lead } from "@/lib/db/schema";
import { registerDocument } from "@/lib/documents";
import { logEmail, logJourneyEvent, statusBijStage } from "@/lib/journey";
import { logActivity } from "@/lib/audit";
import { ensureCommerce } from "@/lib/proposals";
import { sendDemoAfsluiting, sendDemoAfsluitingProef } from "@/lib/email/send";
import { DemoPdfFout, LIMIETEN, maakDemoPdf, type DemoPdf, type DemoPdfFoutCode } from "@/lib/demo-pdf/maak";
import {
  EVENT_DEMO_AFGEROND,
  EVENT_HEROPEND,
  afsluitmailOnderwerp,
  alineasUit,
  bestandsnaamVoor,
  magDemoAfronden,
  standaardAfsluitmail,
} from "@/lib/demo-afronding-tekst";

/**
 * Een demo netjes afronden — zonder iets weg te gooien.
 *
 * Drie dingen blijven strikt gescheiden:
 *   1. de commerciële aanvraag: blijft bestaan, krijgt alleen de bestaande
 *      eindstatus "afgevallen" en kan altijd heropend worden;
 *   2. documenten, mails en tijdlijn: de PDF wordt een DEMO_PDF-document met
 *      het bestand in de database, de mail gaat in het e-maillogboek;
 *   3. de tijdelijke demo zelf: wordt hier NIET aangeraakt. DogWare kent
 *      alleen de demo-URL, geen Vercel-project-ID, dus offline halen gebeurt
 *      handmatig; de aanvraag toont dat hij daar klaar voor is.
 *
 * Volgorde: voorbereiden (PDF maken en bewaren, niets naar de klant) →
 * controleren en eventueel proef naar jezelf → versturen. Pas na een
 * geslaagde verzending wordt de demo afgerond. Een mislukte PDF of mail laat
 * de aanvraag zoals hij was.
 */

export type Voorbereid = {
  documentId: string;
  bestandsnaam: string;
  paginas: number;
  grootte: number;
  onderwerp: string;
  tekst: string;
};

type Uitkomst<T> = ({ ok: true } & T) | { ok: false; reden: string };

async function laadLead(leadId: string): Promise<Lead | null> {
  const db = getDb();
  if (!db) return null;
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  return lead ?? null;
}

/** De laatst voorbereide, nog niet verstuurde demo-PDF — om verder te gaan waar je was. */
export async function openstaandeDemoPdf(leadId: string): Promise<DogDocument | null> {
  const db = getDb();
  if (!db) return null;
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.leadId, leadId),
        eq(schema.documents.type, "DEMO_PDF"),
        isNull(schema.documents.sentAt),
      ),
    )
    .orderBy(desc(schema.documents.issuedAt))
    .limit(1);
  return doc ?? null;
}

/** Alle demo-PDF's van een aanvraag, nieuwste eerst. */
export async function demoPdfsVan(leadId: string): Promise<DogDocument[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.leadId, leadId), eq(schema.documents.type, "DEMO_PDF")))
    .orderBy(desc(schema.documents.issuedAt));
}

/** Wat de beheerder ziet als de PDF niet lukt. Technische details staan in de serverlog. */
export const PDF_MELDING: Record<DemoPdfFoutCode | "ONBEKEND" | "BEZIG", string> = {
  TIJD: "De demo kon niet op tijd worden vastgelegd. Er is niets verstuurd en de aanvraag is niet afgerond. Probeer het opnieuw of controleer de demo.",
  ONBEREIKBAAR: "De demo kon niet worden geopend. Controleer of de demo-URL nog online is. Er is niets verstuurd en de aanvraag is niet afgerond.",
  TE_GROOT: "De PDF werd te groot om te mailen. Er is niets verstuurd en de aanvraag is niet afgerond.",
  AFGEBROKEN: "Het maken van de PDF is afgebroken. Er is niets verstuurd en de aanvraag is niet afgerond.",
  BROWSER: "De PDF kon niet worden gemaakt. Er is niets verstuurd en de aanvraag is niet afgerond.",
  LEEG: "De PDF kon niet worden gemaakt. Er is niets verstuurd en de aanvraag is niet afgerond.",
  ONBEKEND: "De PDF kon niet worden gemaakt. Er is niets verstuurd en de aanvraag is niet afgerond.",
  BEZIG: "Er wordt op dit moment al een PDF van deze demo gemaakt. Wacht tot die klaar is en vernieuw dan de pagina.",
};

const EVENT_PDF_GESTART = "demo_pdf_gestart";
/** Aanvragen waarvoor deze serverinstantie nu een PDF maakt. */
const bezigHier = new Set<string>();

/**
 * Wordt er op een andere instantie al een PDF gemaakt voor deze aanvraag?
 * Dat zie je aan een "gestart" zonder "gemaakt" of "mislukt" erna, binnen
 * de tijd die de generator maximaal mag duren. Een tweede
 * gelijktijdige browser zou beide pogingen trager maken, dus die start niet.
 */
async function pdfAlBezig(leadId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const sinds = new Date(Date.now() - (LIMIETEN.totaal + 60_000));
  const [gestart] = await db
    .select({ createdAt: schema.journeyEvents.createdAt })
    .from(schema.journeyEvents)
    .where(
      and(
        eq(schema.journeyEvents.leadId, leadId),
        eq(schema.journeyEvents.kind, EVENT_PDF_GESTART),
        gte(schema.journeyEvents.createdAt, sinds),
      ),
    )
    .orderBy(desc(schema.journeyEvents.createdAt))
    .limit(1);
  if (!gestart) return false;
  const [afgelopen] = await db
    .select({ id: schema.journeyEvents.id })
    .from(schema.journeyEvents)
    .where(
      and(
        eq(schema.journeyEvents.leadId, leadId),
        inArray(schema.journeyEvents.kind, ["demo_pdf_gemaakt", "demo_pdf_mislukt"]),
        gte(schema.journeyEvents.createdAt, gestart.createdAt),
      ),
    )
    .limit(1);
  return !afgelopen;
}

/**
 * Stap 1: de PDF maken en bewaren, en een concept van de mail klaarzetten.
 * Er gaat niets naar de klant en de status van de aanvraag verandert niet.
 * Lukt de PDF niet (of niet op tijd), dan wordt er ook niets bewaard.
 */
export async function bereidDemoAfrondingVoor(input: {
  leadId: string;
  actorId: string;
  nu?: Date;
  /** Valt het verzoek weg, dan stopt de browser en wordt er niets bewaard. */
  signal?: AbortSignal;
  /** Te vervangen in tests; standaard de echte browser. */
  maak?: typeof maakDemoPdf;
}): Promise<Uitkomst<Voorbereid>> {
  // Synchroon, vóór de eerste await: een dubbele klik op deze instantie komt hier niet langs.
  if (bezigHier.has(input.leadId)) return { ok: false, reden: PDF_MELDING.BEZIG };
  bezigHier.add(input.leadId);
  try {
    const db = getDb();
    if (!db) return { ok: false, reden: "Database niet beschikbaar." };
    const lead = await laadLead(input.leadId);
    if (!lead) return { ok: false, reden: "Aanvraag niet gevonden." };
    const mag = magDemoAfronden(lead);
    if (!mag.ok) return mag;
    if (await pdfAlBezig(lead.id)) return { ok: false, reden: PDF_MELDING.BEZIG };
    const commerce = await ensureCommerce(lead.id);
    if (!commerce) return { ok: false, reden: "Aanvraag niet gevonden." };
    return await maakEnBewaar(lead, commerce.id, input);
  } finally {
    bezigHier.delete(input.leadId);
  }
}

async function maakEnBewaar(
  lead: Lead,
  commerceId: string,
  input: { actorId: string; nu?: Date; signal?: AbortSignal; maak?: typeof maakDemoPdf },
): Promise<Uitkomst<Voorbereid>> {
  const db = getDb()!;
  await logJourneyEvent(lead.id, EVENT_PDF_GESTART, "Demo-PDF wordt gemaakt", { actor: "admin", internal: true });

  const nu = input.nu ?? new Date();
  let pdf: DemoPdf;
  try {
    pdf = await (input.maak ?? maakDemoPdf)({
      demoUrl: lead.demoDomain!.trim(),
      portaalUrl: lead.demoPortalUrl,
      bedrijfsnaam: lead.bedrijfsnaam,
      demoDatum: lead.demoSentAt,
      nu,
      signal: input.signal,
    });
  } catch (err) {
    const code = err instanceof DemoPdfFout ? err.code : "ONBEKEND";
    console.error(
      JSON.stringify({ evt: "demo_pdf:bereid_mislukt", leadId: lead.id, code, reden: err instanceof Error ? err.message : String(err) }),
    );
    await logJourneyEvent(lead.id, "demo_pdf_mislukt", `Demo-PDF maken mislukt: ${PDF_MELDING[code].split(".")[0]}.`, {
      actor: "admin",
      internal: true,
      code,
    });
    return { ok: false, reden: PDF_MELDING[code] };
  }
  // Is de beheerder intussen weg (verzoek afgebroken), dan bewaren we niets.
  if (input.signal?.aborted) {
    await logJourneyEvent(lead.id, "demo_pdf_mislukt", "Demo-PDF maken afgebroken: niets bewaard.", {
      actor: "admin",
      internal: true,
      code: "AFGEBROKEN",
    });
    return { ok: false, reden: PDF_MELDING.AFGEBROKEN };
  }

  const dbStart = Date.now();
  console.info(JSON.stringify({ evt: "demo_pdf:database:start", leadId: lead.id }));
  const versie = (await demoPdfsVan(lead.id)).length + 1;
  const bestandsnaam = bestandsnaamVoor(lead.bedrijfsnaam, nu, versie);
  const sha256 = createHash("sha256").update(pdf.pdf).digest("hex");

  const opslagMislukt = async (err?: unknown) => {
    console.error(JSON.stringify({ evt: "demo_pdf:opslaan_mislukt", leadId: lead.id, reden: err instanceof Error ? err.message : "geen document" }));
    await logJourneyEvent(lead.id, "demo_pdf_mislukt", "Demo-PDF maken mislukt: opslaan lukte niet.", { actor: "admin", internal: true, code: "OPSLAG" });
    return { ok: false as const, reden: "De PDF kon niet worden opgeslagen. Er is niets verstuurd en de aanvraag is niet afgerond." };
  };
  let opslagFout: unknown;
  const doc = await registerDocument({
    leadId: lead.id,
    commerceId,
    type: "DEMO_PDF",
    titel: `Demo-PDF — ${lead.bedrijfsnaam}`,
    visibleToCustomer: false,
    status: "CONCEPT",
    snapshot: {
      demoUrl: lead.demoDomain,
      portaalUrl: lead.demoPortalUrl,
      bestandsnaam,
      versie,
      paginas: pdf.paginas,
      schermen: pdf.schermen,
      routes: pdf.routes,
      overgeslagen: pdf.overgeslagen,
      duurMs: pdf.duurMs,
      grootte: pdf.pdf.byteLength,
      sha256,
      gemaaktDoor: input.actorId,
      gemaaktOp: nu.toISOString(),
    },
  }).catch((err) => {
    opslagFout = err;
    return null;
  });
  if (!doc) return opslagMislukt(opslagFout);

  try {
    await db.insert(schema.documentFiles).values({
      documentId: doc.id,
      bestandsnaam,
      mime: "application/pdf",
      grootte: pdf.pdf.byteLength,
      sha256,
      inhoud: pdf.pdf,
    });
  } catch (err) {
    // Geen half document: zonder bestand verdwijnt ook het document weer.
    await db.delete(schema.documents).where(eq(schema.documents.id, doc.id)).catch(() => {});
    return opslagMislukt(err);
  }
  console.info(JSON.stringify({ evt: "demo_pdf:database:done", leadId: lead.id, duurMs: Date.now() - dbStart }));

  await logJourneyEvent(
    lead.id,
    "demo_pdf_gemaakt",
    `Demo-PDF gemaakt — ${lead.bedrijfsnaam}, ${pdf.paginas} pagina's`,
    { actor: "admin", internal: true, documentId: doc.id, versie, bestandsnaam },
  );

  const mail = standaardAfsluitmail({
    naam: lead.naam,
    bedrijfsnaam: lead.bedrijfsnaam,
    demoSentAt: lead.demoSentAt,
    nu,
  });
  return {
    ok: true,
    documentId: doc.id,
    bestandsnaam,
    paginas: pdf.paginas,
    grootte: pdf.pdf.byteLength,
    onderwerp: mail.onderwerp,
    tekst: mail.tekst,
  };
}

async function laadDemoPdf(leadId: string, documentId: string) {
  const db = getDb();
  if (!db) return null;
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.leadId, leadId),
        eq(schema.documents.type, "DEMO_PDF"),
      ),
    )
    .limit(1);
  if (!doc) return null;
  const [bestand] = await db
    .select()
    .from(schema.documentFiles)
    .where(eq(schema.documentFiles.documentId, doc.id))
    .limit(1);
  return bestand ? { doc, bestand } : null;
}

/**
 * Stap 2: de afsluitmail versturen — of eerst als proef naar Henry.
 *
 * De echte verzending claimt de PDF (sentAt) vóór het versturen. Een dubbele
 * klik of een tweede tabblad krijgt de claim niet en verstuurt dus niets.
 * Mislukt de mail, dan wordt de claim teruggezet: opnieuw proberen kan
 * veilig en de aanvraag blijft zoals hij was.
 */
export async function verstuurDemoAfsluiting(input: {
  leadId: string;
  documentId: string;
  actorId: string;
  onderwerp: string;
  tekst: string;
  proef?: boolean;
}): Promise<Uitkomst<{ naar: string }>> {
  const db = getDb();
  if (!db) return { ok: false, reden: "Database niet beschikbaar." };
  const lead = await laadLead(input.leadId);
  if (!lead) return { ok: false, reden: "Aanvraag niet gevonden." };
  const pdf = await laadDemoPdf(lead.id, input.documentId);
  if (!pdf) return { ok: false, reden: "De PDF bij deze afronding is niet gevonden. Maak hem opnieuw." };

  const onderwerp = input.onderwerp.trim() || afsluitmailOnderwerp(lead.bedrijfsnaam);
  const alineas = alineasUit(input.tekst);
  if (alineas.length === 0) return { ok: false, reden: "De mail is leeg." };
  const bijlage = { bestandsnaam: pdf.bestand.bestandsnaam, inhoud: Buffer.from(pdf.bestand.inhoud) };

  if (input.proef) {
    const res = await sendDemoAfsluitingProef({
      klant: { naam: lead.naam, email: lead.email },
      onderwerp,
      alineas,
      bijlage,
    });
    await logEmail(lead.id, {
      soort: "demo-afsluiting (proef)",
      ontvanger: res.naar,
      onderwerp: `[Proef] ${onderwerp}`,
      ok: res.ok,
      providerId: res.ok ? res.id : undefined,
      fout: res.ok ? undefined : res.error.message,
    });
    await logJourneyEvent(
      lead.id,
      res.ok ? "demo_afsluiting_proef" : "demo_afsluiting_proef_mislukt",
      res.ok
        ? `Proef van de afsluitmail verstuurd naar ${res.naar} (bijlage: ${bijlage.bestandsnaam})`
        : `Proef van de afsluitmail mislukt: ${res.error.message}`,
      { actor: "admin", internal: true, documentId: pdf.doc.id, proef: true },
    );
    return res.ok ? { ok: true, naar: res.naar } : { ok: false, reden: res.error.message };
  }

  const mag = magDemoAfronden(lead);
  if (!mag.ok) return mag;

  // De claim: alleen wie hem krijgt, verstuurt.
  const [claim] = await db
    .update(schema.documents)
    .set({ sentAt: new Date(), sentTo: lead.email })
    .where(and(eq(schema.documents.id, pdf.doc.id), isNull(schema.documents.sentAt)))
    .returning({ id: schema.documents.id });
  if (!claim) return { ok: false, reden: "Deze afsluitmail is al verstuurd of wordt op dit moment verstuurd." };

  const res = await sendDemoAfsluiting({ to: lead.email, onderwerp, alineas, bijlage });
  await logEmail(lead.id, {
    soort: "demo-afsluiting",
    ontvanger: lead.email,
    onderwerp,
    ok: res.ok,
    providerId: res.ok ? res.id : undefined,
    fout: res.ok ? undefined : res.error.message,
  });

  if (!res.ok) {
    await db
      .update(schema.documents)
      .set({ sentAt: null, sentTo: null })
      .where(eq(schema.documents.id, pdf.doc.id));
    await logJourneyEvent(lead.id, "email_failed", `Afsluitmail mislukt naar ${lead.email}: ${res.error.message}`, {
      actor: "admin",
      internal: true,
      mailType: "demo-afsluiting",
    });
    return { ok: false, reden: `De mail kon niet worden verstuurd: ${res.error.message}. Er is niets afgerond; je kunt het opnieuw proberen.` };
  }

  await db
    .update(schema.documents)
    .set({ snapshot: { ...(pdf.doc.snapshot ?? {}), verstuurdOp: new Date().toISOString(), verstuurdDoor: input.actorId, mailId: res.id } })
    .where(eq(schema.documents.id, pdf.doc.id));

  await logJourneyEvent(
    lead.id,
    "email_sent",
    `Afsluitmail verstuurd aan ${lead.naam} · ${lead.email} (bijlage: ${bijlage.bestandsnaam})`,
    { actor: "admin", internal: true, mailType: "demo-afsluiting", documentId: pdf.doc.id },
  );

  const oud = lead.status;
  await db.update(schema.leads).set({ status: "afgevallen" }).where(eq(schema.leads.id, lead.id));
  await logJourneyEvent(
    lead.id,
    EVENT_DEMO_AFGEROND,
    "Demo afgerond — geen reactie na opvolging. Aanvraag blijft bewaard; de demo is klaar om offline te halen.",
    { actor: "admin", internal: true, documentId: pdf.doc.id, door: input.actorId, vorigeStatus: oud },
  );
  await logActivity({
    actorUserId: input.actorId,
    action: "DEMO_CLOSED",
    objectType: "lead",
    objectId: lead.id,
    oldValue: { status: oud },
    newValue: { status: "afgevallen", documentId: pdf.doc.id, mailId: res.id },
  });
  return { ok: true, naar: lead.email };
}

/**
 * Een afgevallen (of afgeronde) aanvraag weer openen. De status gaat terug
 * naar wat bij de stage hoort, zodat de journey gewoon verder kan richting
 * voorstel. Niets van de historie verdwijnt.
 */
export async function heropenAanvraag(input: { leadId: string; actorId: string }): Promise<Uitkomst<object>> {
  const db = getDb();
  if (!db) return { ok: false, reden: "Database niet beschikbaar." };
  const lead = await laadLead(input.leadId);
  if (!lead) return { ok: false, reden: "Aanvraag niet gevonden." };
  if (lead.status !== "afgevallen") return { ok: false, reden: "Deze aanvraag is niet afgerond." };

  const nieuw = statusBijStage(lead.stage);
  const [bijgewerkt] = await db
    .update(schema.leads)
    .set({ status: nieuw })
    .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.status, "afgevallen")))
    .returning({ id: schema.leads.id });
  if (!bijgewerkt) return { ok: false, reden: "Deze aanvraag is al heropend." };

  await logJourneyEvent(lead.id, EVENT_HEROPEND, "Aanvraag heropend — de journey kan verder", {
    actor: "admin",
    internal: true,
    door: input.actorId,
  });
  await logActivity({
    actorUserId: input.actorId,
    action: "LEAD_REOPENED",
    objectType: "lead",
    objectId: lead.id,
    oldValue: { status: "afgevallen" },
    newValue: { status: nieuw },
  });
  return { ok: true };
}
