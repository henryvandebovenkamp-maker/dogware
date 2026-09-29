/**
 * Interop-wrapper rond @mollie/api-client voor de kale testrunner.
 *
 * Next bundelt de ESM-build van het pakket, waarin de factory de default
 * export is. Buiten een bundler laadt Node de CJS-build, en dan zit diezelfde
 * factory achter `.default`. Deze wrapper maakt dat verschil onzichtbaar, zodat
 * lib/mollie.ts ongewijzigd blijft — het is een verpakkingsprobleem van het
 * pakket, geen probleem van onze code.
 */
import pakket from "@mollie/api-client";

const echt = pakket.default ?? pakket;

/**
 * Een integratietest kan een nep-Mollie aanbieden via `globalThis.__fakeMollie`.
 * Zonder die vlag is dit de echte client — bestaande tests merken niets.
 */
const createMollieClient = (opties) => globalThis.__fakeMollie ?? echt(opties);
export default createMollieClient;
