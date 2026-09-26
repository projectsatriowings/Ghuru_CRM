import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type DbClient =
  | NeonHttpDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;
