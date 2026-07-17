import "server-only";

/**
 * Toegangscontrole voor beheerpagina's (/admin/*).
 *
 * DogWare heeft (nog) geen accounts of rollen. Tot die er zijn:
 * - development: altijd toegankelijk;
 * - productie: alleen met een geldige EMAIL_TEST_TOKEN (?token=...).
 *   Zonder geconfigureerde token zijn adminpagina's in productie ontoegankelijk.
 *
 * Zodra er echte authenticatie is, deze check vervangen door een
 * Super Admin-rolcontrole.
 */
export function isAdminAllowed(token: string | undefined): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const expected = process.env.EMAIL_TEST_TOKEN;
  return Boolean(expected && token && token === expected);
}
