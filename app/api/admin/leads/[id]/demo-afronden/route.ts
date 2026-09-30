import { NextResponse } from "next/server";
import { getAdminActor } from "@/lib/admin-auth";
import { bereidDemoAfrondingVoor } from "@/lib/demo-afronding";

/**
 * Stap 1 van "Demo afronden": de PDF van de voorbeeldwebsite maken en bij de
 * aanvraag bewaren, en een concept van de afsluitmail klaarzetten. Er gaat
 * niets naar de klant en de aanvraag verandert niet van status.
 *
 * Een eigen route (en geen server action op de aanvraagpagina) omdat hier een
 * headless browser draait: dat mag ruim de tijd krijgen en blijft zo buiten
 * de bundel van de adminpagina.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ ok: false, reden: "Geen toegang." }, { status: 403 });
  const { id } = await params;
  const res = await bereidDemoAfrondingVoor({ leadId: id, actorId: actor.id });
  return NextResponse.json(res, { status: res.ok ? 200 : 422 });
}
