"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/context/organization-context";
import {
  addMemberToOrganization,
  updateMemberRole,
  removeMember,
} from "@/lib/services/user.service";
import {
  addMemberSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  AddMemberInput,
  UpdateMemberRoleInput,
  RemoveMemberInput,
} from "@/lib/validations/user";

export async function addMemberAction(input: AddMemberInput) {
  try {
    const ctx = await requirePermission("users.create");
    const validated = addMemberSchema.parse(input);

    const member = await addMemberToOrganization({
      organizationId: ctx.organization.id,
      name: validated.name,
      email: validated.email,
      roleId: validated.roleId,
    });

    revalidatePath("/settings/users");
    revalidatePath("/dashboard");
    return {
      success: true,
      member,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to add member";
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateMemberRoleAction(input: UpdateMemberRoleInput) {
  try {
    const ctx = await requirePermission("users.update");
    const validated = updateMemberRoleSchema.parse(input);

    const updated = await updateMemberRole({
      organizationId: ctx.organization.id,
      memberId: validated.memberId,
      roleId: validated.roleId,
    });

    revalidatePath("/settings/users");
    return {
      success: true,
      member: updated,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update member role";
    return {
      success: false,
      error: message,
    };
  }
}

export async function removeMemberAction(input: RemoveMemberInput) {
  try {
    const ctx = await requirePermission("users.delete");
    const validated = removeMemberSchema.parse(input);

    const res = await removeMember({
      organizationId: ctx.organization.id,
      memberId: validated.memberId,
      currentUserId: ctx.user.id,
    });

    revalidatePath("/settings/users");
    revalidatePath("/dashboard");
    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to remove member";
    return {
      success: false,
      error: message,
    };
  }
}
