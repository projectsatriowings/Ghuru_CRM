import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getOrganizationAIAuditLogs } from "@/lib/services/ai/ai-audit.service";
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
        "Forbidden: You do not have permission [ai.view] to view AI audit logs."
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 50;
    const endpoint = searchParams.get("endpoint") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "success" || statusParam === "failure"
        ? statusParam
        : undefined;

    const logs = await getOrganizationAIAuditLogs(ctx.organization.id, {
      limit,
      endpoint,
      status,
    });

    const res = apiSuccess(logs);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
