import { z } from "zod";

export const createPipelineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Pipeline name must not be empty.")
    .max(100, "Pipeline name must be at most 100 characters."),
  description: z.string().trim().max(500).nullish(),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional().default(0),
});

export const updatePipelineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Pipeline name must not be empty.")
    .max(100, "Pipeline name must be at most 100 characters.")
    .optional(),
  description: z.string().trim().max(500).nullish(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const createStageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Stage name must not be empty.")
    .max(100, "Stage name must be at most 100 characters."),
  description: z.string().trim().max(500).nullish(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().optional().default(true),
});

export const updateStageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Stage name must not be empty.")
    .max(100, "Stage name must be at most 100 characters.")
    .optional(),
  description: z.string().trim().max(500).nullish(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const reorderStagesSchema = z.object({
  stageIds: z
    .array(z.string().min(1, "Stage ID must not be empty."))
    .min(1, "At least one stage ID is required.")
    .refine((items) => new Set(items).size === items.length, {
      message: "Duplicate stage IDs are not allowed.",
    }),
});

export type CreatePipelineInput = z.input<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.input<typeof updatePipelineSchema>;
export type CreateStageInput = z.input<typeof createStageSchema>;
export type UpdateStageInput = z.input<typeof updateStageSchema>;
export type ReorderStagesInput = z.input<typeof reorderStagesSchema>;
