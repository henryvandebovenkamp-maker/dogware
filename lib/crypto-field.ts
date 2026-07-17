import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Veld-encryptie voor gevoelige gegevens (IBAN, BIC).
 * AES-256-GCM met een sleutel afgeleid van AUTH_SECRET. Opgeslagen als
 * "enc:<iv>:<tag>:<ciphertext>" (alles base64). Alleen server-side.
 */

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ontbreekt — kan gegevens niet versleutelen.");
  cachedKey = scryptSync(secret, "dogware-field-encryption", 32);
  return cachedKey;
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptField(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith("enc:")) return stored; // legacy/plaintext fallback
  try {
    const [, ivB64, tagB64, dataB64] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

/** Toon alleen de laatste 4 tekens: "NL•• •••• •••• 1234". */
export function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, "");
  if (clean.length < 4) return "—";
  return `${clean.slice(0, 2)}•• •••• •••• ${clean.slice(-4)}`;
}
