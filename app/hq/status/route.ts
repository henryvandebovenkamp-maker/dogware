import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getOwnerActor } from "@/lib/hq-auth";
import { runAuditedHqAction } from "@/lib/hq/audit";

/**
 * Alleen-lezen statusendpoint van HQ.
 *
 * Bestaat om te kunnen aantonen dat een directe request — buiten elke pagina
 * en layout om — opnieuw door de eigenaarscontrole moet. Onbevoegd krijgt een
 * kaal 404-antwoord zonder body: geen foutmelding, geen hint dat dit pad
 * bestaat, geen enkel gegeven.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const actor = await getOwnerActor();
  if (!actor) return new NextResponse(null, { status: 404 });

  const requestId = randomUUID();

  try {
    const payload = await runAuditedHqAction(
      {
        actorUserId: actor.id,
        action: "HQ_STATUS_READ",
        requestId,
        model: null,
        meta: { bron: "route_handler", readOnly: true },
      },
      async () => ({
        status: "ok" as const,
        readOnly: true,
        model: null,
        requestId,
        gecontroleerdOp: new Date().toISOString(),
      }),
    );
    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    });
  } catch {
    // Kon de handeling niet geregistreerd worden, dan geven we geen resultaat.
    // Bewust geen foutdetails: die zeggen iets over de binnenkant.
    return new NextResponse(null, { status: 503 });
  }
}
