import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getLeadActivities,
  createActivity,
} from "@/lib/services/activity.service";
import { createActivitySchema } from "@/lib/validations/activity";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: leadId } = await params;
    const ctx = await requirePermission("activities.view");

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const activitiesList = await getLeadActivities(
      ctx.organization.id,
      leadId,
      { includeArchived }
    );

    return apiSuccess(activitiesList);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: leadId } = await params;
    const ctx = await requirePermission("activities.create");

    const body = await req.json();
    const validated = createActivitySchema.parse(body);

    const activity = await createActivity(
      ctx.organization.id,
      ctx.user.id,
      leadId,
      validated
    );

    return apiSuccess(activity, 201);
  } catch (error) {
    return apiError(error);
  }
}
