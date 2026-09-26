"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/context/organization-context";
import {
  createRole,
  updateRole,
  deleteRole,
} from "@/lib/services/role.service";
import {
  createRoleSchema,
  updateRoleSchema,
  CreateRoleInput,
  UpdateRoleInput,
} from "@/lib/validations/role";

export async function createRoleAction(input: CreateRoleInput) {
  try {
    const ctx = await requirePermission("roles.create");
    const validated = createRoleSchema.parse(input);

    const created = await createRole({
      organizationId: ctx.organization.id,
      name: validated.name,
      description: validated.description,
      permissionKeys: validated.permissionKeys,
    });

    revalidatePath("/settings/roles");
    return {
      success: true,
      role: created,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create role";
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateRoleAction(
  roleId: string,
  input: UpdateRoleInput
) {
  try {
    const ctx = await requirePermission("roles.update");
    const validated = updateRoleSchema.parse(input);

    const updated = await updateRole({
      organizationId: ctx.organization.id,
      roleId,
      name: validated.name,
      description: validated.description,
      permissionKeys: validated.permissionKeys,
    });

    revalidatePath("/settings/roles");
    return {
      success: true,
      role: updated,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update role";
    return {
      success: false,
      error: message,
    };
  }
}

export async function deleteRoleAction(roleId: string) {
  try {
    const ctx = await requirePermission("roles.delete");

    const res = await deleteRole({
      organizationId: ctx.organization.id,
      roleId,
    });

    revalidatePath("/settings/roles");
    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete role";
    return {
      success: false,
      error: message,
    };
  }
}
