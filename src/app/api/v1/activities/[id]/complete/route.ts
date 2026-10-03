import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import { completeActivity } from "@/lib/services/activity.service";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: activityId } = await params;
    const ctx = await requirePermission("activities.update");

    const activity = await completeActivity(ctx.organization.id, activityId);

    return apiSuccess({
      message: "Activity completed successfully",
      activity,
    });
  } catch (error) {
    return apiError(error);
  }
}
