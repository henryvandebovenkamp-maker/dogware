/**
 * Minimale resolver zodat de kale testrunner (`node --test`) de modules van dit
 * project kan laden.
 *
 * Twee dingen die een bundler normaal doet en Node niet:
 *   1. het `@/`-pad-alias uit tsconfig.json vertalen naar de projectmap;
 *   2. de ontbrekende bestandsextensie aanvullen — TypeScript schrijft
 *      `./schema`, Node wil `./schema.ts`.
 *
 * Verder blijft de resolutie ongemoeid.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const KANDIDATEN = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Vult de extensie aan, of wijst een map naar zijn index-bestand. */
function metExtensie(basis) {
  const pad = fileURLToPath(basis);
  if (existsSync(pad) && !statSync(pad).isDirectory()) return basis;
  for (const achtervoegsel of KANDIDATEN) {
    const kandidaat = new URL(basis.href + achtervoegsel);
    if (existsSync(fileURLToPath(kandidaat))) return kandidaat;
  }
  return basis;
}

const SERVER_ONLY_STUB = new URL("./server-only-stub.mjs", import.meta.url).href;
const NEXT_STUB = new URL("./next-stubs.mjs", import.meta.url).href;
const MAIL_STUB = new URL("./mail-stub.mjs", import.meta.url).href;
const MOLLIE_INTEROP = new URL("./mollie-interop.mjs", import.meta.url).href;
const RESEND_STUB = new URL("./resend-stub.mjs", import.meta.url).href;
const GESTUBD = new Set(["next/headers", "next/cache", "next/navigation"]);

export async function resolve(specifier, context, nextResolve) {
  // `server-only` gooit buiten een bundler altijd; in tests draait alles
  // server-side, dus vervangen we het door een lege module.
  if (specifier === "server-only") {
    return { url: SERVER_ONLY_STUB, shortCircuit: true };
  }
  // Next-modules die alleen binnen een echte request bestaan.
  if (GESTUBD.has(specifier)) {
    return { url: NEXT_STUB, shortCircuit: true };
  }
  // De Mollie-client is een CJS-pakket; buiten een bundler zit de factory
  // achter `.default`. De wrapper vlakt dat af (en importeert het pakket zelf,
  // vandaar de uitzondering op zijn eigen import).
  if (specifier === "@mollie/api-client" && context.parentURL !== MOLLIE_INTEROP) {
    return { url: MOLLIE_INTEROP, shortCircuit: true };
  }
  // De maillaag is een .tsx-template; Node compileert geen JSX. De stub
  // registreert welke mails verstuurd zouden zijn.
  if (specifier === "@/lib/email/send" || specifier.endsWith("/email/send")) {
    return { url: MAIL_STUB, shortCircuit: true };
  }
  // De echte Resend-SDK doet een netwerkaanroep. De stub legt vast welke
  // payload de SDK zou krijgen — daar toetsen we de Reply-To op.
  if (specifier === "resend") {
    return { url: RESEND_STUB, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    return nextResolve(metExtensie(new URL(specifier.slice(2), ROOT)).href, context);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const basis = new URL(specifier, context.parentURL);
    // Alleen bijsturen wanneer het pad zonder extensie is geschreven.
    if (!/\.[a-z]+$/i.test(basis.pathname)) {
      return nextResolve(metExtensie(basis).href, context);
    }
  }
  return nextResolve(specifier, context);
}
