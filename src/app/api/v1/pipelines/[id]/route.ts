import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getPipelineById,
  updatePipeline,
  archivePipeline,
} from "@/lib/services/pipeline.service";
import { updatePipelineSchema } from "@/lib/validations/pipeline";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: pipelineId } = await params;
    const ctx = await requirePermission("pipelines.view");

    const pipeline = await getPipelineById(ctx.organization.id, pipelineId);
    return apiSuccess(pipeline);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: pipelineId } = await params;
    const ctx = await requirePermission("pipelines.update");

    const body = await req.json();
    const validated = updatePipelineSchema.parse(body);

    const updated = await updatePipeline(
      ctx.organization.id,
      pipelineId,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: pipelineId } = await params;
    const ctx = await requirePermission("pipelines.delete");

    const archived = await archivePipeline(ctx.organization.id, pipelineId);

    return apiSuccess({
      message: "Pipeline archived successfully",
      pipeline: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
