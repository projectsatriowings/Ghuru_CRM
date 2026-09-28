import { cache } from "react";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizations,
  organizationMembers,
  roles,
  permissions,
  rolePermissions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  INITIAL_PERMISSIONS,
  DEFAULT_ORG_ADMIN_ROLE,
  DEFAULT_ORG_ADMIN_DESCRIPTION,
} from "@/lib/permissions";
import { ConflictError, NotFoundError } from "@/lib/errors";

export interface CreateOrganizationParams {
  name: string;
  slug: string;
  userId: string;
}

let cachedSystemPermissions: Array<{ id: string; key: string; description: string }> | null = null;

export async function createOrganization(
  { name, slug, userId }: CreateOrganizationParams,
  dbInstance: DbClient = db as DbClient
) {
  const tStart = performance.now();

  // 1. Check if slug is already taken
  const tSlug0 = performance.now();
  const existingOrg = await dbInstance
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existingOrg.length > 0) {
    throw new ConflictError("This workspace URL is already in use.");
  }
  const tSlug = (performance.now() - tSlug0).toFixed(1);

  // 2. Fetch existing permissions (or use in-memory cache if already loaded)
  const tPerms0 = performance.now();
  let allPermissions = cachedSystemPermissions;

  if (!allPermissions || allPermissions.length < INITIAL_PERMISSIONS.length) {
    allPermissions = await dbInstance.select().from(permissions);

    if (allPermissions.length < INITIAL_PERMISSIONS.length) {
      // Single bulk insert for all missing system permissions (1 query instead of 10)
      await dbInstance
        .insert(permissions)
        .values(
          INITIAL_PERMISSIONS.map((perm) => ({
            id: `perm_${perm.key.replace(/\./g, "_")}`,
            key: perm.key,
            description: perm.description,
          }))
        )
        .onConflictDoNothing({ target: permissions.key });

      allPermissions = await dbInstance.select().from(permissions);
    }
    cachedSystemPermissions = allPermissions;
  }
  const tPerms = (performance.now() - tPerms0).toFixed(1);

  // 3. Atomically create Organization, Role, Role Permissions (Bulk), and Member
  const tBatch0 = performance.now();
  const orgId = crypto.randomUUID();
  const roleId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  let createdOrg;
  let adminRole;
  let member;

  try {
    // Type assertion to access driver-specific atomic mechanisms
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = dbInstance as any;

    if ("batch" in client && typeof client.batch === "function") {
      // Neon HTTP: execute all 4 writes in ONE single HTTP round-trip (atomic transaction on Neon!)
      const batchResult = await client.batch([
        dbInstance.insert(organizations).values({
          id: orgId,
          name,
          slug,
        }).returning(),

        dbInstance.insert(roles).values({
          id: roleId,
          organizationId: orgId,
          name: DEFAULT_ORG_ADMIN_ROLE,
          description: DEFAULT_ORG_ADMIN_DESCRIPTION,
        }).returning(),

        dbInstance.insert(rolePermissions).values(
          allPermissions.map((perm) => ({
            roleId,
            permissionId: perm.id,
          }))
        ),

        dbInstance.insert(organizationMembers).values({
          id: memberId,
          organizationId: orgId,
          userId,
          roleId,
        }).returning(),
      ]);

      createdOrg = batchResult[0][0];
      adminRole = batchResult[1][0];
      member = batchResult[3][0];
    } else if ("transaction" in client && typeof client.transaction === "function") {
      // PGlite (test suite) or standard Postgres connection pool: real interactive transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txResult = await client.transaction(async (tx: any) => {
        const [o] = await tx.insert(organizations).values({
          id: orgId,
          name,
          slug,
        }).returning();

        const [r] = await tx.insert(roles).values({
          id: roleId,
          organizationId: orgId,
          name: DEFAULT_ORG_ADMIN_ROLE,
          description: DEFAULT_ORG_ADMIN_DESCRIPTION,
        }).returning();

        // Bulk insert all permissions in ONE statement
        await tx.insert(rolePermissions).values(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allPermissions.map((perm: any) => ({
            roleId: r.id,
            permissionId: perm.id,
          }))
        );

        const [m] = await tx.insert(organizationMembers).values({
          id: memberId,
          organizationId: orgId,
          userId,
          roleId: r.id,
        }).returning();

        return { o, r, m };
      });

      createdOrg = txResult.o;
      adminRole = txResult.r;
      member = txResult.m;
    } else {
      // Fallback with bulk permissions insert
      const [o] = await dbInstance.insert(organizations).values({
        id: orgId,
        name,
        slug,
      }).returning();

      const [r] = await dbInstance.insert(roles).values({
        id: roleId,
        organizationId: orgId,
        name: DEFAULT_ORG_ADMIN_ROLE,
        description: DEFAULT_ORG_ADMIN_DESCRIPTION,
      }).returning();

      await dbInstance.insert(rolePermissions).values(
        allPermissions.map((perm) => ({
          roleId: r.id,
          permissionId: perm.id,
        }))
      );

      const [m] = await dbInstance.insert(organizationMembers).values({
        id: memberId,
        organizationId: orgId,
        userId,
        roleId: r.id,
      }).returning();

      createdOrg = o;
      adminRole = r;
      member = m;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("unique") || errorMsg.includes("23505") || errorMsg.includes("slug")) {
      throw new ConflictError("This workspace URL is already in use.");
    }
    throw err;
  }

  const tBatch = (performance.now() - tBatch0).toFixed(1);
  const tTotal = (performance.now() - tStart).toFixed(1);

  console.log(
    `[OrgCreate] slug check: ${tSlug}ms | perms: ${tPerms}ms | atomic writes: ${tBatch}ms | total service: ${tTotal}ms`
  );

  return {
    organization: createdOrg,
    role: adminRole,
    member,
  };
}

