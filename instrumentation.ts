/**
 * Draait één keer bij het opstarten van de server. Controleert of alle
 * kritieke productievariabelen aanwezig zijn en waarschuwt vroeg en duidelijk
 * als er iets ontbreekt. Faalt bewust niet hard, zodat de site blijft draaien;
 * de waarschuwing verschijnt in de serverlogs (Vercel).
 */
export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  const kritiek = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "EMAIL_INTERNAL",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const ontbreekt = kritiek.filter((k) => !process.env[k]);

  const problemen: string[] = [];
  if (ontbreekt.length) {
    problemen.push(`Ontbrekende variabelen: ${ontbreekt.join(", ")}`);
  }
  // Productie mag geen sandbox-afzender of localhost-URL gebruiken
  if (/@resend\.dev/i.test(process.env.EMAIL_FROM ?? "")) {
    problemen.push("EMAIL_FROM gebruikt nog het Resend-proefadres (@resend.dev).");
  }
  if (/localhost/i.test(process.env.NEXT_PUBLIC_SITE_URL ?? "")) {
    problemen.push("NEXT_PUBLIC_SITE_URL wijst naar localhost.");
  }

  if (problemen.length) {
    console.error(
      JSON.stringify({
        evt: "prod_config_warning",
        at: new Date().toISOString(),
        problemen,
      }),
    );
  } else {
    console.info(
      JSON.stringify({ evt: "prod_config_ok", at: new Date().toISOString() }),
    );
  }
}
