import { NextRequest } from "next/server";
import { requireOrganization } from "@/lib/context/organization-context";
import { getOrganizationAttentionSummary } from "@/lib/services/crm-health.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { ForbiddenError } from "@/lib/errors";

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
        "Forbidden: You do not have permission to view CRM intelligence summary."
      );
    }

    const { searchParams } = new URL(req.url);
    const assigneeId = searchParams.get("assigneeId") || undefined;

    const summary = await getOrganizationAttentionSummary(
      ctx.organization.id,
      assigneeId
    );

    return apiSuccess(summary);
  } catch (error) {
    return apiError(error);
  }
}
