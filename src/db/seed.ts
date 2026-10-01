import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { db } from "./index";
import { permissions, roles, rolePermissions } from "./schema";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { eq } from "drizzle-orm";

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

  // Backfill newly added permissions to existing Organization Admin roles
  const allPermissions = await db.select().from(permissions);
  const adminRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.name, DEFAULT_ORG_ADMIN_ROLE));

  for (const adminRole of adminRoles) {
    const existingPerms = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, adminRole.id));

    const existingPermIdSet = new Set(existingPerms.map((ep) => ep.permissionId));
    const missingPerms = allPermissions.filter((p) => !existingPermIdSet.has(p.id));

    if (missingPerms.length > 0) {
      console.log(
        `Backfilling ${missingPerms.length} permissions for Organization Admin role (${adminRole.id})...`
      );
      for (const missing of missingPerms) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: adminRole.id,
            permissionId: missing.id,
          })
          .onConflictDoNothing();
      }
    }
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
