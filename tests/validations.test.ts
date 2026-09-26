import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema } from "@/lib/validations/auth";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/validations/organization";
import { addMemberSchema, updateMemberRoleSchema } from "@/lib/validations/user";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/role";

describe("Validation Schemas", () => {
  describe("Auth Validations", () => {
    it("should accept valid signup input", () => {
      const valid = {
        name: "Test User",
        email: "test@example.com",
        password: "securepassword123",
      };
      const result = signupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject signup with password less than 8 characters", () => {
      const invalid = {
        name: "Test User",
        email: "test@example.com",
        password: "short",
      };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("8 characters");
      }
    });

    it("should reject invalid email format", () => {
      const invalid = {
        name: "Test User",
        email: "not-an-email",
        password: "securepassword123",
      };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should validate login input properly", () => {
      const valid = { email: "user@example.com", password: "password123" };
      expect(loginSchema.safeParse(valid).success).toBe(true);

      const invalid = { email: "bad-email", password: "" };
      expect(loginSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("Organization Validations", () => {
    it("should accept valid organization name and slug", () => {
      const valid = { name: "Acme Corporation", slug: "acme-corp" };
      expect(createOrganizationSchema.safeParse(valid).success).toBe(true);
    });

    it("should reject reserved slugs", () => {
      const reserved = [
        "admin",
        "api",
        "auth",
        "dashboard",
        "settings",
        "login",
      ];
      for (const slug of reserved) {
        const result = createOrganizationSchema.safeParse({
          name: "Test Org",
          slug,
        });
        expect(result.success).toBe(false);
      }
    });

    it("should reject slugs with invalid characters or leading/trailing hyphens", () => {
      const invalidSlugs = [
        "-leading-hyphen",
        "trailing-hyphen-",
        "Uppercase-Slug",
        "space in slug",
        "special!chars",
      ];
      for (const slug of invalidSlugs) {
        const result = createOrganizationSchema.safeParse({
          name: "Test Org",
          slug,
        });
        expect(result.success).toBe(false);
      }
    });
    it("should accept valid update organization input", () => {
      const valid = { name: "Updated Name", slug: "updated-name" };
      expect(updateOrganizationSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe("User & Member Validations", () => {
    it("should validate add member input", () => {
      const valid = {
        name: "John Doe",
        email: "john@example.com",
        roleId: "role-123",
      };
      expect(addMemberSchema.safeParse(valid).success).toBe(true);

      const invalid = {
        name: "J",
        email: "not-an-email",
        roleId: "",
      };
      expect(addMemberSchema.safeParse(invalid).success).toBe(false);
    });

    it("should validate update member role input", () => {
      const valid = { memberId: "mem-1", roleId: "role-2" };
      expect(updateMemberRoleSchema.safeParse(valid).success).toBe(true);

      const invalid = { memberId: "", roleId: "" };
      expect(updateMemberRoleSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("Role Validations", () => {
    it("should validate role creation with permissions", () => {
      const valid = {
        name: "Support Agent",
        description: "Customer support role",
        permissionKeys: ["users.view", "organization.view"],
      };
      expect(createRoleSchema.safeParse(valid).success).toBe(true);
    });

    it("should reject role creation with empty permissions array", () => {
      const invalid = {
        name: "Empty Role",
        description: "No permissions",
        permissionKeys: [],
      };
      expect(createRoleSchema.safeParse(invalid).success).toBe(false);
    });

    it("should validate role update input", () => {
      const valid = {
        name: "Updated Role",
        description: "Updated description",
        permissionKeys: ["users.view"],
      };
      expect(updateRoleSchema.safeParse(valid).success).toBe(true);
    });
  });
});
