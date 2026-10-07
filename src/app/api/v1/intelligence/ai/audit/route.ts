import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getOrganizationAIAuditLogsPaginated } from "@/lib/services/ai/ai-governance.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const correlationId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    `req_${crypto.randomUUID()}`;

  try {
    const ctx = await requireOrganization();

    if (!ctx.hasPermission("ai_governance.view") && !ctx.hasPermission("ai.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [ai_governance.view] to view AI audit logs."
      );
    }

    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const pageSize = searchParams.get("pageSize") || searchParams.get("limit")
      ? parseInt((searchParams.get("pageSize") || searchParams.get("limit"))!, 10)
      : 50;

    const endpoint = searchParams.get("endpoint") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "success" || statusParam === "failure"
        ? (statusParam as "success" | "failure")
        : undefined;

    const errorCategory = searchParams.get("errorCategory") || undefined;
    const provider = searchParams.get("provider") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const reqCorrelationId = searchParams.get("correlationId") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const result = await getOrganizationAIAuditLogsPaginated(ctx.organization.id, {
      page,
      pageSize,
      endpoint,
      status,
      errorCategory,
      provider,
      userId,
      correlationId: reqCorrelationId,
      from,
      to,
    });

    // If flat format requested (for backward compatibility), return items array
    if (searchParams.get("flat") === "true") {
      const res = apiSuccess(result.items);
      res.headers.set("x-request-id", correlationId);
      return res;
    }

    const res = apiSuccess(result);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
