import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getStageById,
  updateStage,
  archiveStage,
} from "@/lib/services/pipeline.service";
import { updateStageSchema } from "@/lib/validations/pipeline";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: stageId } = await params;
    const ctx = await requirePermission("pipelines.view");

    const stage = await getStageById(ctx.organization.id, stageId);
    return apiSuccess(stage);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: stageId } = await params;
    const ctx = await requirePermission("pipelines.update");

    const body = await req.json();
    const validated = updateStageSchema.parse(body);

    const updated = await updateStage(ctx.organization.id, stageId, validated);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: stageId } = await params;
    const ctx = await requirePermission("pipelines.delete");

    const archived = await archiveStage(ctx.organization.id, stageId);

    return apiSuccess({
      message: "Pipeline stage archived successfully",
      stage: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
