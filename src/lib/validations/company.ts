import { z } from "zod";
import {
  phoneValidationSchema,
  emailValidationSchema,
} from "./contact";

export const websiteValidationSchema = z
  .string()
  .trim()
  .url("Invalid website URL")
  .max(500, "Website URL must not exceed 500 characters")
  .nullable()
  .optional()
  .or(z.literal(""));

export const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name must not exceed 200 characters"),
  website: websiteValidationSchema,
  email: emailValidationSchema,
  phone: phoneValidationSchema,
  industry: z
    .string()
    .trim()
    .max(150, "Industry must not exceed 150 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  companySize: z
    .string()
    .trim()
    .max(100, "Company size must not exceed 100 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  ownerUserId: z.string().nullable().optional().or(z.literal("")),
  notes: z
    .string()
    .max(5000, "Notes must not exceed 5000 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const updateCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name cannot be empty")
    .max(200, "Company name must not exceed 200 characters")
    .optional(),
  website: websiteValidationSchema,
  email: emailValidationSchema,
  phone: phoneValidationSchema,
  industry: z
    .string()
    .trim()
    .max(150, "Industry must not exceed 150 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  companySize: z
    .string()
    .trim()
    .max(100, "Company size must not exceed 100 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  ownerUserId: z.string().nullable().optional().or(z.literal("")),
  notes: z
    .string()
    .max(5000, "Notes must not exceed 5000 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const companyQuerySchema = z.object({
  search: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  archived: z.string().trim().optional().default("false"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(["createdAt", "updatedAt", "name", "industry"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateCompanyInput = z.input<typeof createCompanySchema>;
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;
export type CompanyQueryInput = z.input<typeof companyQuerySchema>;
