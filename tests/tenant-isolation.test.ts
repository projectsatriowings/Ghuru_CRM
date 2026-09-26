import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import {
  createOrganization,
  getOrganizationBySlug,
} from "@/lib/services/organization.service";
import {
  addMemberToOrganization,
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
} from "@/lib/services/user.service";
import {
  createRole,
  getOrganizationRoles,
  deleteRole,
} from "@/lib/services/role.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";

describe("Multi-Tenant Isolation & RBAC Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;

  beforeAll(async () => {
    // 1. Create in-memory PostgreSQL instance
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply DDL migration
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/0000_moaning_vector.sql"),
      "utf-8"
    );

    // Split on statement-breakpoint and execute each statement
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await client.exec(stmt);
    }

    // 3. Pre-create test users in the users table
    user1Id = crypto.randomUUID();
    user2Id = crypto.randomUUID();
    user3Id = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: user1Id,
        name: "User One (Org A Admin)",
        email: "user1@org-a.com",
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "User Two (Org B Admin)",
        email: "user2@org-b.com",
        emailVerified: true,
      },
      {
        id: user3Id,
        name: "User Three (Org A Member)",
        email: "user3@org-a.com",
        emailVerified: true,
      },
    ]);
  });

  describe("1. Organization Creation & Default Admin Role", () => {
    it("should successfully create Organization A and automatically configure Organization Admin", async () => {
      const result = await createOrganization(
        {
          name: "Acme Corp",
          slug: "acme-corp",
          userId: user1Id,
        },
        testDb
      );

      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBeDefined();
      expect(result.organization.name).toBe("Acme Corp");
      expect(result.organization.slug).toBe("acme-corp");

      expect(result.role).toBeDefined();
      expect(result.role.name).toBe(DEFAULT_ORG_ADMIN_ROLE);
      expect(result.role.organizationId).toBe(result.organization.id);

      expect(result.member).toBeDefined();
      expect(result.member.userId).toBe(user1Id);
      expect(result.member.roleId).toBe(result.role.id);
      expect(result.member.organizationId).toBe(result.organization.id);
    });

    it("should prevent duplicate organization slug", async () => {
      await expect(
        createOrganization(
          {
            name: "Acme Clone",
            slug: "acme-corp", // same slug as previous
            userId: user2Id,
          },
          testDb
        )
      ).rejects.toThrow(ConflictError);
    });

    it("should create Organization B with isolated tenant space", async () => {
      const result = await createOrganization(
        {
          name: "Beta Global",
          slug: "beta-global",
          userId: user2Id,
        },
        testDb
      );

      expect(result.organization.slug).toBe("beta-global");
      expect(result.role.name).toBe(DEFAULT_ORG_ADMIN_ROLE);
      expect(result.role.organizationId).toBe(result.organization.id);
      expect(result.member.userId).toBe(user2Id);
    });
  });

  describe("2. Membership & Duplicate Prevention", () => {
    it("should prevent adding a duplicate membership for the same user and organization", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const rolesA = await getOrganizationRoles(orgA!.id, testDb);
      const adminRoleA = rolesA[0];

      await expect(
        addMemberToOrganization(
          {
            organizationId: orgA!.id,
            name: "User One Duplicate",
            email: "user1@org-a.com",
            roleId: adminRoleA.id,
          },
          testDb
        )
      ).rejects.toThrow(ConflictError);
    });

    it("should successfully add User Three as a member to Organization A", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const rolesA = await getOrganizationRoles(orgA!.id, testDb);
      const adminRoleA = rolesA[0];

      const membership = await addMemberToOrganization(
        {
          organizationId: orgA!.id,
          name: "User Three (Org A Member)",
          email: "user3@org-a.com",
          roleId: adminRoleA.id,
        },
        testDb
      );

      expect(membership.userId).toBe(user3Id);
      expect(membership.organizationId).toBe(orgA!.id);
    });
  });

  describe("3. Server-side Tenant Isolation Verification", () => {
    it("should strictly isolate member records between Organization A and Organization B", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const orgB = await getOrganizationBySlug("beta-global", testDb);

      const membersA = await getOrganizationMembers(orgA!.id, testDb);
      const membersB = await getOrganizationMembers(orgB!.id, testDb);

      // Org A should have User 1 and User 3
      const emailsA = membersA.map((m: { email: string }) => m.email);
      expect(emailsA).toContain("user1@org-a.com");
      expect(emailsA).toContain("user3@org-a.com");
      expect(emailsA).not.toContain("user2@org-b.com");

      // Org B should have User 2 only
      const emailsB = membersB.map((m: { email: string }) => m.email);
      expect(emailsB).toContain("user2@org-b.com");
      expect(emailsB).not.toContain("user1@org-a.com");
      expect(emailsB).not.toContain("user3@org-a.com");
    });

    it("should prevent cross-tenant role assignment (assigning Org B's role to Org A member)", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const orgB = await getOrganizationBySlug("beta-global", testDb);

      const rolesB = await getOrganizationRoles(orgB!.id, testDb);
      const orgBRoleId = rolesB[0].id;

      // Attempting to add a member to Org A using a role from Org B must fail validation
      await expect(
        addMemberToOrganization(
          {
            organizationId: orgA!.id,
            name: "Cross Tenant User",
            email: "crosstenant@test.com",
            roleId: orgBRoleId,
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should prevent updating a member of Organization A from Organization B context", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const orgB = await getOrganizationBySlug("beta-global", testDb);

      const membersA = await getOrganizationMembers(orgA!.id, testDb);
      const memberA = membersA[0];
      const rolesB = await getOrganizationRoles(orgB!.id, testDb);

      // Calling updateMemberRole for Org B with Org A's member ID should throw NotFoundError
      await expect(
        updateMemberRole(
          {
            organizationId: orgB!.id,
            memberId: memberA.id,
            roleId: rolesB[0].id,
          },
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should prevent deleting a member of Organization A from Organization B context", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const orgB = await getOrganizationBySlug("beta-global", testDb);

      const membersA = await getOrganizationMembers(orgA!.id, testDb);
      const memberA = membersA[0];

      // Calling removeMember for Org B with Org A's member ID should throw NotFoundError
      await expect(
        removeMember(
          {
            organizationId: orgB!.id,
            memberId: memberA.id,
            currentUserId: user2Id,
          },
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("4. Custom Roles & RBAC Enforcement", () => {
    it("should create a custom role with a specific subset of permissions in Org A", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);

      const customRole = await createRole(
        {
          organizationId: orgA!.id,
          name: "Viewer Only",
          description: "Can only view organization and users",
          permissionKeys: ["organization.view", "users.view"],
        },
        testDb
      );

      expect(customRole.name).toBe("Viewer Only");
      expect(customRole.permissions.length).toBe(2);
      const keys = customRole.permissions.map((p: { key: string }) => p.key);
      expect(keys).toContain("organization.view");
      expect(keys).toContain("users.view");
      expect(keys).not.toContain("users.create");
      expect(keys).not.toContain("users.delete");
    });

    it("should assign User Three the 'Viewer Only' role", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const rolesA = await getOrganizationRoles(orgA!.id, testDb);
      const viewerRole = rolesA.find((r: { name: string }) => r.name === "Viewer Only")!;
      const membersA = await getOrganizationMembers(orgA!.id, testDb);
      const member3 = membersA.find((m: { userId: string }) => m.userId === user3Id)!;

      const updated = await updateMemberRole(
        {
          organizationId: orgA!.id,
          memberId: member3.id,
          roleId: viewerRole.id,
        },
        testDb
      );

      expect(updated.roleId).toBe(viewerRole.id);
    });

    it("should prevent deleting the default 'Organization Admin' role", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const rolesA = await getOrganizationRoles(orgA!.id, testDb);
      const adminRole = rolesA.find((r: { name: string }) => r.name === DEFAULT_ORG_ADMIN_ROLE)!;

      await expect(
        deleteRole(
          {
            organizationId: orgA!.id,
            roleId: adminRole.id,
          },
          testDb
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent deleting a role while members are assigned to it", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const rolesA = await getOrganizationRoles(orgA!.id, testDb);
      const viewerRole = rolesA.find((r: { name: string }) => r.name === "Viewer Only")!;

      await expect(
        deleteRole(
          {
            organizationId: orgA!.id,
            roleId: viewerRole.id,
          },
          testDb
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("should allow deleting a custom role once all members are reassigned or removed", async () => {
      const orgA = await getOrganizationBySlug("acme-corp", testDb);
      const membersA = await getOrganizationMembers(orgA!.id, testDb);
      const member3 = membersA.find((m: { userId: string }) => m.userId === user3Id)!;

      // Remove member3
      await removeMember(
        {
          organizationId: orgA!.id,
          memberId: member3.id,
          currentUserId: user1Id,
        },
        testDb
      );

      const rolesA = await getOrganizationRoles(orgA!.id, testDb);
      const viewerRole = rolesA.find((r) => r.name === "Viewer Only")!;

      const deleteResult = await deleteRole(
        {
          organizationId: orgA!.id,
          roleId: viewerRole.id,
        },
        testDb
      );

      expect(deleteResult.success).toBe(true);

      const updatedRolesA = await getOrganizationRoles(orgA!.id, testDb);
      expect(updatedRolesA.find((r) => r.name === "Viewer Only")).toBeUndefined();
    });
  });
});
