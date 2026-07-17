import { NextResponse, type NextRequest } from "next/server";

/**
 * Vangt een referral-parameter op ELKE pagina op — ook op de homepage
 * (dogware.nl/?ref=CODE). We sturen de bezoeker één keer langs /p/CODE, dat
 * de click server-side valideert, registreert en de attributiecookie zet, en
 * daarna netjes terugstuurt naar de pagina die hij wilde bezoeken (?next=).
 *
 * Zo blijft de koppeling behouden, waar de partner de link ook naartoe legt,
 * en zien we het warme welkom zodra de bezoeker bij de demo-aanvraag komt.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  const ref = searchParams.get("ref");

  // /p/... doet de registratie zelf — nooit een lus maken.
  if (!ref || pathname.startsWith("/p/")) return NextResponse.next();

  // Waar de bezoeker heen wilde. Vanaf de homepage sturen we naar de
  // demo-aanvraag (daar staat het welkom); anders blijft hij op zijn pagina.
  const next = pathname === "/" ? "/demo" : pathname;

  const dest = new URL(`/p/${encodeURIComponent(ref)}`, request.url);
  dest.searchParams.set("next", next);
  return NextResponse.redirect(dest);
}

export const config = {
  // Sla statische bestanden, API's en de referral-route zelf over.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|p/).*)",
  ],
};
