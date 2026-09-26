import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

let _cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_cachedDb) return _cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Please set DATABASE_URL in your .env or .env.local file."
    );
  }

  const sql = neon(connectionString);
  _cachedDb = drizzle(sql, { schema });
  return _cachedDb;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const targetDb = getDb();
    const value = Reflect.get(targetDb, prop);
    return typeof value === "function" ? value.bind(targetDb) : value;
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;
