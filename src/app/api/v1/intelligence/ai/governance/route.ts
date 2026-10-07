import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getAIGovernanceSummary } from "@/lib/services/ai/ai-governance.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const correlationId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${crypto.randomUUID()}`;

  try {
    const ctx = await requireOrganization();

    if (!ctx.hasPermission("ai_governance.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [ai_governance.view] to view AI governance data."
      );
    }

    const summary = await getAIGovernanceSummary(ctx.organization.id);

    const res = apiSuccess(summary);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
