import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  updateRole,
  deleteRole,
} from "@/lib/services/role.service";
import { updateRoleSchema } from "@/lib/validations/role";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orgId: string; roleId: string }> }
) {
  try {
    const { orgId, roleId } = await context.params;
    await requirePermission("roles.update", orgId);

    const body = await req.json();
    const validated = updateRoleSchema.parse(body);

    const updated = await updateRole({
      organizationId: orgId,
      roleId,
      name: validated.name,
      description: validated.description,
      permissionKeys: validated.permissionKeys,
    });

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string; roleId: string }> }
) {
  try {
    const { orgId, roleId } = await context.params;
    await requirePermission("roles.delete", orgId);

    const result = await deleteRole({
      organizationId: orgId,
      roleId,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
