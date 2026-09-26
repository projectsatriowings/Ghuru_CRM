import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment.");
  }

  console.log("Running migrations on Neon PostgreSQL...");
  const sql = neon(connectionString);
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully!");
}

if (process.argv[1]?.includes("migrate.ts")) {
  runMigrations()
    .then(() => {
      console.log("Migration complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
