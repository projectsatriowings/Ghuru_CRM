import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { dashboardQuerySchema } from "@/lib/validations/dashboard";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrganization();

    // Check dashboard.view or fallback organization.view
    if (
      !ctx.hasPermission("dashboard.view") &&
      !ctx.hasPermission("organization.view")
    ) {
      throw new ForbiddenError(
        "Forbidden: You do not have the required permission [dashboard.view] to view the CRM dashboard."
      );
    }

    const { searchParams } = new URL(req.url);
    const query = dashboardQuerySchema.parse({
      preset: searchParams.get("preset") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      assigneeId: searchParams.get("assigneeId") || undefined,
      pipelineId: searchParams.get("pipelineId") || undefined,
    });

    const data = await getDashboardData(ctx.organization.id, ctx.user.id, {
      preset: query.preset,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      assigneeId: query.assigneeId,
      pipelineId: query.pipelineId,
    });

    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
