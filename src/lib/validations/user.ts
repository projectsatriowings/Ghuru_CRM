import { z } from "zod";

export const addMemberSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim(),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  roleId: z.string().min(1, "Role must be specified"),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  roleId: z.string().min(1, "Role ID is required"),
});

export const removeMemberSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
