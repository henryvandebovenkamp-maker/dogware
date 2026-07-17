import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit draait buiten Next; .env.local wordt via package.json-script geladen
    url: process.env.DATABASE_URL ?? "",
  },
});
