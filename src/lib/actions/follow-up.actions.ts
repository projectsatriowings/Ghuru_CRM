"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  archiveFollowUp,
} from "@/lib/services/follow-up.service";
import {
  type CreateFollowUpInput,
  type UpdateFollowUpInput,
} from "@/lib/validations/follow-up";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createFollowUpAction(
  targetId: string,
  input: CreateFollowUpInput
) {
  try {
    const ctx = await requirePermission("follow_ups.create");
    const followUp = await createFollowUp(
      ctx.organization.id,
      ctx.user.id,
      targetId,
      input
    );
    revalidatePath(`/leads/${targetId}`);
    revalidatePath(`/deals/${targetId}`);
    return { success: true as const, data: followUp };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create follow-up.";
    return { success: false as const, error: message };
  }
}

export async function updateFollowUpAction(
  followUpId: string,
  targetId: string,
  input: UpdateFollowUpInput
) {
  try {
    const ctx = await requirePermission("follow_ups.update");
    const followUp = await updateFollowUp(
      ctx.organization.id,
      followUpId,
      input
    );
    revalidatePath(`/leads/${targetId}`);
    revalidatePath(`/deals/${targetId}`);
    return { success: true as const, data: followUp };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update follow-up.";
    return { success: false as const, error: message };
  }
}

export async function completeFollowUpAction(
  followUpId: string,
  targetId?: string
) {
  try {
    const ctx = await requirePermission("follow_ups.update");
    const followUp = await completeFollowUp(ctx.organization.id, followUpId);
    if (targetId) {
      revalidatePath(`/leads/${targetId}`);
      revalidatePath(`/deals/${targetId}`);
    }
    return { success: true as const, data: followUp };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to complete follow-up.";
    return { success: false as const, error: message };
  }
}

export async function cancelFollowUpAction(
  followUpId: string,
  targetId?: string
) {
  try {
    const ctx = await requirePermission("follow_ups.update");
    const followUp = await cancelFollowUp(ctx.organization.id, followUpId);
    if (targetId) {
      revalidatePath(`/leads/${targetId}`);
      revalidatePath(`/deals/${targetId}`);
    }
    return { success: true as const, data: followUp };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to cancel follow-up.";
    return { success: false as const, error: message };
  }
}

export async function archiveFollowUpAction(
  followUpId: string,
  targetId?: string
) {
  try {
    const ctx = await requirePermission("follow_ups.delete");
    const followUp = await archiveFollowUp(ctx.organization.id, followUpId);
    if (targetId) {
      revalidatePath(`/leads/${targetId}`);
      revalidatePath(`/deals/${targetId}`);
    }
    return { success: true as const, data: followUp };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive follow-up.";
    return { success: false as const, error: message };
  }
}
