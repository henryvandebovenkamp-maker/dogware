"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import {
  logGroeiEvent,
  magVerzenden,
  setStap,
  voorstelToken,
} from "@/lib/groei";
import { aiBeschikbaar, schrijfBericht } from "@/lib/groei/ai";
import { laatsteAnalyse, onderzoekProspect } from "@/lib/groei/onderzoek";
import { sendNotification } from "@/lib/email/send";
import { branding } from "@/lib/branding";
import type { GroeiGrondslag } from "@/lib/db/schema";

export type GroeiState = { status: "idle" | "ok" | "error"; message?: string };

const schoon = (v: FormDataEntryValue | null, max = 300) =>
  String(v ?? "").trim().slice(0, max);

/** Een collega toevoegen. Handmatig — bewust geen massale import. */
export async function voegBedrijfToe(
  _prev: GroeiState,
  form: FormData,
): Promise<GroeiState> {
  const user = await requireAdmin();
  const db = getDb();
  if (!db) return { status: "error", message: "Geen database." };

  const bedrijfsnaam = schoon(form.get("bedrijfsnaam"), 200);
  if (!bedrijfsnaam) return { status: "error", message: "Vul een bedrijfsnaam in." };

  const website = schoon(form.get("website"), 500);
  const email = schoon(form.get("email"), 320).toLowerCase();
  const grondslag = schoon(form.get("grondslag"), 40) as GroeiGrondslag;

  const [rij] = await db
    .insert(schema.groeiProspects)
    .values({
      ownerUserId: user.id,
      bedrijfsnaam,
      branche: schoon(form.get("branche"), 40) || null,
      plaats: schoon(form.get("plaats"), 120) || null,
      website: website || null,
      email: email || null,
      voornaam: schoon(form.get("voornaam"), 80) || null,
      grondslag: ["rechtspersoon", "toestemming", "klantrelatie"].includes(grondslag)
        ? grondslag
        : "onbekend",
      // Herkomst vastleggen is geen bijzaak: onder de AVG moet je kunnen
      // verantwoorden hoe je aan iemands gegevens komt.
      herkomst: { bron: schoon(form.get("herkomst"), 200) || "handmatig toegevoegd" },
    })
    .returning({ id: schema.groeiProspects.id });

  if (rij) {
    await logGroeiEvent(rij.id, "gevonden", `${bedrijfsnaam} toegevoegd`);
    await logActivity({
      actorUserId: user.id,
      action: "groei.prospect_toegevoegd",
      objectType: "groei_prospect",
      objectId: rij.id,
      newValue: { bedrijfsnaam },
    });
  }

  revalidatePath("/admin/groei");
  revalidatePath("/admin/groei/bedrijven");
  return { status: "ok" };
}

/**
 * Website lezen en er een opbouwend oordeel over vormen, daarna meteen een
 * conceptbericht schrijven. Henry hoeft alleen nog te lezen en te beslissen.
 */
export async function bereidVoor(
  _prev: GroeiState,
  form: FormData,
): Promise<GroeiState> {
  const user = await requireAdmin();
  const db = getDb();
  if (!db) return { status: "error", message: "Geen database." };
  if (!aiBeschikbaar()) {
    return {
      status: "error",
      message: "AI_GATEWAY_API_KEY ontbreekt — voorbereiden staat uit.",
    };
  }

  const id = schoon(form.get("id"), 40);
  const [p] = await db
    .select()
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, id))
    .limit(1);
  if (!p) return { status: "error", message: "Bedrijf niet gevonden." };
  if (!p.website) {
    return { status: "error", message: "Zonder website valt er niets te bekijken." };
  }

  // Zelfde onderzoek als de Onderzoeksagent doet: contactadres, grondslag en
  // analyse in één doorloop. Eén implementatie, twee aanroepers.
  //
  // Heeft de agent dit bedrijf net al bekeken, dan gebruiken we dat werk. Hun
  // server twee keer in een week bevragen voor hetzelfde antwoord is onnodig.
  const recent = await laatsteAnalyse(p.id);
  const versGenoeg =
    recent && Date.now() - recent.createdAt.getTime() < 14 * 24 * 60 * 60 * 1000;

  let onderzocht: Awaited<ReturnType<typeof onderzoekProspect>>;
  try {
    onderzocht = versGenoeg
      ? { status: "gelukt", detailCount: recent.details.length, past: recent.past, emailGevonden: Boolean(p.email) }
      : await onderzoekProspect(p);
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "groei.onderzoek_fout",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return { status: "error", message: "Het bekijken van hun site ging mis. Probeer het opnieuw." };
  }

  if (onderzocht.status === "overgeslagen") {
    return { status: "error", message: `Overgeslagen: ${onderzocht.reden}.` };
  }
  if (onderzocht.status === "mislukt") {
    return {
      status: "error",
      message: "Hun website was niet te lezen. Probeer het later nog eens.",
    };
  }

  const opgeslagen = versGenoeg ? recent : await laatsteAnalyse(p.id);
  if (!opgeslagen) {
    return { status: "error", message: "De analyse is niet opgeslagen. Probeer het opnieuw." };
  }
  // De kolom mag leeg zijn; het schrijven verderop rekent op een tekst.
  const analyse = {
    ...opgeslagen,
    passendheidUitleg: opgeslagen.passendheidUitleg ?? "",
  };

  if (!analyse.past) {
    revalidatePath(`/admin/groei/bedrijven/${p.id}`);
    return { status: "ok", message: "Bekeken. Mijn advies: dit bedrijf overslaan." };
  }

  try {
    // Zinnen die eerder een menselijke reactie opleverden — toon, geen sjabloon.
    const bibliotheek = await db
      .select({ tekst: schema.groeiIdeeen.tekst })
      .from(schema.groeiIdeeen)
      .where(eq(schema.groeiIdeeen.ownerUserId, user.id))
      .orderBy(desc(schema.groeiIdeeen.raakScore))
      .limit(5);

    const bericht = await schrijfBericht({
      bedrijfsnaam: p.bedrijfsnaam,
      voornaam: p.voornaam,
      branche: p.branche,
      analyse,
      eerdereZinnenDieWerkten: bibliotheek.map((b) => b.tekst),
    });

    const [voorstel] = await db
      .insert(schema.groeiVoorstellen)
      .values({
        prospectId: p.id,
        token: voorstelToken(),
        titel: `Een paar ideeën voor ${p.bedrijfsnaam}`,
        intro: analyse.passendheidUitleg,
        secties: analyse.kansen.map((k) => ({
          kop: k.titel,
          tekst: k.waarom,
          module: k.module,
        })),
      })
      .returning({ id: schema.groeiVoorstellen.id });

    await db.insert(schema.groeiBerichten).values({
      prospectId: p.id,
      voorstelId: voorstel?.id ?? null,
      onderwerp: bericht.onderwerp,
      tekst: bericht.tekst,
      model: bericht.model,
    });

    await logGroeiEvent(p.id, "voorbereid", "Voorstel en conceptbericht klaargezet");
    await setStap(p.id, "voorbereid");

    revalidatePath("/admin/groei");
    revalidatePath(`/admin/groei/bedrijven/${p.id}`);
    return { status: "ok", message: "Klaar. Lees het even na voordat je verstuurt." };
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "groei.voorbereiden_fout",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return { status: "error", message: "Het voorbereiden ging mis. Probeer het opnieuw." };
  }
}

