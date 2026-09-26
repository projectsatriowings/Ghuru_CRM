import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : (new Proxy({} as ReturnType<typeof drizzle>, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          "DATABASE_URL is not set. Please set DATABASE_URL in your .env or .env.local file."
        );
      },
    }) as ReturnType<typeof drizzle>);

export type Database = typeof db;
