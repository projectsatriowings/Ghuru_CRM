import { z } from "zod";
import { FOLLOW_UP_STATUSES } from "@/db/schema/follow-ups";

export const followUpStatusSchema = z.enum(FOLLOW_UP_STATUSES);

export const createFollowUpSchema = z.object({
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
  dueDate: z
    .string()
    .trim()
    .min(1, "Due date is required"),
  dueTime: z
    .string()
    .trim()
    .max(50, "Due time must be 50 characters or less")
    .optional()
    .nullable(),
  assignedToUserId: z
    .string()
    .trim()
    .optional()
    .nullable(),
  status: followUpStatusSchema.optional().default("pending"),
});

export const updateFollowUpSchema = z.object({
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
  dueDate: z
    .string()
    .trim()
    .min(1, "Due date is required")
    .optional(),
  dueTime: z
    .string()
    .trim()
    .max(50, "Due time must be 50 characters or less")
    .optional()
    .nullable(),
  assignedToUserId: z
    .string()
    .trim()
    .optional()
    .nullable(),
  status: followUpStatusSchema.optional(),
});

export type CreateFollowUpInput = z.input<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.input<typeof updateFollowUpSchema>;
