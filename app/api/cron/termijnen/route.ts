import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runTermijnRonde } from "@/lib/payment-reminders";

/**
 * Dagelijkse termijnronde (Vercel Cron, zie vercel.json).
 *
 * Vercel stuurt `Authorization: Bearer <CRON_SECRET>` mee. Zonder die
 * geheime waarde doet deze route niets: anders kan iedereen die de URL kent
 * klanten laten mailen. Ontbreekt CRON_SECRET in de omgeving, dan staat de
 * route dicht — liever geen herinneringen dan een open deur.
 */
export async function GET(request: NextRequest) {
  const geheim = process.env.CRON_SECRET;
  const kop = request.headers.get("authorization") ?? "";
  const verwacht = `Bearer ${geheim ?? ""}`;
  const a = Buffer.from(kop);
  const b = Buffer.from(verwacht);
  if (!geheim || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const uitkomst = await runTermijnRonde();
    console.log(JSON.stringify({ evt: "cron.termijnen", at: new Date().toISOString(), ...uitkomst }));
    return NextResponse.json({ ok: true, ...uitkomst });
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "cron.termijnen_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
