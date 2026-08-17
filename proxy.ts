import { NextResponse, type NextRequest } from "next/server";

/**
 * Grove eerste zeef voor /hq — nadrukkelijk niet de beveiliging zelf. De
 * echte beslissing valt in app/hq/layout.tsx en opnieuw in elke server action
 * en route handler (lib/hq-auth.ts). Hier kijken we alleen naar wat zonder
 * database te zien is: de feature flag en het volledig ontbreken van een
 * sessiecookie. Deze zeef kan nooit toegang gééven, alleen weigeren.
 */
function hqGeblokkeerd(request: NextRequest): boolean {
  if (process.env.HQ_ENABLED !== "true") return true;
  return !request.cookies.has("dw_session");
}

/**
 * Vangt een referral-parameter op ELKE pagina op — ook op de homepage
 * (dogware.nl/?ref=CODE). We sturen de bezoeker één keer langs /p/CODE, dat
 * de click server-side valideert, registreert en de attributiecookie zet, en
 * daarna netjes terugstuurt naar de pagina die hij wilde bezoeken (?next=).
 *
 * Zo blijft de koppeling behouden, waar de partner de link ook naartoe legt,
 * en zien we het warme welkom zodra de bezoeker bij de demo-aanvraag komt.
 *
 * Daarnaast loopt /hq hier als eerste langs de grove HQ-zeef hierboven.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/hq" || pathname.startsWith("/hq/")) {
    /*
     * Alleen het machineleesbare statuseindpunt wordt hier al afgekapt. Dat
     * antwoord is bij weigering toch al een kale 404 zonder body, dus de zeef
     * verandert niets aan wat de buitenwereld ziet — hij scheelt alleen een
     * databasequery.
     *
     * De HTML-routes gaan bewust ongemoeid door naar de layout. Elke vorm van
     * afkappen hier zou zichzelf verraden: een eigen 404 mist de vertrouwde
     * not-found-pagina, en een rewrite naar een ander pad zet dat pad
     * zichtbaar in de RSC-payload van het antwoord. Dan staat er letterlijk in
     * de HTML dat /hq apart behandeld wordt. De layout levert daarentegen
     * exact dezelfde 404 als elk ander adres dat niet bestaat.
     */
    if (pathname === "/hq/status" && hqGeblokkeerd(request)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

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
