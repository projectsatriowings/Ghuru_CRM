import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { getDeals, createDeal } from "@/lib/services/deal.service";
import {
  createDealSchema,
  dealQuerySchema,
} from "@/lib/validations/deal";
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("deals.view");

    const { searchParams } = new URL(req.url);
    const query = dealQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      pipelineId: searchParams.get("pipelineId") || undefined,
      pipelineStageId: searchParams.get("pipelineStageId") || undefined,
      companyId: searchParams.get("companyId") || undefined,
      contactId: searchParams.get("contactId") || undefined,
      leadId: searchParams.get("leadId") || undefined,
      archived: searchParams.get("archived") || "false",
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 25,
      sort: searchParams.get("sort") || "createdAt",
      sortDirection: searchParams.get("sortDirection") || "desc",
    });

    const result = await getDeals(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("deals.create");

    const body = await req.json();
    const validated = createDealSchema.parse(body);

    const deal = await createDeal(
      ctx.organization.id,
      validated,
      undefined,
      ctx.user.id
    );

    return apiSuccess(deal, 201);
  } catch (error) {
    return apiError(error);
  }
}
