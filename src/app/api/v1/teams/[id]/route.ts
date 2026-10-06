import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getTeamById,
  updateTeam,
  archiveTeam,
} from "@/lib/services/team.service";
import { updateTeamSchema } from "@/lib/validations/team";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: teamId } = await params;
    const ctx = await requirePermission("teams.view");

    const team = await getTeamById(ctx.organization.id, teamId);
    return apiSuccess(team);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: teamId } = await params;
    const ctx = await requirePermission("teams.update");

    const body = await req.json();
    const validated = updateTeamSchema.parse(body);

    const updated = await updateTeam(ctx.organization.id, teamId, validated);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: teamId } = await params;
    const ctx = await requirePermission("teams.delete");

    await archiveTeam(ctx.organization.id, teamId);
    return apiSuccess({ message: "Team archived successfully" });
  } catch (error) {
    return apiError(error);
  }
}
