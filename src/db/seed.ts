import { db } from "./index";
import { permissions } from "./schema";
import { INITIAL_PERMISSIONS } from "@/lib/permissions";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

export async function seedPermissions() {
  console.log("Seeding initial permissions...");
  for (const perm of INITIAL_PERMISSIONS) {
    const id = `perm_${perm.key.replace(/\./g, "_")}`;
    await db
      .insert(permissions)
      .values({
        id,
        key: perm.key,
        description: perm.description,
      })
      .onConflictDoNothing({ target: permissions.key });
  }
  console.log("Permissions seeded successfully.");
}

if (process.argv[1]?.includes("seed.ts")) {
  seedPermissions()
    .then(() => {
      console.log("Seed complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
