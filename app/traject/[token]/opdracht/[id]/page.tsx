import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isInvoiceType } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { processPaymentByMollieId } from "@/lib/commerce";
import { resolvePortal } from "@/lib/portal-access";
import { isMollieConfigured } from "@/lib/mollie";
import { euroFromCents } from "@/lib/money";
import { eindeVanDag, geldigheidLabel } from "@/lib/proposal-geldigheid";
import {
  betalingenVan,
  bevriesInhoud,
  getOpdracht,
  huidigeVersie,
  isOpdrachtVerlopen,
  maandZin,
  markeerBekeken,
} from "@/lib/opdrachten/service";
import { leesInhoud, type OpdrachtInhoud } from "@/lib/opdrachten/bedragen";
import { OpdrachtKlantView } from "@/components/commerce/opdracht-klant";

export const metadata: Metadata = {
  title: "Je opdracht bij DogWare",
  robots: { index: false, follow: false },
};

/** Altijd vers: een persoonlijke pagina met betaalstatus. */
export const dynamic = "force-dynamic";

const datum = (d: Date) =>
  d.toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Een aanvullende opdracht in de klantomgeving.
 *
 * Twee sloten, net als bij de factuur: de sleutel moet kloppen én de opdracht
 * moet bij dít dossier horen. Een concept bestaat voor de klant niet; een
 * beheerder ziet het als proef, met alle knoppen uitgeschakeld.
 */
export default async function OpdrachtKlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ betaling?: string }>;
}) {
  const { token, id } = await params;
  const { betaling } = await searchParams;
  const ctx = await resolvePortal(token);
  if (!ctx) notFound();
  const db = getDb();
  if (!db) notFound();

  let order = await getOpdracht(id, ctx.commerce.id);
  if (!order) notFound();
  const user = await getCurrentUser();
  const proef = Boolean(user?.roles.includes("SUPER_ADMIN"));
  if (order.status === "CONCEPT" && order.version === 0 && !proef) notFound();

  /*
   * Terug uit de Mollie-checkout. De terugkeer bewijst niets: we vragen de
   * echte status op via exact dezelfde, idempotente verwerking als de webhook.
   * Lukt dat niet, dan blijft de pagina eerlijk "even wachten" zeggen.
   */
  let terugUitMollie: "betaald" | "mislukt" | "wacht" | null = null;
  if (betaling === "terug") {
    const [laatste] = await betalingenVan(order.id);
    if (laatste?.molliePaymentId && ["OPEN", "PENDING"].includes(laatste.status)) {
      try {
        await processPaymentByMollieId(laatste.molliePaymentId);
      } catch {
        /* de webhook is de vangrails */
      }
    }
    const [vers] = await betalingenVan(order.id);
    terugUitMollie = !vers
      ? null
      : vers.status === "PAID"
        ? "betaald"
        : ["FAILED", "EXPIRED", "CANCELED"].includes(vers.status)
          ? "mislukt"
          : "wacht";
    order = (await getOpdracht(id, ctx.commerce.id)) ?? order;
  }

  if (!proef) await markeerBekeken(order);

  const wordtAangepast = order.status === "CONCEPT" && order.version > 0;
  const inhoud: OpdrachtInhoud =
    leesInhoud(order.acceptedSnapshot) ??
    (order.status === "CONCEPT" ? null : leesInhoud((await huidigeVersie(order))?.inhoud)) ??
    bevriesInhoud(order, ctx.commerce, order.version + 1);

  const betalingen = await betalingenVan(order.id);
  const laatsteVan = (type: string) => betalingen.find((p) => p.type === type)?.status ?? null;
  const facturen = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.extraOrderId, order.id),
        eq(schema.documents.commerceId, ctx.commerce.id),
        eq(schema.documents.visibleToCustomer, true),
        isNotNull(schema.documents.paymentId),
      ),
    )
    .orderBy(asc(schema.documents.issuedAt));

  const b = inhoud.bedragen;
  const m = inhoud.maand;

  return (
    <OpdrachtKlantView
      d={{
        token,
        orderId: order.id,
        bedrijfsnaam: ctx.lead.bedrijfsnaam,
        voornaam: ctx.lead.naam.split(" ")[0],
        volgnummer: order.volgnummer,
        status: order.status,
        versie: order.version,
        verlopen: isOpdrachtVerlopen(order),
        wordtAangepast: wordtAangepast && !proef,
        proef,
        mollieKlaar: isMollieConfigured(),
        inhoud: {
          titel: inhoud.titel || "Nieuwe opdracht",
          omschrijving: inhoud.omschrijving,
          werkzaamheden: inhoud.werkzaamheden,
          verwachteOplevering: inhoud.verwachteOplevering
            ? geldigheidLabel(eindeVanDag(inhoud.verwachteOplevering)!)
            : null,
          geldigTot: order.geldigTot ? geldigheidLabel(order.geldigTot) : null,
        },
        bedragen: {
          ex: euroFromCents(b.exVatCents),
          btw: euroFromCents(b.vatCents),
          btwPercent: b.vatPercent,
          incl: euroFromCents(b.inclVatCents),
          aanbetaling: euroFromCents(b.aanbetaling.inclVatCents),
          aanbetalingPercent: b.aanbetaling.percent,
          eindbetaling: euroFromCents(b.eindbetaling.inclVatCents),
          eindbetalingPercent: b.eindbetaling.percent,
        },
        maand: m
          ? {
              zin: maandZin(inhoud) ?? "",
              naarEx: euroFromCents(m.naarExVatCents),
              naarIncl: euroFromCents(m.naarInclVatCents),
              vanEx: euroFromCents(m.vanExVatCents),
              wanneer:
                m.ingang === "datum" && m.ingangDatum
                  ? `ingaand op ${geldigheidLabel(eindeVanDag(m.ingangDatum)!)}`
                  : "ingaand bij de oplevering",
            }
          : null,
        akkoord:
          order.acceptedAt && order.acceptedName
            ? { naam: order.acceptedName, op: datum(order.acceptedAt), versie: order.acceptedVersion ?? order.version }
            : null,
        betalingen: { aanbetaling: laatsteVan("EXTRA_DEPOSIT"), eindbetaling: laatsteVan("EXTRA_FINAL") },
        terugUitMollie,
        facturen: facturen
          .filter((f) => isInvoiceType(f.type))
          .map((f) => ({ nummer: f.nummer, titel: f.titel, bedrag: euroFromCents(f.totalInclVatCents) })),
      }}
    />
  );
}
