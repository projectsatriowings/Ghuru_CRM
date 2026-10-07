import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getInboundEvents } from "@/lib/services/integrations/inbound-webhook.service";
import { inboundEventsQuerySchema } from "@/lib/validations/integrations";
import { apiPaginatedSuccess, apiError } from "@/lib/api-response";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("integrations.view");

    const searchParams = req.nextUrl.searchParams;
    const query = inboundEventsQuerySchema.parse({
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });

    const result = await getInboundEvents(ctx.organization.id, {
      integrationId: id,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });

    return apiPaginatedSuccess(result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
    });
  } catch (error) {
    return apiError(error);
  }
}
