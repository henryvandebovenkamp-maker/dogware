import { NextResponse, type NextRequest } from "next/server";
import { processPaymentByMollieId } from "@/lib/commerce";

/**
 * Mollie-webhook: de enige bron van waarheid voor betaalstatussen.
 *
 * Mollie stuurt alleen het payment-ID (id=tr_...). We halen de echte status
 * op bij Mollie en verwerken die idempotent. Werkt ook wanneer de klant de
 * browser nooit terug opent. Vertrouwt nooit statusdata uit de request zelf.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    if (!id.startsWith("tr_")) {
      // Onbekend/ongeldig ID — 200 zodat Mollie niet blijft retryen op ruis
      return NextResponse.json({ ok: true });
    }
    await processPaymentByMollieId(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log veilig (geen betaalgegevens) en geef 500 zodat Mollie het opnieuw stuurt
    console.error(
      JSON.stringify({
        evt: "mollie.webhook_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
