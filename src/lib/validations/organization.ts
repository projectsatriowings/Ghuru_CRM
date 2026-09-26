import { z } from "zod";

const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "login",
  "logout",
  "onboarding",
  "settings",
  "signup",
  "system",
  "support",
  "app",
];

export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(50, "Slug must be at most 50 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug can only contain lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)"
  )
  .refine((slug) => !RESERVED_SLUGS.includes(slug), {
    message: "This slug is reserved and cannot be used",
  });

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .trim(),
  slug: slugSchema,
});

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .trim()
    .optional(),
  slug: slugSchema.optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
