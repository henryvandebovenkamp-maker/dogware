"use server";

import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getOwnerActor } from "@/lib/hq-auth";
import { runAuditedHqAction } from "@/lib/hq/audit";

/**
 * De enige HQ-handeling van stap 1: een onschuldige statuscontrole.
 *
 * Hij bestaat vooral om aantoonbaar te maken dat een directe, onbevoegde POST
 * naar deze action opnieuw langs de eigenaarscontrole moet — een server action
 * is een gewone POST naar /hq en passeert de layout niet. En om te laten zien
 * dat elke HQ-handeling twee auditregels achterlaat.
 *
 * De action leest geen klantgegevens, raakt geen AI aan en verandert niets.
 */

export type HqStatusResult = {
  status: "ok";
  /** Serverklok, zodat zichtbaar is dat het antwoord vers is. */
  gecontroleerdOp: string;
  /** Het id waaronder deze controle in het auditlogboek staat. */
  requestId: string;
  /** In stap 1 per definitie leeg — er is geen model aangesloten. */
  model: null;
  readOnly: true;
};

export async function hqStatusCheck(): Promise<HqStatusResult> {
  // Eigen controle, los van de layout. Onbevoegd = bestaat niet.
  const actor = await getOwnerActor();
  if (!actor) notFound();

  const requestId = randomUUID();

  return runAuditedHqAction(
    {
      actorUserId: actor.id,
      action: "HQ_STATUS_READ",
      requestId,
      model: null, // stap 1: expliciet geen model
      meta: { bron: "server_action", readOnly: true },
    },
    async () => ({
      status: "ok" as const,
      gecontroleerdOp: new Date().toISOString(),
      requestId,
      model: null,
      readOnly: true as const,
    }),
  );
}
