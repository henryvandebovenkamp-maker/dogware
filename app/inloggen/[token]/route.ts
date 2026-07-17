import { NextResponse, type NextRequest } from "next/server";
import { verifyLoginToken } from "@/lib/auth/challenge";

/**
 * Magic Link-landing: /inloggen/<token>
 *
 * - Eenmalig bruikbaar, 10 minuten geldig (server-side afgedwongen).
 * - Redirect uitsluitend naar interne, rolgebaseerde bestemmingen —
 *   nooit naar een adres uit de URL (geen open redirect).
 * - Mailscanners/preview-bots verbruiken de link niet.
 */

const BOT_UA =
  /bot|crawler|spider|preview|scan|facebookexternalhit|whatsapp|telegram|slack|discord|linkpreview|headless/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Link-previews en mailscanners mogen de eenmalige link niet opmaken
  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) {
    return new NextResponse(null, { status: 204 });
  }

  const result = await verifyLoginToken(token);
  if (!result.ok) {
    const url = new URL("/partner/login", request.url);
    url.searchParams.set("melding", "link-verlopen");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(result.destination, request.url));
}
