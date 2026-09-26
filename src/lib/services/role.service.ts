import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  roles,
  permissions,
  rolePermissions,
  organizationMembers,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import { DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";

let _cachedSystemPermissions: { id: string; key: string; description: string }[] | null = null;

export async function getAllSystemPermissions(dbInstance: DbClient = db as DbClient) {
  if (
    dbInstance === (db as DbClient) &&
    _cachedSystemPermissions &&
    _cachedSystemPermissions.length > 0
  ) {
    return _cachedSystemPermissions;
  }
  const perms = await dbInstance.select().from(permissions);
  if (dbInstance === (db as DbClient)) {
    _cachedSystemPermissions = perms;
  }
  return perms;
}

export async function getOrganizationRoles(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
) {
  const orgRoles = await dbInstance
    .select()
    .from(roles)
    .where(eq(roles.organizationId, organizationId));

  if (orgRoles.length === 0) {
    return [];
  }

  const roleIds = orgRoles.map((r) => r.id);

  const [allAssignedPerms, members] = await Promise.all([
    dbInstance
      .select({
        roleId: rolePermissions.roleId,
        id: permissions.id,
        key: permissions.key,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds)),

    dbInstance
      .select({
        roleId: organizationMembers.roleId,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          inArray(organizationMembers.roleId, roleIds)
        )
      ),
  ]);

  const permsByRole = new Map<
    string,
    { id: string; key: string; description: string }[]
  >();
  for (const p of allAssignedPerms) {
    const list = permsByRole.get(p.roleId) || [];
    list.push({ id: p.id, key: p.key, description: p.description });
    permsByRole.set(p.roleId, list);
  }

  const countsByRole = new Map<string, number>();
  for (const m of members) {
    countsByRole.set(m.roleId, (countsByRole.get(m.roleId) || 0) + 1);
  }

  return orgRoles.map((role) => ({
    ...role,
    permissions: permsByRole.get(role.id) || [],
    memberCount: countsByRole.get(role.id) || 0,
  }));
}

export interface CreateRoleParams {
  organizationId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

export async function createRole(
  {
    organizationId,
    name,
    description,
    permissionKeys,
  }: CreateRoleParams,
  dbInstance: DbClient = db as DbClient
) {
  const existingRole = await dbInstance
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(eq(roles.organizationId, organizationId), eq(roles.name, name.trim()))
    )
    .limit(1);

  if (existingRole.length > 0) {
    throw new ConflictError(
      `A role named "${name.trim()}" already exists in this organization.`
    );
  }

  const matchedPermissions = await dbInstance
    .select()
    .from(permissions)
    .where(inArray(permissions.key, permissionKeys));

  if (matchedPermissions.length === 0) {
    throw new ValidationError("No valid permissions were provided.");
  }

  const roleId = crypto.randomUUID();
  const [createdRole] = await dbInstance
    .insert(roles)
    .values({
      id: roleId,
      organizationId,
      name: name.trim(),
      description: description?.trim() || null,
    })
    .returning();

  for (const perm of matchedPermissions) {
    await dbInstance.insert(rolePermissions).values({
      roleId: createdRole.id,
      permissionId: perm.id,
    });
  }

  return {
    ...createdRole,
    permissions: matchedPermissions,
  };
}

export interface UpdateRoleParams {
  organizationId: string;
  roleId: string;
  name?: string;
  description?: string;
  permissionKeys?: string[];
}

export async function updateRole(
  {
    organizationId,
    roleId,
    name,
    description,
    permissionKeys,
  }: UpdateRoleParams,
  dbInstance: DbClient = db as DbClient
) {
  const [existing] = await dbInstance
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.organizationId, organizationId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Role not found in this organization.");
  }

  if (name && name.trim() !== existing.name) {
    const duplicate = await dbInstance
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organizationId),
          eq(roles.name, name.trim())
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      throw new ConflictError(
        `A role named "${name.trim()}" already exists in this organization.`
      );
    }
  }

  const [updated] = await dbInstance
    .update(roles)
    .set({
      ...(name ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(roles.id, roleId))
    .returning();

  if (permissionKeys) {
    await dbInstance
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    const matchedPermissions = await dbInstance
      .select()
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));

    for (const perm of matchedPermissions) {
      await dbInstance.insert(rolePermissions).values({
        roleId,
        permissionId: perm.id,
      });
    }
  }

  return updated;
}

export async function deleteRole(
  {
    organizationId,
    roleId,
  }: {
    organizationId: string;
    roleId: string;
  },
  dbInstance: DbClient = db as DbClient
) {
  const [existing] = await dbInstance
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.organizationId, organizationId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Role not found in this organization.");
  }

  if (existing.name === DEFAULT_ORG_ADMIN_ROLE) {
    throw new ForbiddenError(
      `Cannot delete the default "${DEFAULT_ORG_ADMIN_ROLE}" role.`
    );
  }

  const assignedMembers = await dbInstance
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.roleId, roleId)
      )
    )
    .limit(1);

  if (assignedMembers.length > 0) {
    throw new ForbiddenError(
      "Cannot delete this role because one or more members are currently assigned to it. Reassign them first."
    );
  }

  await dbInstance.delete(roles).where(eq(roles.id, roleId));
  return { success: true };
}
