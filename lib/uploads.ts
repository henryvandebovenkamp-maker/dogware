import "server-only";

/**
 * Is uploaden daadwerkelijk bruikbaar?
 *
 * UploadThing v7 verwacht in UPLOADTHING_TOKEN een base64-versleuteld
 * JSON-object met { apiKey, appId, regions }. Staat daar iets anders — een
 * oude sk_live-sleutel, een half geplakte waarde — dan komt de dropzone wél in
 * beeld, maar faalt elke upload pas op het moment dat de bezoeker een bestand
 * kiest (500 vanuit /api/uploadthing).
 *
 * Daarom controleren we hier de vórm van de token in plaats van alleen of hij
 * gevuld is. Klopt hij niet, dan tonen de pagina's netjes hun bestaande
 * alternatief ("Uploaden wordt binnenkort geactiveerd") en loopt niemand tegen
 * een kapotte widget aan.
 */
export function uploadsEnabled(): boolean {
  const raw = process.env.UPLOADTHING_TOKEN?.trim();
  if (!raw) return false;

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return false;
    const { apiKey, appId, regions } = parsed as Record<string, unknown>;
    return (
      typeof apiKey === "string" &&
      apiKey.length > 0 &&
      typeof appId === "string" &&
      appId.length > 0 &&
      Array.isArray(regions) &&
      regions.length > 0
    );
  } catch {
    return false;
  }
}
