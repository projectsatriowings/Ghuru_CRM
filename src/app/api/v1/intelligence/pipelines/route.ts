import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import {
  getDealPipelineIntelligence,
  getPipelineBottlenecks,
} from "@/lib/services/pipeline-intelligence.service";
import { dashboardQuerySchema } from "@/lib/validations/dashboard";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrganization();

    if (
      !ctx.hasPermission("intelligence.view") &&
      !ctx.hasPermission("dashboard.view") &&
      !ctx.hasPermission("deals.view") &&
      !ctx.hasPermission("organization.view")
    ) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission to view CRM pipeline intelligence."
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

    const [pipelinesData, bottlenecks] = await Promise.all([
      getDealPipelineIntelligence(ctx.organization.id, {
        preset: query.preset,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        assigneeId: query.assigneeId,
        pipelineId: query.pipelineId,
      }),
      getPipelineBottlenecks(ctx.organization.id, {
        preset: query.preset,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        assigneeId: query.assigneeId,
        pipelineId: query.pipelineId,
      }),
    ]);

    return apiSuccess({
      pipelines: pipelinesData,
      bottlenecks,
    });
  } catch (error) {
    return apiError(error);
  }
}
