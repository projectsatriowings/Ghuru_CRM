import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationById,
  updateOrganization,
} from "@/lib/services/organization.service";
import { updateOrganizationSchema } from "@/lib/validations/organization";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await context.params;
    await requirePermission("organization.view", orgId);

    const org = await getOrganizationById(orgId);
    return apiSuccess(org);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await context.params;
    await requirePermission("organization.update", orgId);

    const body = await req.json();
    const validated = updateOrganizationSchema.parse(body);

    const updated = await updateOrganization(orgId, validated);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}
