import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getAutomations,
  createAutomation,
} from "@/lib/services/automation.service";
import {
  createAutomationSchema,
  automationQuerySchema,
} from "@/lib/validations/automation";
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("automations.view");

    const { searchParams } = new URL(req.url);
    const query = automationQuerySchema.parse({
      search: searchParams.get("search") || undefined,
      entityType: searchParams.get("entityType") || undefined,
      triggerType: searchParams.get("triggerType") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
      sort: searchParams.get("sort") || "createdAt",
      sortDirection: searchParams.get("sortDirection") || "desc",
    });

    const result = await getAutomations(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("automations.create");

    const body = await req.json();
    const validated = createAutomationSchema.parse(body);

    const automation = await createAutomation(
      ctx.organization.id,
      validated,
      undefined,
      ctx.user.id
    );

    return apiSuccess(automation, 201);
  } catch (error) {
    return apiError(error);
  }
}
