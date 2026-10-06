import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getTeams, createTeam } from "@/lib/services/team.service";
import { createTeamSchema } from "@/lib/validations/team";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const ctx = await requirePermission("teams.view");
    const teams = await getTeams(ctx.organization.id);
    return apiSuccess(teams);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("teams.create");
    const body = await req.json();
    const validated = createTeamSchema.parse(body);

    const team = await createTeam(ctx.organization.id, validated);
    return apiSuccess(team, 201);
  } catch (error) {
    return apiError(error);
  }
}
