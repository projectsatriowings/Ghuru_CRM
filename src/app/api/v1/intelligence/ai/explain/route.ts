import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { explainMetric } from "@/lib/services/ai/ai-insights.service";
import { aiExplainQuerySchema } from "@/lib/validations/ai";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const correlationId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${crypto.randomUUID()}`;

  try {
    const ctx = await requireOrganization();

    if (!ctx.hasPermission("ai.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [ai.view] to request metric explanations."
      );
    }

    const body = await req.json();
    const validated = aiExplainQuerySchema.parse(body);

    const explanation = await explainMetric(
      ctx.organization.id,
      ctx.user.id,
      ctx.permissionKeys,
      validated.metricKey,
      { correlationId }
    );

    const res = apiSuccess(explanation);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
