import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Databasetoegang (Neon Postgres via Drizzle).
 *
 * Net als de mailservice degradeert dit netjes: zonder DATABASE_URL geeft
 * getDb() null terug en blijft de applicatie gewoon werken (intakes komen
 * dan alleen per e-mail binnen).
 */

export type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export { schema };
