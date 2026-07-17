import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

/**
 * Crypto-hulpfuncties voor de wachtwoordloze authenticatie.
 * DogWare kent geen wachtwoorden — alleen eenmalige tokens en codes,
 * die uitsluitend als hash worden opgeslagen.
 */

/** Willekeurige, URL-veilige token (voor sessies, magic links, uitnodigingen). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Eenmalige 6-cijferige Magic Code, cryptografisch veilig gegenereerd. */
export function generateLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Tokens en codes worden alleen als SHA-256-hash opgeslagen. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constante-tijd-vergelijking van een kale waarde met een opgeslagen hash. */
export function tokenMatches(raw: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(raw));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- HMAC-ondertekening voor first-party cookies ---------- */

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ontbreekt in de environment variables.");
  return s;
}

export function signValue(payload: string): string {
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySignedValue(value: string): string | null {
  try {
    const [data, sig] = value.split(".");
    if (!data || !sig) return null;
    const payload = Buffer.from(data, "base64url").toString();
    const expected = createHmac("sha256", secret())
      .update(payload)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return payload;
  } catch {
    return null;
  }
}
