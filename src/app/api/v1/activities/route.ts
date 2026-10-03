import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getActivities,
  createActivity,
} from "@/lib/services/activity.service";
import {
  createActivitySchema,
  activityQuerySchema,
} from "@/lib/validations/activity";
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiError,
} from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("activities.view");

    const { searchParams } = new URL(req.url);
    const query = activityQuerySchema.parse({
      entityType: searchParams.get("entityType") || undefined,
      entityId: searchParams.get("entityId") || undefined,
      activityType: searchParams.get("activityType") || undefined,
      status: searchParams.get("status") || undefined,
      assignedTo: searchParams.get("assignedTo") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
      includeArchived: searchParams.get("includeArchived") || "false",
    });

    const result = await getActivities(ctx.organization.id, query);

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("activities.create");

    const body = await req.json();
    const validated = createActivitySchema.parse(body);

    const activity = await createActivity(
      ctx.organization.id,
      ctx.user.id,
      validated
    );

    return apiSuccess(activity, 201);
  } catch (error) {
    return apiError(error);
  }
}
