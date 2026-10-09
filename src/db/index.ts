import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Allow `next build` to import this module without a database; real queries will fail loudly.
  console.warn("[db] DATABASE_URL is not set. Add it to .env.local or your Vercel project settings.");
}

export const db = drizzle(neon(url ?? "postgres://placeholder:placeholder@localhost:5432/placeholder"), { schema });
export { schema };
