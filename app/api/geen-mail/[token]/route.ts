import { NextResponse } from "next/server";
import { meldAf } from "@/lib/groei/afmelden";
import { branding } from "@/lib/branding";

/**
 * Het één-klik-afmelden van mailprogramma's (RFC 8058).
 *
 * Gmail en Outlook tonen naast een zakelijke mail hun eigen "Afmelden"-knop.
 * Drukt iemand daarop, dan doet hun server een POST hierheen — zonder mens,
 * zonder pagina. Dat moet gewoon werken, anders belandt de rest van je post
 * in de spammap.
 *
 * Een GET meldt niemand af: mailprogramma's laden links vooruit, en dan zou
 * openen al afmelden betekenen. Die stuurt door naar de pagina met de knop.
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const uit = await meldAf(token);

  // Ook bij een onbekende token een 200: de afzender van de POST is een
  // mailserver, en die hoeft niet te weten of dit adres bij ons bestaat.
  return NextResponse.json({ ok: uit.status !== "onbekend" });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return NextResponse.redirect(`${branding.siteUrl}/geen-mail/${token}`, 302);
}
