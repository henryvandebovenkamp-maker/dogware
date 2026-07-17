/**
 * IBAN-validatie (ISO 13616, mod-97). Client- en server-veilig.
 */

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  // Verplaats de eerste vier tekens naar het einde
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  // Zet letters om naar getallen (A=10 … Z=35)
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    (c.charCodeAt(0) - 55).toString(),
  );
  // mod 97 in stukjes (voorkomt overflow)
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder === 1;
}
