import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getLeadHealth, getDealHealth } from "@/lib/services/crm-health.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError, ValidationError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{
    entityType: string;
    entityId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireOrganization();
    const { entityType, entityId } = await params;

    if (!entityId || entityId.trim() === "") {
      throw new ValidationError("Entity ID is required.");
    }

    if (entityType === "lead") {
      if (!ctx.hasPermission("leads.view")) {
        throw new ForbiddenError(
          "Forbidden: You do not have permission [leads.view] to view lead health."
        );
      }
      const health = await getLeadHealth(ctx.organization.id, entityId);
      return apiSuccess(health);
    } else if (entityType === "deal") {
      if (!ctx.hasPermission("deals.view")) {
        throw new ForbiddenError(
          "Forbidden: You do not have permission [deals.view] to view deal health."
        );
      }
      const health = await getDealHealth(ctx.organization.id, entityId);
      return apiSuccess(health);
    } else {
      throw new ValidationError(
        `Unsupported entityType '${entityType}'. Supported types: 'lead', 'deal'.`
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
