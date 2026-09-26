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

export async function createOrganization(
  { name, slug, userId }: CreateOrganizationParams,
  dbInstance: DbClient = db as DbClient
) {
  // Check if slug is already taken
  const existingOrg = await dbInstance
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existingOrg.length > 0) {
    throw new ConflictError(
      `An organization with the slug "${slug}" already exists.`
    );
  }

  // 1. Ensure all system permissions exist
  for (const perm of INITIAL_PERMISSIONS) {
    const permId = `perm_${perm.key.replace(/\./g, "_")}`;
    await dbInstance
      .insert(permissions)
      .values({
        id: permId,
        key: perm.key,
        description: perm.description,
      })
      .onConflictDoNothing({ target: permissions.key });
  }

  // Fetch all permissions from DB
  const allPermissions = await dbInstance.select().from(permissions);

  // 2. Create the Organization
  const orgId = crypto.randomUUID();
  const [createdOrg] = await dbInstance
    .insert(organizations)
    .values({
      id: orgId,
      name,
      slug,
    })
    .returning();

  // 3. Create the default "Organization Admin" role
  const roleId = crypto.randomUUID();
  const [adminRole] = await dbInstance
    .insert(roles)
    .values({
      id: roleId,
      organizationId: orgId,
      name: DEFAULT_ORG_ADMIN_ROLE,
      description: DEFAULT_ORG_ADMIN_DESCRIPTION,
    })
    .returning();

  // 4. Assign all initial permissions to the Organization Admin role
  for (const perm of allPermissions) {
    await dbInstance.insert(rolePermissions).values({
      roleId: adminRole.id,
      permissionId: perm.id,
    });
  }

  // 5. Add user as member with Organization Admin role
  const memberId = crypto.randomUUID();
  const [member] = await dbInstance
    .insert(organizationMembers)
    .values({
      id: memberId,
      organizationId: orgId,
      userId,
      roleId: adminRole.id,
    })
    .returning();

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

export async function getUserOrganizations(
  userId: string,
  dbInstance: DbClient = db as DbClient
): Promise<UserOrganizationMembership[]> {
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
