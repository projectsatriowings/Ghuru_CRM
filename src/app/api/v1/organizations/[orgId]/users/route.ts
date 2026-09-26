import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationMembers,
  addMemberToOrganization,
} from "@/lib/services/user.service";
import { addMemberSchema } from "@/lib/validations/user";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await context.params;
    await requirePermission("users.view", orgId);

    const members = await getOrganizationMembers(orgId);
    return apiSuccess(members);
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
    await requirePermission("users.create", orgId);

    const body = await req.json();
    const validated = addMemberSchema.parse(body);

    const member = await addMemberToOrganization({
      organizationId: orgId,
      name: validated.name,
      email: validated.email,
      roleId: validated.roleId,
    });

    return apiSuccess(member, 201);
  } catch (error) {
    return apiError(error);
  }
}
