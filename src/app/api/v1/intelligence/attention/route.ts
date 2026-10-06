import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getOrganizationAttentionItems } from "@/lib/services/crm-health.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import {
  IntelligenceEntityType,
  IntelligenceSeverity,
} from "@/lib/types/intelligence";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireOrganization();

    if (
      !ctx.hasPermission("intelligence.view") &&
      !ctx.hasPermission("dashboard.view") &&
      !ctx.hasPermission("leads.view") &&
      !ctx.hasPermission("deals.view")
    ) {
      throw new ForbiddenError(
        "Forbidden: You do not have permission to view CRM intelligence."
      );
    }

    const { searchParams } = new URL(req.url);
    const rawEntityType = searchParams.get("entityType");
    const rawSeverity = searchParams.get("severity");
    const assigneeId = searchParams.get("assigneeId") || undefined;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const pageSize = searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!, 10)
      : 20;

    let entityType: IntelligenceEntityType | "all" | undefined = undefined;
    if (rawEntityType && rawEntityType !== "all") {
      if (rawEntityType !== "lead" && rawEntityType !== "deal") {
        throw new ValidationError("Invalid entityType. Supported values: 'lead', 'deal', 'all'.");
      }
      entityType = rawEntityType as IntelligenceEntityType;
    }

    let severity: IntelligenceSeverity | "high_and_critical" | "all" | undefined = undefined;
    if (rawSeverity && rawSeverity !== "all") {
      if (
        rawSeverity !== "low" &&
        rawSeverity !== "medium" &&
        rawSeverity !== "high" &&
        rawSeverity !== "critical" &&
        rawSeverity !== "high_and_critical"
      ) {
        throw new ValidationError("Invalid severity filter.");
      }
      severity = rawSeverity as IntelligenceSeverity | "high_and_critical";
    }

    const data = await getOrganizationAttentionItems(ctx.organization.id, {
      entityType,
      severity,
      assigneeId,
      page,
      pageSize,
    });

    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
