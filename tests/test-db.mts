/**
 * Een wegwerpdatabase voor integratietests: echte Postgres (PGlite), in het
 * geheugen, met exact het schema uit lib/db/schema.ts.
 *
 * Het schema wordt door drizzle-kit uit dezelfde definitie gegenereerd die de
 * applicatie gebruikt, dus unieke indexen, partiële indexen en foreign keys
 * gedragen zich zoals in productie. Er wordt nooit een echte database geraakt
 * (zie db-stub.mjs).
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createRequire } from "node:module";
import * as schema from "../lib/db/schema.ts";

const require = createRequire(import.meta.url);

export async function maakTestDb() {
  const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api") as {
    generateDrizzleJson: (s: Record<string, unknown>) => unknown;
    generateMigration: (a: unknown, b: unknown) => Promise<string[]>;
  };
  const leeg = generateDrizzleJson({});
  const huidig = generateDrizzleJson(schema as unknown as Record<string, unknown>);
  const statements = await generateMigration(leeg, huidig);

  const client = new PGlite();
  for (const st of statements) await client.exec(st);
  const db = drizzle(client, { schema });
  (globalThis as { __testDb?: unknown }).__testDb = db;
  return { db, client, statements };
}
