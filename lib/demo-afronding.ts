import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { DogDocument, Lead } from "@/lib/db/schema";
import { registerDocument } from "@/lib/documents";
import { logEmail, logJourneyEvent, statusBijStage } from "@/lib/journey";
import { logActivity } from "@/lib/audit";
import { ensureCommerce } from "@/lib/proposals";
import { sendDemoAfsluiting, sendDemoAfsluitingProef } from "@/lib/email/send";
import { DemoPdfFout, maakDemoPdf, type DemoPdf } from "@/lib/demo-pdf/maak";
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

/**
 * Stap 1: de PDF maken en bewaren, en een concept van de mail klaarzetten.
 * Er gaat niets naar de klant en de status van de aanvraag verandert niet.
 */
export async function bereidDemoAfrondingVoor(input: {
  leadId: string;
  actorId: string;
  nu?: Date;
  /** Te vervangen in tests; standaard de echte browser. */
  maak?: typeof maakDemoPdf;
}): Promise<Uitkomst<Voorbereid>> {
  const db = getDb();
  if (!db) return { ok: false, reden: "Database niet beschikbaar." };
  const lead = await laadLead(input.leadId);
  if (!lead) return { ok: false, reden: "Aanvraag niet gevonden." };
  const mag = magDemoAfronden(lead);
  if (!mag.ok) return mag;
  const commerce = await ensureCommerce(lead.id);
  if (!commerce) return { ok: false, reden: "Aanvraag niet gevonden." };

  const nu = input.nu ?? new Date();
  let pdf: DemoPdf;
  try {
    pdf = await (input.maak ?? maakDemoPdf)({
      demoUrl: lead.demoDomain!.trim(),
      portaalUrl: lead.demoPortalUrl,
      bedrijfsnaam: lead.bedrijfsnaam,
      demoDatum: lead.demoSentAt,
      nu,
    });
  } catch (err) {
    const reden =
      err instanceof DemoPdfFout ? err.message : "De PDF kon niet worden gemaakt. Probeer het later opnieuw.";
    await logJourneyEvent(lead.id, "demo_pdf_mislukt", `Demo-PDF maken mislukt: ${reden}`, {
      actor: "admin",
      internal: true,
    });
    return { ok: false, reden };
  }

  const versie = (await demoPdfsVan(lead.id)).length + 1;
  const bestandsnaam = bestandsnaamVoor(lead.bedrijfsnaam, nu, versie);
  const sha256 = createHash("sha256").update(pdf.pdf).digest("hex");

  const doc = await registerDocument({
    leadId: lead.id,
    commerceId: commerce.id,
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
      grootte: pdf.pdf.byteLength,
      sha256,
      gemaaktDoor: input.actorId,
      gemaaktOp: nu.toISOString(),
    },
  });
  if (!doc) return { ok: false, reden: "De PDF kon niet worden opgeslagen." };

  await db.insert(schema.documentFiles).values({
    documentId: doc.id,
    bestandsnaam,
    mime: "application/pdf",
    grootte: pdf.pdf.byteLength,
    sha256,
    inhoud: pdf.pdf,
  });

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
