import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getAutomationExecutions } from "@/lib/services/automation.service";
import { automationExecutionQuerySchema } from "@/lib/validations/automation";
import { apiPaginatedSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("automations.view");

    const { searchParams } = new URL(req.url);
    const query = automationExecutionQuerySchema.parse({
      automationId: id,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
    });

    const result = await getAutomationExecutions(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}
