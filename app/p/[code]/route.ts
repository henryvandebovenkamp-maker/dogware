import { NextResponse, type NextRequest } from "next/server";
import { findPartnerByCode, recordReferralVisit } from "@/lib/referral";
import { safeInternalPath } from "@/lib/roles";

/**
 * Publieke partnerlink: https://dogware.../p/DW-XXXXXX
 * Valideert de code server-side, registreert de click en stuurt door naar de
 * demo-ervaring. Een ongeldige code geeft nooit een foutpagina — gewoon /demo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  // Terugkeerpad: alleen veilige interne paden, standaard de demo-aanvraag.
  const next = safeInternalPath(request.nextUrl.searchParams.get("next")) ?? "/demo";
  const demoUrl = new URL(next, request.url);

  try {
    const partner = await findPartnerByCode(code);
    // Alleen actieve en gepauzeerde partners registreren bezoeken;
    // attributie zelf gebeurt uitsluitend voor ACTIVE (server-side).
    if (partner && (partner.status === "ACTIVE" || partner.status === "PAUSED")) {
      await recordReferralVisit(partner, {
        landingPage: `/p/${partner.referralCode}`,
        userAgent: request.headers.get("user-agent"),
        searchParams: request.nextUrl.searchParams,
      });
    }
  } catch (err) {
    // Registratieproblemen mogen de bezoeker nooit hinderen
    console.error(
      JSON.stringify({
        evt: "referral.visit_error",
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : "onbekend",
      }),
    );
  }

  return NextResponse.redirect(demoUrl);
}
