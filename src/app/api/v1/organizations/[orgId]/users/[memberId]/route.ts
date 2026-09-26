import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  updateMemberRole,
  removeMember,
} from "@/lib/services/user.service";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";

const updateRoleBodySchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const { orgId, memberId } = await context.params;
    await requirePermission("users.update", orgId);

    const body = await req.json();
    const validated = updateRoleBodySchema.parse(body);

    const updated = await updateMemberRole({
      organizationId: orgId,
      memberId,
      roleId: validated.roleId,
    });

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const { orgId, memberId } = await context.params;
    const ctx = await requirePermission("users.delete", orgId);

    const result = await removeMember({
      organizationId: orgId,
      memberId,
      currentUserId: ctx.user.id,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
