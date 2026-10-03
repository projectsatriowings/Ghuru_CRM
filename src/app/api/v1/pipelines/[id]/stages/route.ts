import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getPipelineStages,
  createStage,
} from "@/lib/services/pipeline.service";
import { createStageSchema } from "@/lib/validations/pipeline";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: pipelineId } = await params;
    const ctx = await requirePermission("pipelines.view");

    const stages = await getPipelineStages(ctx.organization.id, pipelineId);
    return apiSuccess(stages);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: pipelineId } = await params;
    const ctx = await requirePermission("pipelines.create");

    const body = await req.json();
    const validated = createStageSchema.parse(body);

    const stage = await createStage(ctx.organization.id, pipelineId, validated);
    return apiSuccess(stage, 201);
  } catch (error) {
    return apiError(error);
  }
}