export async function getOrganizationById(
  orgId: string,
  dbInstance: DbClient = db as DbClient
) {
  const [org] = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return org || null;
}

export async function getOrganizationBySlug(
  slug: string,
  dbInstance: DbClient = db as DbClient
) {
  const [org] = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return org || null;
}

export interface UserOrganizationMembership {
  membershipId: string;
  roleId: string;
  roleName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  createdAt: Date;
}

export const getUserOrganizations = cache(
  async (
    userId: string,
    dbInstance: DbClient = db as DbClient
  ): Promise<UserOrganizationMembership[]> => {
    const userMemberships = await dbInstance
      .select({
        membershipId: organizationMembers.id,
        roleId: organizationMembers.roleId,
        roleName: roles.name,
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        createdAt: organizations.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id)
      )
      .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
      .where(eq(organizationMembers.userId, userId));

    return userMemberships;
  }
);

export async function getOrganizationCounts(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = dbInstance as any;

  if ("batch" in client && typeof client.batch === "function") {
    // Neon HTTP: execute both queries in 1 single HTTP request (avoids concurrent TLS spin-up)
    const [membersCount, rolesCount] = await client.batch([
      dbInstance
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, organizationId)),
      dbInstance
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.organizationId, organizationId)),
    ]);

    return {
      totalUsers: membersCount.length,
      activeRoles: rolesCount.length,
    };
  }

  // PGlite (vitest) or standard connection fallback
  const [membersCount, rolesCount] = await Promise.all([
    dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId)),
    dbInstance
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.organizationId, organizationId)),
  ]);

  return {
    totalUsers: membersCount.length,
    activeRoles: rolesCount.length,
  };
}

export async function updateOrganization(
  orgId: string,
  data: { name?: string; slug?: string },
  dbInstance: DbClient = db as DbClient
) {
  const existing = await getOrganizationById(orgId, dbInstance);
  if (!existing) {
    throw new NotFoundError("Organization not found");
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugInUse = await dbInstance
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, data.slug))
      .limit(1);

    if (slugInUse.length > 0) {
      throw new ConflictError(
        `An organization with the slug "${data.slug}" already exists.`
      );
    }
  }

  const [updated] = await dbInstance
    .update(organizations)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.slug ? { slug: data.slug } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))
    .returning();

  return updated;
}
