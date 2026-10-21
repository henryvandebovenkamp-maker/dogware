/**
 * De financiële bevoegdheid — bewust zonder enige import.
 *
 * Net als de HQ-eigenaarrol (lib/hq/access.ts) staat deze waarde NIET in
 * `USER_ROLES`: het is geen omgeving met een eigen startpagina, label of
 * sessieduur, maar een extra bevoegdheid bovenop SUPER_ADMIN. Hij leeft als
 * losse rij in `user_roles.role` en wordt uitsluitend door
 * lib/finance-auth.ts uitgelezen. De gewone sessielaag filtert hem eruit.
 *
 * Wie hem heeft, mag een voorbereide partneruitbetaling goedkeuren en als
 * uitbetaald markeren. Toekennen gebeurt alleen bewust, via
 * scripts/grant-finance-role.mjs — nooit vanuit het beheerportaal.
 */
export const FINANCE_ROLE = "FINANCE_APPROVER";
