import { z } from "zod";
import { ACTIVITY_TYPES } from "@/db/schema/activities";

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

export const createActivitySchema = z.object({
  type: activityTypeSchema,
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(255, "Title must be 255 characters or less"),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .nullable(),
});

export const updateActivitySchema = z.object({
  type: activityTypeSchema.optional(),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(255, "Title must be 255 characters or less")
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .nullable(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
