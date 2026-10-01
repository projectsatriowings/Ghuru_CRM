import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { setGlobalDispatcher, Agent } = require("undici");
  setGlobalDispatcher(new Agent({ connect: { autoSelectFamily: false } }));
} catch {
  // Non-node or undici not found
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  db: Database | undefined;
};

export function getDb(): Database {
  if (globalForDb.db) return globalForDb.db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Please set DATABASE_URL in your .env or .env.local file."
    );
  }

  const sql = neon(connectionString, {
    fetchOptions: {
      keepalive: true,
    },
  });
  const dbInstance = drizzle(sql, { schema }) as unknown as Database;
  globalForDb.db = dbInstance;

  return dbInstance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const targetDb = getDb();
    const value = Reflect.get(targetDb, prop);
    return typeof value === "function" ? value.bind(targetDb) : value;
  },
});
