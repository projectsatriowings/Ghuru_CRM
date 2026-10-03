import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getActivitiesForEntity,
  createActivity,
} from "@/lib/services/activity.service";
import { createActivitySchema } from "@/lib/validations/activity";
import { apiSuccess, apiPaginatedSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = await params;
    const ctx = await requirePermission("activities.view");

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 20;

    const result = await getActivitiesForEntity(
      ctx.organization.id,
      "company",
      companyId,
      { includeArchived, page, pageSize }
    );

    return apiPaginatedSuccess(result.data, result.pagination);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: companyId } = await params;
    const ctx = await requirePermission("activities.create");

    const body = await req.json();
    const validated = createActivitySchema.parse({
      ...body,
      entityType: "company",
      entityId: companyId,
    });

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
