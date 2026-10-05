"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createAutomation,
  updateAutomation,
  archiveAutomation,
  restoreAutomation,
} from "@/lib/services/automation.service";
import {
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from "@/lib/validations/automation";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createAutomationAction(input: CreateAutomationInput) {
  try {
    const ctx = await requirePermission("automations.create");
    const automation = await createAutomation(
      ctx.organization.id,
      input,
      undefined,
      ctx.user.id
    );
    revalidatePath("/automations");
    return { success: true as const, data: automation };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create automation.";
    return { success: false as const, error: message };
  }
}

export async function updateAutomationAction(
  automationId: string,
  input: UpdateAutomationInput
) {
  try {
    const ctx = await requirePermission("automations.update");
    const automation = await updateAutomation(
      ctx.organization.id,
      automationId,
      input
    );
    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);
    return { success: true as const, data: automation };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update automation.";
    return { success: false as const, error: message };
  }
}

export async function toggleAutomationActiveAction(
  automationId: string,
  active: boolean
) {
  try {
    const ctx = await requirePermission("automations.update");
    const automation = await updateAutomation(
      ctx.organization.id,
      automationId,
      { active }
    );
    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);
    return { success: true as const, data: automation };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to toggle automation status.";
    return { success: false as const, error: message };
  }
}

export async function archiveAutomationAction(automationId: string) {
  try {
    const ctx = await requirePermission("automations.delete");
    const automation = await archiveAutomation(
      ctx.organization.id,
      automationId
    );
    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);
    return { success: true as const, data: automation };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive automation.";
    return { success: false as const, error: message };
  }
}

export async function restoreAutomationAction(automationId: string) {
  try {
    const ctx = await requirePermission("automations.update");
    const automation = await restoreAutomation(
      ctx.organization.id,
      automationId
    );
    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);
    return { success: true as const, data: automation };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to restore automation.";
    return { success: false as const, error: message };
  }
}
