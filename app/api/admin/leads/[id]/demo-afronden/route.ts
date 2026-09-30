import { NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin-auth";
import { bereidDemoAfrondingVoor } from "@/lib/demo-afronding";

/**
 * Stap 1 van "Demo afronden": de PDF van de voorbeeldwebsite maken en bij de
 * aanvraag bewaren, en een concept van de afsluitmail klaarzetten. Er gaat
 * niets naar de klant en de aanvraag verandert niet van status.
 *
 * Een eigen route (en geen server action op de aanvraagpagina) omdat hier een
 * headless browser draait: die blijft zo buiten de bundel van de adminpagina.
 * De generator heeft een eigen deadline (LIMIETEN.totaal, 180 s) en stopt dus
 * ruim vóór maxDuration; die 300 s is alleen het vangnet. Valt het verzoek
 * weg, dan stopt de browser en wordt er niets bewaard.
 *
 * Het antwoord wordt gestreamd: elke paar seconden een lege regel, en als
 * laatste regel de uitkomst als JSON. Een verbinding waar een minuut niets
 * over gaat, wordt onderweg soms afgebroken en de POST dan automatisch
 * opnieuw verstuurd — precies zo startte er bij Erve Nyland na 60 s een
 * tweede browser naast de eerste. Met de hartslag blijft de verbinding
 * levend en is er maar één poging.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const HARTSLAG_MS = 5_000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ ok: false, reden: "Geen toegang." }, { status: 403 });
  const { id } = await params;

  const tekst = new TextEncoder();
  const stroom = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Is de beheerder al weg, dan kan er niets meer bij; dat mag nooit een crash worden.
      const schrijf = (s: string) => {
        try {
          controller.enqueue(tekst.encode(s));
        } catch {}
      };
      const hartslag = setInterval(() => schrijf("\n"), HARTSLAG_MS);
      try {
        const res = await bereidDemoAfrondingVoor({ leadId: id, actorId: actor.id, signal: req.signal });
        schrijf(`${JSON.stringify(res)}\n`);
      } catch (err) {
        console.error(JSON.stringify({ evt: "demo_pdf:route_fout", leadId: id, reden: err instanceof Error ? err.message : String(err) }));
        schrijf(`${JSON.stringify({ ok: false, reden: "De PDF kon niet worden gemaakt. Er is niets verstuurd en de aanvraag is niet afgerond." })}\n`);
      } finally {
        clearInterval(hartslag);
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stroom, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
