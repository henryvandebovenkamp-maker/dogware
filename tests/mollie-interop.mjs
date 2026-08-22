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

export default pakket.default ?? pakket;
