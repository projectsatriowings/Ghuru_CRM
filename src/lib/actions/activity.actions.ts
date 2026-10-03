"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createActivity,
  updateActivity,
  archiveActivity,
} from "@/lib/services/activity.service";
import {
  type CreateActivityInput,
  type UpdateActivityInput,
} from "@/lib/validations/activity";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createActivityAction(
  leadId: string,
  input: CreateActivityInput
) {
  try {
    const ctx = await requirePermission("activities.create");
    const activity = await createActivity(
      ctx.organization.id,
      ctx.user.id,
      leadId,
      input
    );
    revalidatePath(`/leads/${leadId}`);
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
  leadId: string,
  input: UpdateActivityInput
) {
  try {
    const ctx = await requirePermission("activities.update");
    const activity = await updateActivity(
      ctx.organization.id,
      activityId,
      input
    );
    revalidatePath(`/leads/${leadId}`);
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

export async function archiveActivityAction(
  activityId: string,
  leadId: string
) {
  try {
    const ctx = await requirePermission("activities.delete");
    const activity = await archiveActivity(ctx.organization.id, activityId);
    revalidatePath(`/leads/${leadId}`);
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
