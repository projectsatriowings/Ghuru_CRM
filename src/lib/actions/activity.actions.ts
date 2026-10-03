"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createActivity,
  updateActivity,
  completeActivity,
  cancelActivity,
  archiveActivity,
} from "@/lib/services/activity.service";
import {
  type CreateActivityInput,
  type UpdateActivityInput,
} from "@/lib/validations/activity";
import { type CrmEntityType } from "@/db/schema/activities";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

function revalidateEntityPath(entityType: string, entityId: string) {
  if (entityType === "lead") {
    revalidatePath(`/leads/${entityId}`);
    revalidatePath("/leads");
  } else if (entityType === "contact") {
    revalidatePath(`/contacts/${entityId}`);
    revalidatePath("/contacts");
  } else if (entityType === "company") {
    revalidatePath(`/companies/${entityId}`);
    revalidatePath("/companies");
  }
}

export async function createActivityAction(
  leadIdOrInput: string | (CreateActivityInput & { entityType: CrmEntityType; entityId: string }),
  maybeInput?: CreateActivityInput
) {
  try {
    const ctx = await requirePermission("activities.create");
    let activity;

    if (typeof leadIdOrInput === "string") {
      // Legacy signature: (leadId, input)
      activity = await createActivity(
        ctx.organization.id,
        ctx.user.id,
        leadIdOrInput,
        maybeInput!
      );
      revalidatePath(`/leads/${leadIdOrInput}`);
    } else {
      // Unified signature: (inputWithEntityType)
      activity = await createActivity(
        ctx.organization.id,
        ctx.user.id,
        leadIdOrInput
      );
      revalidateEntityPath(leadIdOrInput.entityType, leadIdOrInput.entityId);
    }

    return { success: true as const, data: activity };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create activity.";
    return { success: false as const, error: message };
  }
}

export async function updateActivityAction(
  activityId: string,
  leadIdOrInput: string | UpdateActivityInput,
  maybeInput?: UpdateActivityInput
) {
  try {
    const ctx = await requirePermission("activities.update");
    let input: UpdateActivityInput;

    if (typeof leadIdOrInput === "string") {
      input = maybeInput!;
    } else {
      input = leadIdOrInput;
    }

    const activity = await updateActivity(
      ctx.organization.id,
      activityId,
      input
    );

    if (activity.entityType && activity.entityId) {
      revalidateEntityPath(activity.entityType, activity.entityId);
    }

    return { success: true as const, data: activity };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update activity.";
    return { success: false as const, error: message };
  }
}

export async function completeActivityAction(activityId: string) {
  try {
    const ctx = await requirePermission("activities.update");
    const activity = await completeActivity(ctx.organization.id, activityId);

    if (activity.entityType && activity.entityId) {
      revalidateEntityPath(activity.entityType, activity.entityId);
    }

    return { success: true as const, data: activity };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to complete activity.";
    return { success: false as const, error: message };
  }
}

export async function cancelActivityAction(activityId: string) {
  try {
    const ctx = await requirePermission("activities.update");
    const activity = await cancelActivity(ctx.organization.id, activityId);

    if (activity.entityType && activity.entityId) {
      revalidateEntityPath(activity.entityType, activity.entityId);
    }

    return { success: true as const, data: activity };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to cancel activity.";
    return { success: false as const, error: message };
  }
}

export async function archiveActivityAction(
  activityId: string,
  maybeLeadId?: string
) {
  try {
    const ctx = await requirePermission("activities.delete");
    const activity = await archiveActivity(ctx.organization.id, activityId);

    if (activity.entityType && activity.entityId) {
      revalidateEntityPath(activity.entityType, activity.entityId);
    } else if (maybeLeadId) {
      revalidatePath(`/leads/${maybeLeadId}`);
    }

    return { success: true as const, data: activity };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive activity.";
    return { success: false as const, error: message };
  }
}
