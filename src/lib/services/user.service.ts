import { db } from "@/db";
import { DbClient } from "@/db/types";
import {
  organizationMembers,
  users,
  roles,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";

export async function getOrganizationMembers(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
) {
  const members = await dbInstance
    .select({
      id: organizationMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      roleId: roles.id,
      roleName: roles.name,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
    .where(eq(organizationMembers.organizationId, organizationId));

  return members;
}

export interface AddMemberParams {
  organizationId: string;
  name: string;
  email: string;
  roleId: string;
}

export async function addMemberToOrganization(
  { organizationId, name, email, roleId }: AddMemberParams,
  dbInstance: DbClient = db as DbClient
) {
  // 1. Verify that role exists and belongs to this organization
  const [role] = await dbInstance
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.organizationId, organizationId)))
    .limit(1);

  if (!role) {
    throw new ValidationError(
      "The selected role does not exist in this organization."
    );
  }

  // 2. Find or create the user record
  const [existingUser] = await dbInstance
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  let targetUserId: string;

  if (existingUser) {
    targetUserId = existingUser.id;
  } else {
    targetUserId = crypto.randomUUID();
    await dbInstance.insert(users).values({
      id: targetUserId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      emailVerified: false,
    });
  }

  // 3. Verify user is not already a member
  const [existingMembership] = await dbInstance
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (existingMembership) {
    throw new ConflictError(
      "This user is already a member of the organization."
    );
  }

  // 4. Create membership
  const memberId = crypto.randomUUID();
  const [createdMembership] = await dbInstance
    .insert(organizationMembers)
    .values({
      id: memberId,
      organizationId,
      userId: targetUserId,
      roleId,
    })
    .returning();

  return createdMembership;
}

export async function updateMemberRole(
  {
    organizationId,
    memberId,
    roleId,
  }: {
    organizationId: string;
    memberId: string;
    roleId: string;
  },
  dbInstance: DbClient = db as DbClient
) {
  const [member] = await dbInstance
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) {
    throw new NotFoundError("Member not found in this organization.");
  }

  const [role] = await dbInstance
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.organizationId, organizationId)))
    .limit(1);

  if (!role) {
    throw new ValidationError(
      "The specified role does not exist in this organization."
    );
  }

  const [updated] = await dbInstance
    .update(organizationMembers)
    .set({
      roleId,
      updatedAt: new Date(),
    })
    .where(eq(organizationMembers.id, memberId))
    .returning();

  return updated;
}

export async function removeMember(
  {
    organizationId,
    memberId,
    currentUserId,
  }: {
    organizationId: string;
    memberId: string;
    currentUserId: string;
  },
  dbInstance: DbClient = db as DbClient
) {
  const [member] = await dbInstance
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) {
    throw new NotFoundError("Member not found in this organization.");
  }

  if (member.userId === currentUserId) {
    const totalMembers = await dbInstance
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    if (totalMembers.length <= 1) {
      throw new ForbiddenError(
        "Cannot remove yourself as you are the only member of this organization."
      );
    }
  }

  await dbInstance
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, memberId));

  return { success: true };
}
