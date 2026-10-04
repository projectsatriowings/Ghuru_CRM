import { z } from "zod";

export const dashboardDateRangePresetSchema = z.enum([
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "custom",
]);

export const dashboardQuerySchema = z.object({
  preset: dashboardDateRangePresetSchema.optional().default("last_30_days"),
  from: z.string().optional(),
  to: z.string().optional(),
  assigneeId: z.string().trim().optional(),
  pipelineId: z.string().trim().optional(),
});

export type DashboardQueryParams = z.infer<typeof dashboardQuerySchema>;
