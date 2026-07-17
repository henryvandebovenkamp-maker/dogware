import { NextResponse, type NextRequest } from "next/server";
import { findPartnerByCode, partnerCanRefer, recordReferralVisit } from "@/lib/referral";
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
    // Een net uitgenodigde of actieve partner laat de link direct werken;
    // gepauzeerde/geblokkeerde/beëindigde partners doen bewust niets.
    if (partner && partnerCanRefer(partner.status)) {
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
