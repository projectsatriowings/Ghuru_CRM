import { z } from "zod";
import {
  ACTIVITY_TYPES,
  CRM_ENTITY_TYPES,
  ACTIVITY_STATUSES,
} from "@/db/schema/activities";

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export const crmEntityTypeSchema = z.enum(CRM_ENTITY_TYPES);
export const activityStatusSchema = z.enum(ACTIVITY_STATUSES);

export const createActivitySchema = z.object({
  entityType: crmEntityTypeSchema.optional().default("lead"),
  entityId: z.string().trim().min(1, "Entity ID is required").optional(),
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
  status: activityStatusSchema.optional().default("completed"),
  assignedToUserId: z.string().trim().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
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
  status: activityStatusSchema.optional(),
  assignedToUserId: z.string().trim().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
});

export const activityQuerySchema = z.object({
  entityType: crmEntityTypeSchema.optional(),
  entityId: z.string().trim().optional(),
  activityType: activityTypeSchema.optional(),
  status: activityStatusSchema.optional(),
  assignedTo: z.string().trim().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  includeArchived: z
    .preprocess(
      (val) => val === true || val === "true" || val === "1",
      z.boolean()
    )
    .default(false),
});

export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type UpdateActivityInput = z.input<typeof updateActivitySchema>;
export type ActivityQueryParams = z.input<typeof activityQuerySchema>;
