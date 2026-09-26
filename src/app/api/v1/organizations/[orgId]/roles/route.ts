import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationRoles,
  createRole,
} from "@/lib/services/role.service";
import { createRoleSchema } from "@/lib/validations/role";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await context.params;
    await requirePermission("roles.view", orgId);

    const orgRoles = await getOrganizationRoles(orgId);
    return apiSuccess(orgRoles);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await context.params;
    await requirePermission("roles.create", orgId);

    const body = await req.json();
    const validated = createRoleSchema.parse(body);

    const created = await createRole({
      organizationId: orgId,
      name: validated.name,
      description: validated.description,
      permissionKeys: validated.permissionKeys,
    });

    return apiSuccess(created, 201);
  } catch (error) {
    return apiError(error);
  }
}
