import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { generateAINextActions } from "@/lib/services/ai/ai-insights.service";
import { aiBriefingQuerySchema } from "@/lib/validations/ai";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const correlationId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${crypto.randomUUID()}`;

  try {
    const ctx = await requireOrganization();

    if (!ctx.hasPermission("ai.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [ai.view] to view AI next actions."
      );
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      preset: searchParams.get("preset") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      assigneeId: searchParams.get("assigneeId") || undefined,
      pipelineId: searchParams.get("pipelineId") || undefined,
    };

    const validated = aiBriefingQuerySchema.parse(rawQuery);

    const nextActions = await generateAINextActions(
      ctx.organization.id,
      ctx.user.id,
      ctx.permissionKeys,
      { ...validated, correlationId }
    );

    const res = apiSuccess(nextActions);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
