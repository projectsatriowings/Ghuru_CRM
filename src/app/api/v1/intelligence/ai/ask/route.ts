import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { askCRMQuestion } from "@/lib/services/ai/ai-insights.service";
import { aiAskQuerySchema } from "@/lib/validations/ai";
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
        "Forbidden: You do not have permission [ai.view] to query the CRM AI assistant."
      );
    }

    const body = await req.json();
    const validated = aiAskQuerySchema.parse(body);

    // Entity-level RBAC check
    if (validated.entityType === "deal" && !ctx.hasPermission("deals.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [deals.view] to ask about deals."
      );
    }
    if (validated.entityType === "lead" && !ctx.hasPermission("leads.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [leads.view] to ask about leads."
      );
    }
    if (
      (validated.entityType === "owner" || validated.entityType === "team") &&
      !ctx.hasPermission("teams.view")
    ) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [teams.view] to ask about teams or owners."
      );
    }
    if (validated.entityType === "pipeline" && !ctx.hasPermission("pipelines.view")) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission [pipelines.view] to ask about pipelines."
      );
    }

    const entityRef =
      validated.entityType && validated.entityId
        ? { entityType: validated.entityType, entityId: validated.entityId }
        : undefined;

    const answer = await askCRMQuestion(
      ctx.organization.id,
      ctx.user.id,
      ctx.permissionKeys,
      validated.question,
      entityRef,
      { correlationId }
    );

    const res = apiSuccess(answer);
    res.headers.set("x-request-id", correlationId);
    return res;
  } catch (error) {
    const res = apiError(error);
    res.headers.set("x-request-id", correlationId);
    return res;
  }
}
