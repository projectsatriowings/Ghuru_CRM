"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createPipeline,
  updatePipeline,
  archivePipeline,
  setDefaultPipeline,
  createStage,
  updateStage,
  archiveStage,
  reorderStages,
  moveStage,
} from "@/lib/services/pipeline.service";
import {
  type CreatePipelineInput,
  type UpdatePipelineInput,
  type CreateStageInput,
  type UpdateStageInput,
} from "@/lib/validations/pipeline";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createPipelineAction(input: CreatePipelineInput) {
  try {
    const ctx = await requirePermission("pipelines.create");
    const pipeline = await createPipeline(ctx.organization.id, input);
    revalidatePath("/settings/pipelines");
    return { success: true as const, data: pipeline };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create pipeline.";
    return { success: false as const, error: message };
  }
}

export async function updatePipelineAction(
  pipelineId: string,
  input: UpdatePipelineInput
) {
  try {
    const ctx = await requirePermission("pipelines.update");
    const pipeline = await updatePipeline(ctx.organization.id, pipelineId, input);
    revalidatePath("/settings/pipelines");
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    return { success: true as const, data: pipeline };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update pipeline.";
    return { success: false as const, error: message };
  }
}

export async function archivePipelineAction(pipelineId: string) {
  try {
    const ctx = await requirePermission("pipelines.delete");
    const pipeline = await archivePipeline(ctx.organization.id, pipelineId);
    revalidatePath("/settings/pipelines");
    return { success: true as const, data: pipeline };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive pipeline.";
    return { success: false as const, error: message };
  }
}

export async function setDefaultPipelineAction(pipelineId: string) {
  try {
    const ctx = await requirePermission("pipelines.update");
    const pipeline = await setDefaultPipeline(ctx.organization.id, pipelineId);
    revalidatePath("/settings/pipelines");
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    return { success: true as const, data: pipeline };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to set default pipeline.";
    return { success: false as const, error: message };
  }
}

export async function createStageAction(
  pipelineId: string,
  input: CreateStageInput
) {
  try {
    const ctx = await requirePermission("pipelines.create");
    const stage = await createStage(ctx.organization.id, pipelineId, input);
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    revalidatePath("/settings/pipelines");
    return { success: true as const, data: stage };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create stage.";
    return { success: false as const, error: message };
  }
}

export async function updateStageAction(
  pipelineId: string,
  stageId: string,
  input: UpdateStageInput
) {
  try {
    const ctx = await requirePermission("pipelines.update");
    const stage = await updateStage(ctx.organization.id, stageId, input);
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    return { success: true as const, data: stage };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update stage.";
    return { success: false as const, error: message };
  }
}

export async function archiveStageAction(pipelineId: string, stageId: string) {
  try {
    const ctx = await requirePermission("pipelines.delete");
    const stage = await archiveStage(ctx.organization.id, stageId);
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    revalidatePath("/settings/pipelines");
    return { success: true as const, data: stage };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive stage.";
    return { success: false as const, error: message };
  }
}

export async function reorderStagesAction(
  pipelineId: string,
  stageIds: string[]
) {
  try {
    const ctx = await requirePermission("pipelines.update");
    const stages = await reorderStages(ctx.organization.id, pipelineId, stageIds);
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    return { success: true as const, data: stages };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to reorder stages.";
    return { success: false as const, error: message };
  }
}

export async function moveStageAction(
  pipelineId: string,
  stageId: string,
  direction: "up" | "down"
) {
  try {
    const ctx = await requirePermission("pipelines.update");
    const stages = await moveStage(ctx.organization.id, stageId, direction);
    revalidatePath(`/settings/pipelines/${pipelineId}`);
    return { success: true as const, data: stages };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to move stage.";
    return { success: false as const, error: message };
  }
}
