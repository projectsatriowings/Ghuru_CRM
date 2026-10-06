import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { addTeamMember, removeTeamMember } from "@/lib/services/team.service";
import { addTeamMemberSchema } from "@/lib/validations/team";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: teamId } = await params;
    const ctx = await requirePermission("teams.update");

    const body = await req.json();
    const validated = addTeamMemberSchema.parse(body);

    const member = await addTeamMember(ctx.organization.id, teamId, validated);
    return apiSuccess(member, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: teamId } = await params;
    const ctx = await requirePermission("teams.update");

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      throw new Error("userId query parameter is required.");
    }

    await removeTeamMember(ctx.organization.id, teamId, userId);
    return apiSuccess({ message: "Team member removed successfully" });
  } catch (error) {
    return apiError(error);
  }
}
