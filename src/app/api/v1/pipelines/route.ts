import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getPipelines,
  createPipeline,
} from "@/lib/services/pipeline.service";
import { createPipelineSchema } from "@/lib/validations/pipeline";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const ctx = await requirePermission("pipelines.view");
    const pipelines = await getPipelines(ctx.organization.id);
    return apiSuccess(pipelines);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("pipelines.create");
    const body = await req.json();
    const validated = createPipelineSchema.parse(body);

    const pipeline = await createPipeline(ctx.organization.id, validated);
    return apiSuccess(pipeline, 201);
  } catch (error) {
    return apiError(error);
  }
}
