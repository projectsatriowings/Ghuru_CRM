import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { reorderStages } from "@/lib/services/pipeline.service";
import { reorderStagesSchema } from "@/lib/validations/pipeline";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: pipelineId } = await params;
    const ctx = await requirePermission("pipelines.update");

    const body = await req.json();
    const validated = reorderStagesSchema.parse(body);

    const reordered = await reorderStages(
      ctx.organization.id,
      pipelineId,
      validated.stageIds
    );

    return apiSuccess({
      message: "Stages reordered successfully",
      stages: reordered,
    });
  } catch (error) {
    return apiError(error);
  }
}
