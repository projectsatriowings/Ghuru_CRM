import { z } from "zod";
import { DEAL_STATUSES } from "@/db/schema/deals";

export const dealStatusSchema = z.enum(DEAL_STATUSES);

export const createDealSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Deal name is required")
    .max(255, "Deal name must be 255 characters or less"),
  leadId: z.string().trim().optional().nullable(),
  contactId: z.string().trim().optional().nullable(),
  companyId: z.string().trim().optional().nullable(),
  ownerUserId: z.string().trim().optional().nullable(),
  pipelineId: z.string().trim().min(1, "Pipeline is required"),
  pipelineStageId: z.string().trim().min(1, "Pipeline stage is required"),
  value: z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .regex(/^-?\d+(\.\d{1,2})?$/, "Value must be a valid number"),
    ])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      return typeof val === "number" ? val : Number(val);
    })
    .refine(
      (val) => val === null || (!isNaN(val) && val >= 0),
      "Value must be a positive number or zero"
    ),
  currency: z.string().trim().min(1).max(10).default("USD"),
  expectedCloseDate: z
    .preprocess((val) => {
      if (!val || val === "") return null;
      if (typeof val === "string" || val instanceof Date) {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d;
      }
      return val;
    }, z.date({ message: "Invalid expected close date" }).optional().nullable())
    .optional()
    .nullable(),
  status: dealStatusSchema.optional().default("open"),
  probability: z
    .coerce
    .number()
    .int("Probability must be an integer")
    .min(0, "Probability must be between 0 and 100")
    .max(100, "Probability must be between 0 and 100")
    .optional()
    .nullable(),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateDealSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Deal name is required")
    .max(255, "Deal name must be 255 characters or less")
    .optional(),
  leadId: z.string().trim().optional().nullable(),
  contactId: z.string().trim().optional().nullable(),
  companyId: z.string().trim().optional().nullable(),
  ownerUserId: z.string().trim().optional().nullable(),
  pipelineId: z.string().trim().min(1, "Pipeline is required").optional(),
  pipelineStageId: z
    .string()
    .trim()
    .min(1, "Pipeline stage is required")
    .optional(),
  value: z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .regex(/^-?\d+(\.\d{1,2})?$/, "Value must be a valid number"),
    ])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null || val === "") return null;
      return typeof val === "number" ? val : Number(val);
    })
    .refine(
      (val) => val === undefined || val === null || (!isNaN(val) && val >= 0),
      "Value must be a positive number or zero"
    ),
  currency: z.string().trim().min(1).max(10).optional(),
  expectedCloseDate: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (!val || val === "") return null;
      if (typeof val === "string" || val instanceof Date) {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d;
      }
      return val;
    }, z.date({ message: "Invalid expected close date" }).optional().nullable())
    .optional()
    .nullable(),
  status: dealStatusSchema.optional(),
  probability: z
    .coerce
    .number()
    .int("Probability must be an integer")
    .min(0, "Probability must be between 0 and 100")
    .max(100, "Probability must be between 0 and 100")
    .optional()
    .nullable(),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be 5000 characters or less")
    .optional()
    .nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const dealQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["all", ...DEAL_STATUSES]).optional(),
  ownerId: z.string().trim().optional(),
  pipelineId: z.string().trim().optional(),
  pipelineStageId: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
  contactId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  archived: z.enum(["false", "true", "all"]).default("false"),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(["createdAt", "updatedAt", "name", "value", "expectedCloseDate"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateDealInput = z.input<typeof createDealSchema>;
export type UpdateDealInput = z.input<typeof updateDealSchema>;
export type DealQueryInput = z.input<typeof dealQuerySchema>;
