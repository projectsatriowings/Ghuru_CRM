import { z } from "zod";

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Team name is required")
    .max(100, "Team name must not exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must not exceed 500 characters")
    .nullable()
    .optional(),
});

export const updateTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Team name is required")
    .max(100, "Team name must not exceed 100 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description must not exceed 500 characters")
    .nullable()
    .optional(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required"),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
