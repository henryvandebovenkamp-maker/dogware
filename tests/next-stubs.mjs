/**
 * Vervangt de request-gebonden Next-modules tijdens headless tests.
 *
 * `next/headers` en `next/cache` werken alleen binnen een echte request van de
 * Next-server. In een test is er geen request, dus leveren we een lege
 * headers-/cookiebak en een revalidate die niets doet.
 *
 * Belangrijk: hier wordt uitsluitend Next-plumbing vervangen, geen DogWare-
 * logica. Een test die hierop leunt, test dus nog steeds de echte code — met
 * een anonieme bezoeker zonder sessiecookie, precies zoals een klant die een
 * voorstellink opent.
 */
const LEEG = new Map();

export async function headers() {
  return {
    get: () => null,
    has: () => false,
    entries: () => LEEG.entries(),
  };
}

export async function cookies() {
  return {
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
    has: () => false,
  };
}

export function revalidatePath() {}
export function revalidateTag() {}

/** Redirect/notFound gooien in Next ook; hier maken we dat expliciet. */
export function redirect(url) {
  const e = new Error(`redirect naar ${url}`);
  e.digest = "NEXT_REDIRECT";
  throw e;
}
export function notFound() {
  const e = new Error("notFound");
  e.digest = "NEXT_NOT_FOUND";
  throw e;
}
