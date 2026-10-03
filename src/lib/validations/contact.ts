import { z } from "zod";

export const phoneValidationSchema = z
  .string()
  .trim()
  .max(30, "Phone number must not exceed 30 characters")
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      const digits = val.replace(/\D/g, "");
      return (
        /^[+]?[\d\s\-()./]+$/.test(val.trim()) &&
        digits.length >= 5 &&
        digits.length <= 20
      );
    },
    { message: "Please provide a valid phone number." }
  )
  .nullable()
  .optional()
  .or(z.literal(""));

export const emailValidationSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .toLowerCase()
  .nullable()
  .optional()
  .or(z.literal(""));

export const createContactSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name must not exceed 100 characters"),
  lastName: z
    .string()
    .trim()
    .max(100, "Last name must not exceed 100 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  email: emailValidationSchema,
  phone: phoneValidationSchema,
  ownerUserId: z.string().nullable().optional().or(z.literal("")),
  notes: z
    .string()
    .max(5000, "Notes must not exceed 5000 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const updateContactSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name cannot be empty")
    .max(100, "First name must not exceed 100 characters")
    .optional(),
  lastName: z
    .string()
    .trim()
    .max(100, "Last name must not exceed 100 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  email: emailValidationSchema,
  phone: phoneValidationSchema,
  ownerUserId: z.string().nullable().optional().or(z.literal("")),
  notes: z
    .string()
    .max(5000, "Notes must not exceed 5000 characters")
    .nullable()
    .optional()
    .or(z.literal("")),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const contactQuerySchema = z.object({
  search: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  archived: z.string().trim().optional().default("false"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(["createdAt", "updatedAt", "firstName", "lastName"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateContactInput = z.input<typeof createContactSchema>;
export type UpdateContactInput = z.input<typeof updateContactSchema>;
export type ContactQueryInput = z.input<typeof contactQuerySchema>;
