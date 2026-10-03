import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getActivityById,
  updateActivity,
  archiveActivity,
} from "@/lib/services/activity.service";
import { updateActivitySchema } from "@/lib/validations/activity";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: activityId } = await params;
    const ctx = await requirePermission("activities.view");

    const activity = await getActivityById(ctx.organization.id, activityId);

    return apiSuccess(activity);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: activityId } = await params;
    const ctx = await requirePermission("activities.update");

    const body = await req.json();
    const validated = updateActivitySchema.parse(body);

    const updated = await updateActivity(
      ctx.organization.id,
      activityId,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: activityId } = await params;
    const ctx = await requirePermission("activities.delete");

    const archived = await archiveActivity(ctx.organization.id, activityId);

    return apiSuccess({
      message: "Activity archived successfully",
      activity: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
