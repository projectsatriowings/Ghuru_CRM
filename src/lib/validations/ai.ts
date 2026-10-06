import { z } from "zod";

export const aiAskQuerySchema = z.object({
  question: z
    .string()
    .min(1, "Question cannot be empty.")
    .max(500, "Question cannot exceed 500 characters."),
  entityType: z
    .enum(["lead", "deal", "pipeline", "owner", "team", "company", "contact"])
    .optional(),
  entityId: z.string().max(100).optional(),
});

export type AIAssistantQueryInput = z.infer<typeof aiAskQuerySchema>;

export const aiExplainQuerySchema = z.object({
  metricKey: z
    .string()
    .min(1, "metricKey cannot be empty.")
    .max(100, "metricKey cannot exceed 100 characters."),
  entityType: z
    .enum(["lead", "deal", "pipeline", "owner", "team", "company", "contact"])
    .optional(),
  entityId: z.string().max(100).optional(),
});

export type AIExplainQueryInput = z.infer<typeof aiExplainQuerySchema>;

export const aiBriefingQuerySchema = z.object({
  preset: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  assigneeId: z.string().optional(),
  pipelineId: z.string().optional(),
  forceRefresh: z
    .union([z.boolean(), z.string().transform((v) => v === "true")])
    .optional(),
});

export type AIBriefingQueryInput = z.infer<typeof aiBriefingQuerySchema>;
