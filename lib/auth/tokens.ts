import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { AuthTokenType } from "@/lib/db/schema";
import { generateToken, hashToken } from "./crypto";

const TOKEN_HOURS: Record<AuthTokenType, number> = {
  INVITE: 7 * 24, // uitnodiging: 7 dagen geldig
};

/**
 * Maak een eenmalige token aan. Eerdere ongebruikte tokens van hetzelfde
 * type worden ongeldig gemaakt (nieuwe uitnodiging = oude link dood).
 * Alleen de hash wordt opgeslagen; de kale token gaat één keer mee in de mail.
 */
export async function issueToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("Database niet geconfigureerd.");

  await db
    .delete(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, userId),
        eq(schema.authTokens.type, type),
        isNull(schema.authTokens.usedAt),
      ),
    );

  const token = generateToken();
  await db.insert(schema.authTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_HOURS[type] * 3600_000),
  });
  return token;
}

/** Valideer een token zonder hem te verbruiken. */
export async function peekToken(token: string, type: AuthTokenType) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.tokenHash, hashToken(token)),
        eq(schema.authTokens.type, type),
      ),
    )
    .limit(1);
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Valideer en verbruik een token — eenmalig bruikbaar. */
export async function consumeToken(token: string, type: AuthTokenType) {
  const db = getDb();
  if (!db) return null;
  const row = await peekToken(token, type);
  if (!row) return null;
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.authTokens.id, row.id));
  return row;
}
