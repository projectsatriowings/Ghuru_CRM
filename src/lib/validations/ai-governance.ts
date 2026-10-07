import { z } from "zod";

/**
 * Validation schema for updating organization AI governance settings.
 * Strict rules:
 * - Positive integers only
 * - Reasonable upper bounds
 * - Reject negative values, NaN, floats, and malformed inputs
 */
export const updateAISettingsSchema = z
  .object({
    aiEnabled: z.boolean().optional(),
    dailyRequestLimit: z
      .number()
      .int("Daily request limit must be an integer")
      .min(1, "Daily request limit must be at least 1")
      .max(100000, "Daily request limit cannot exceed 100,000")
      .optional(),
    monthlyRequestLimit: z
      .number()
      .int("Monthly request limit must be an integer")
      .min(1, "Monthly request limit must be at least 1")
      .max(1000000, "Monthly request limit cannot exceed 1,000,000")
      .optional(),
  })
  .refine(
    (data) =>
      data.aiEnabled !== undefined ||
      data.dailyRequestLimit !== undefined ||
      data.monthlyRequestLimit !== undefined,
    {
      message: "At least one setting (aiEnabled, dailyRequestLimit, monthlyRequestLimit) must be provided",
    }
  );

export type UpdateAISettingsInput = z.infer<typeof updateAISettingsSchema>;

/**
 * Validation schema for querying AI audit logs.
 */
export const aiAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  endpoint: z.string().optional(),
  status: z.enum(["success", "failure"]).optional(),
  errorCategory: z.string().optional(),
  provider: z.string().optional(),
  userId: z.string().optional(),
  correlationId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AIAuditQueryParams = z.infer<typeof aiAuditQuerySchema>;
