import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getFollowUpById,
  updateFollowUp,
  archiveFollowUp,
} from "@/lib/services/follow-up.service";
import { updateFollowUpSchema } from "@/lib/validations/follow-up";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: followUpId } = await params;
    const ctx = await requirePermission("follow_ups.view");

    const followUp = await getFollowUpById(ctx.organization.id, followUpId);

    return apiSuccess(followUp);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: followUpId } = await params;
    const ctx = await requirePermission("follow_ups.update");

    const body = await req.json();
    const validated = updateFollowUpSchema.parse(body);

    const updated = await updateFollowUp(
      ctx.organization.id,
      followUpId,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: followUpId } = await params;
    const ctx = await requirePermission("follow_ups.delete");

    const archived = await archiveFollowUp(ctx.organization.id, followUpId);

    return apiSuccess({
      message: "Follow-up archived successfully",
      followUp: archived,
    });
  } catch (error) {
    return apiError(error);
  }
}
