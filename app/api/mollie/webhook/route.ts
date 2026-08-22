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
  /*
   * Onleesbare of onzinnige invoer is ruis, geen storing: daar helpt opnieuw
   * sturen niet tegen. Zulke verzoeken krijgen 200, zodat een willekeurige bot
   * die hier iets heen POST geen eindeloze retryreeks uitlokt. De 500 hieronder
   * is uitsluitend voor échte verwerkingsfouten — dáár helpt een retry wel.
   */
  let id: string;
  try {
    const form = await request.formData();
    id = String(form.get("id") ?? "");
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!id.startsWith("tr_")) return NextResponse.json({ ok: true });

  try {
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