/** Verzenden — alleen als het verzendslot opengaat. Henry drukt op de knop. */
export async function verstuurBericht(
  _prev: GroeiState,
  form: FormData,
): Promise<GroeiState> {
  const user = await requireAdmin();
  const db = getDb();
  if (!db) return { status: "error", message: "Geen database." };

  const berichtId = schoon(form.get("berichtId"), 40);
  const tekst = String(form.get("tekst") ?? "").trim();
  const onderwerp = schoon(form.get("onderwerp"), 200);

  const [b] = await db
    .select()
    .from(schema.groeiBerichten)
    .where(eq(schema.groeiBerichten.id, berichtId))
    .limit(1);
  if (!b) return { status: "error", message: "Bericht niet gevonden." };
  if (b.verstuurdAt) return { status: "error", message: "Dit bericht is al verstuurd." };

  const oordeel = await magVerzenden(b.prospectId);
  if (!oordeel.mag) {
    return { status: "error", message: `${oordeel.reden}. ${oordeel.uitleg}` };
  }

  const [p] = await db
    .select()
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, b.prospectId))
    .limit(1);
  if (!p?.email) return { status: "error", message: "Geen e-mailadres." };

  const [voorstel] = b.voorstelId
    ? await db
        .select({ token: schema.groeiVoorstellen.token })
        .from(schema.groeiVoorstellen)
        .where(eq(schema.groeiVoorstellen.id, b.voorstelId))
        .limit(1)
    : [];

  const link = voorstel ? `${branding.siteUrl}/voorstel/${voorstel.token}` : branding.siteUrl;
  const body = (tekst || b.tekst).replaceAll("{{voorstel}}", link);

  // LET OP: dit gebruikt voorlopig de interne notificatietemplate. Die ziet
  // eruit als een systeembericht, terwijl deze mail juist persoonlijk moet
  // ogen. Er hoort nog een sobere "van Henry"-template te komen.
  const resultaat = await sendNotification(
    onderwerp || b.onderwerp,
    body,
    p.email,
  );

  if (!resultaat.ok) {
    return { status: "error", message: "Versturen mislukte. Probeer het opnieuw." };
  }

  await db
    .update(schema.groeiBerichten)
    .set({
      verstuurdAt: new Date(),
      tekst: body,
      onderwerp: onderwerp || b.onderwerp,
      bewerktDoorHenry: body !== b.tekst,
    })
    .where(eq(schema.groeiBerichten.id, b.id));

  await logGroeiEvent(p.id, "verstuurd", `Bericht verstuurd naar ${p.email}`);
  await setStap(p.id, "verstuurd");
  await logActivity({
    actorUserId: user.id,
    action: "groei.bericht_verstuurd",
    objectType: "groei_prospect",
    objectId: p.id,
    newValue: { bedrijfsnaam: p.bedrijfsnaam, naar: p.email },
  });

  revalidatePath("/admin/groei");
  revalidatePath(`/admin/groei/bedrijven/${p.id}`);
  return { status: "ok", message: "Verstuurd." };
}
