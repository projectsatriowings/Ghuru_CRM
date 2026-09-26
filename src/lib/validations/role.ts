import { z } from "zod";

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters")
    .trim(),
  description: z.string().max(255, "Description must be at most 255 characters").optional(),
  permissionKeys: z
    .array(z.string())
    .min(1, "At least one permission must be assigned to the role"),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters")
    .trim()
    .optional(),
  description: z.string().max(255, "Description must be at most 255 characters").optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
