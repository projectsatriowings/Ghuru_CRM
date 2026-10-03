import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createLead } from "@/lib/services/lead.service";
import {
  createActivity,
  getLeadActivities,
  getActivityById,
  updateActivity,
  archiveActivity,
} from "@/lib/services/activity.service";
import { createActivitySchema } from "@/lib/validations/activity";
import { NotFoundError } from "@/lib/errors";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";

describe("Milestone 2.3A — Lead Activities Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let leadAId: string;
  let leadBId: string;

  beforeAll(async () => {
    // 1. Initialize PGlite database
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migration SQL files in order
    const migrationFiles = [
      "0000_moaning_vector.sql",
      "0001_flashy_king_bedlam.sql",
      "0002_lowly_shape.sql",
      "0003_furry_fixer.sql",
      "0004_glamorous_natasha_romanoff.sql",
      "0005_eminent_red_ghost.sql",
      "0006_new_kinsey_walden.sql",
    ];

    for (const file of migrationFiles) {
      const filePath = path.resolve(__dirname, `../drizzle/${file}`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const stmt of content
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)) {
          await client.exec(stmt);
        }
      }
    }

    // 3. Create test users
    userAId = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: userAId,
        name: "Alice Admin",
        email: "alice@org-a.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "Bob Admin",
        email: "bob@org-b.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Org Alpha", slug: "org-alpha", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Org Beta", slug: "org-beta", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Create Leads in each Org
    const leadA = await createLead(
      orgAId,
      {
        firstName: "Lead Alpha",
        email: "lead.alpha@example.com",
        source: "website",
        status: "new",
      },
      testDb
    );
    leadAId = leadA.id;

    const leadB = await createLead(
      orgBId,
      {
        firstName: "Lead Beta",
        email: "lead.beta@example.com",
        source: "phone_enquiry",
        status: "new",
      },
      testDb
    );
    leadBId = leadB.id;
  });

  describe("1. Activity Creation & Validation", () => {
    it("1. should successfully create an activity with valid input", async () => {
      const activity = await createActivity(
        orgAId,
        userAId,
        leadAId,
        {
          type: "call",
          title: "Initial Discovery Call",
          description: "Discussed requirements and pricing options.",
        },
        testDb
      );

      expect(activity).toBeDefined();
      expect(activity.id).toBeDefined();
      expect(activity.organizationId).toBe(orgAId);
      expect(activity.leadId).toBe(leadAId);
      expect(activity.type).toBe("call");
      expect(activity.title).toBe("Initial Discovery Call");
      expect(activity.description).toBe("Discussed requirements and pricing options.");
      expect(activity.createdByUserId).toBe(userAId);
      expect(activity.createdByUser?.name).toBe("Alice Admin");
      expect(activity.archivedAt).toBeNull();
    });

    it("2. should reject activity creation when title is empty or missing", async () => {
      const validationEmpty = createActivitySchema.safeParse({
        type: "call",
        title: "   ",
      });
      expect(validationEmpty.success).toBe(false);

      const validationMissing = createActivitySchema.safeParse({
        type: "call",
      });
      expect(validationMissing.success).toBe(false);
    });

    it("3. should accept all valid activity types: call, email, meeting, note, task", async () => {
      const validTypes = ["call", "email", "meeting", "note", "task"] as const;

      for (const t of validTypes) {
        const act = await createActivity(
          orgAId,
          userAId,
          leadAId,
          {
            type: t,
            title: `Logged ${t}`,
          },
          testDb
        );
        expect(act.type).toBe(t);
      }
    });

    it("4. should reject invalid/arbitrary activity type values", async () => {
      const invalidValidation = createActivitySchema.safeParse({
        type: "whatsapp_message",
        title: "Invalid Type Activity",
      });
      expect(invalidValidation.success).toBe(false);
    });
  });

  describe("2. Activity Retrieval & Lead Timeline Listing", () => {
    it("5. should retrieve a single activity by ID with creator details", async () => {
      const created = await createActivity(
        orgAId,
        userAId,
        leadAId,
        {
          type: "note",
          title: "Internal Strategy Note",
          description: "Client interested in weekend batch.",
        },
        testDb
      );

      const fetched = await getActivityById(orgAId, created.id, testDb);
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe("Internal Strategy Note");
      expect(fetched.createdByUser?.name).toBe("Alice Admin");
    });

    it("8. should list lead activities ordered newest first", async () => {
      await createActivity(
        orgAId,
        userAId,
        leadAId,
        { type: "meeting", title: "Meeting 1" },
        testDb
      );

      const act2 = await createActivity(
        orgAId,
        userAId,
        leadAId,
        { type: "email", title: "Email 2" },
        testDb
      );

      const timeline = await getLeadActivities(orgAId, leadAId, undefined, testDb);
      expect(timeline.length).toBeGreaterThanOrEqual(2);
      expect(timeline[0].id).toBe(act2.id); // Newest first
    });
  });

  describe("3. Activity Update & Deletion/Archiving", () => {
    it("6. should update activity type, title, and description", async () => {
      const created = await createActivity(
        orgAId,
        userAId,
        leadAId,
        {
          type: "task",
          title: "Original Task Title",
          description: "Original description",
        },
        testDb
      );

      const updated = await updateActivity(
        orgAId,
        created.id,
        {
          type: "meeting",
          title: "Updated Meeting Title",
          description: "Updated meeting description",
        },
        testDb
      );

      expect(updated.id).toBe(created.id);
      expect(updated.type).toBe("meeting");
      expect(updated.title).toBe("Updated Meeting Title");
      expect(updated.description).toBe("Updated meeting description");
    });

    it("7. should soft delete/archive activity and exclude it from normal timeline", async () => {
      const created = await createActivity(
        orgAId,
        userAId,
        leadAId,
        {
          type: "note",
          title: "To Be Archived",
        },
        testDb
      );

      const archived = await archiveActivity(orgAId, created.id, testDb);
      expect(archived.archivedAt).not.toBeNull();

      // Should be excluded from normal timeline
      const normalTimeline = await getLeadActivities(orgAId, leadAId, { includeArchived: false }, testDb);
      expect(normalTimeline.some((a) => a.id === created.id)).toBe(false);

      // Should be present when includeArchived is true
      const fullTimeline = await getLeadActivities(orgAId, leadAId, { includeArchived: true }, testDb);
      expect(fullTimeline.some((a) => a.id === created.id)).toBe(true);
    });
  });

  describe("4. Multi-Tenant Isolation & Cross-Tenant Access Rejection", () => {
    it("9. should isolate activity listings between organizations", async () => {
      const orgBActivities = await getLeadActivities(orgBId, leadBId, undefined, testDb);
      expect(orgBActivities.some((a) => a.leadId === leadAId)).toBe(false);
    });

    it("10. should reject activity creation against a Lead from another organization", async () => {
      await expect(
        createActivity(
          orgBId, // Org B
          userBId,
          leadAId, // Lead A belongs to Org A!
          {
            type: "call",
            title: "Cross Tenant Attack",
          },
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("11. should reject cross-tenant activity access (view, update, archive)", async () => {
      const activityA = await createActivity(
        orgAId,
        userAId,
        leadAId,
        {
          type: "note",
          title: "Org A Private Activity",
        },
        testDb
      );

      // Org B cannot view Org A's activity
      await expect(
        getActivityById(orgBId, activityA.id, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org B cannot update Org A's activity
      await expect(
        updateActivity(orgBId, activityA.id, { title: "Hacked" }, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org B cannot archive Org A's activity
      await expect(
        archiveActivity(orgBId, activityA.id, testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("5. RBAC & Organization Admin Permission Availability", () => {
    it("12. should verify all required activity permission keys exist in INITIAL_PERMISSIONS", () => {
      const requiredPerms = [
        "activities.view",
        "activities.create",
        "activities.update",
        "activities.delete",
      ];

      for (const p of requiredPerms) {
        expect(INITIAL_PERMISSIONS.some((ip) => ip.key === p)).toBe(true);
      }
    });

    it("13. Organization Admin roles must have full access to activity permissions", async () => {
      const [adminRole] = await testDb
        .select()
        .from(schema.roles)
        .where(
          and(
            eq(schema.roles.organizationId, orgAId),
            eq(schema.roles.name, DEFAULT_ORG_ADMIN_ROLE)
          )
        );

      expect(adminRole).toBeDefined();

      const rolePerms = await testDb
        .select({ key: schema.permissions.key })
        .from(schema.rolePermissions)
        .innerJoin(
          schema.permissions,
          eq(schema.rolePermissions.permissionId, schema.permissions.id)
        )
        .where(eq(schema.rolePermissions.roleId, adminRole.id));

      const permKeys = rolePerms.map((rp: { key: string }) => rp.key);

      expect(permKeys).toContain("activities.view");
      expect(permKeys).toContain("activities.create");
      expect(permKeys).toContain("activities.update");
      expect(permKeys).toContain("activities.delete");
    });
  });
});
