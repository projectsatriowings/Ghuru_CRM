import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createLead } from "@/lib/services/lead.service";
import {
  createFollowUp,
  getLeadFollowUps,
  getFollowUpById,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  archiveFollowUp,
  selectPrimaryNextAction,
} from "@/lib/services/follow-up.service";
import {
  createFollowUpSchema,
} from "@/lib/validations/follow-up";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";

describe("Milestone 2.3B — Follow-ups & Next Action Test Suite", () => {
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

    // 2. Read and apply all DDL migrations in order (0000 to 0004)
    const migrationFiles = [
      "0000_moaning_vector.sql",
      "0001_flashy_king_bedlam.sql",
      "0002_lowly_shape.sql",
      "0003_furry_fixer.sql",
      "0004_glamorous_natasha_romanoff.sql",
      "0005_eminent_red_ghost.sql",
      "0006_new_kinsey_walden.sql",
      "0007_shiny_hellcat.sql",
      "0008_neat_terrax.sql",
      "0009_talented_bastion.sql",
      "0010_amused_gambit.sql",
      "0011_chubby_pete_wisdom.sql",
      "0012_amused_sheva_callister.sql",
      "0013_regular_silk_fever.sql",
      "0014_flimsy_gorilla_man.sql",
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
        name: "Sharika Admin",
        email: "sharika@org-a.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "External User",
        email: "external@org-b.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Alpha Workspace", slug: "alpha-ws", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Workspace", slug: "beta-ws", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Create Leads in each Org
    const leadA = await createLead(
      orgAId,
      {
        firstName: "Rahul",
        email: "rahul@example.com",
        source: "website",
        status: "new",
      },
      testDb
    );
    leadAId = leadA.id;

    const leadB = await createLead(
      orgBId,
      {
        firstName: "Bob Customer",
        email: "bob@example.com",
        source: "phone_enquiry",
        status: "new",
      },
      testDb
    );
    leadBId = leadB.id;
  });

  describe("1. Follow-up Creation & Validation", () => {
    it("1. should successfully create a follow-up with valid inputs", async () => {
      const followUp = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Follow up with lead",
          description: "Discuss course details and confirm weekend batch.",
          dueDate: "2026-10-04",
          dueTime: "11:00",
          assignedToUserId: userAId,
        },
        testDb
      );

      expect(followUp).toBeDefined();
      expect(followUp.id).toBeDefined();
      expect(followUp.organizationId).toBe(orgAId);
      expect(followUp.leadId).toBe(leadAId);
      expect(followUp.title).toBe("Follow up with lead");
      expect(followUp.description).toBe(
        "Discuss course details and confirm weekend batch."
      );
      expect(followUp.dueDate).toBe("2026-10-04");
      expect(followUp.dueTime).toBe("11:00");
      expect(followUp.status).toBe("pending");
      expect(followUp.assignedToUserId).toBe(userAId);
      expect(followUp.assignedToUser?.name).toBe("Sharika Admin");
      expect(followUp.createdByUserId).toBe(userAId);
      expect(followUp.createdByUser?.name).toBe("Sharika Admin");
      expect(followUp.completedAt).toBeNull();
      expect(followUp.archivedAt).toBeNull();
    });

    it("2. should reject follow-up creation when title is empty", async () => {
      const validation = createFollowUpSchema.safeParse({
        title: "   ",
        dueDate: "2026-10-04",
      });
      expect(validation.success).toBe(false);
    });

    it("3. should reject follow-up creation when due_date is missing or empty", async () => {
      const validationMissing = createFollowUpSchema.safeParse({
        title: "Call candidate",
      });
      expect(validationMissing.success).toBe(false);

      const validationEmpty = createFollowUpSchema.safeParse({
        title: "Call candidate",
        dueDate: "  ",
      });
      expect(validationEmpty.success).toBe(false);
    });

    it("4. should accept valid statuses: pending, completed, cancelled", async () => {
      for (const st of ["pending", "completed", "cancelled"] as const) {
        const val = createFollowUpSchema.safeParse({
          title: `Task ${st}`,
          dueDate: "2026-10-05",
          status: st,
        });
        expect(val.success).toBe(true);
      }
    });

    it("5. should reject invalid status values", async () => {
      const val = createFollowUpSchema.safeParse({
        title: "Invalid status test",
        dueDate: "2026-10-05",
        status: "in_progress", // not in controlled set
      });
      expect(val.success).toBe(false);
    });
  });

  describe("2. Follow-up Retrieval & Details", () => {
    it("6. should retrieve a single follow-up by ID with relation details", async () => {
      const created = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Detailed Follow-up",
          dueDate: "2026-10-06",
          dueTime: "14:30",
          assignedToUserId: userAId,
        },
        testDb
      );

      const fetched = await getFollowUpById(orgAId, created.id, testDb);
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe("Detailed Follow-up");
      expect(fetched.dueTime).toBe("14:30");
      expect(fetched.assignedToUser?.name).toBe("Sharika Admin");
      expect(fetched.createdByUser?.name).toBe("Sharika Admin");
    });
  });

  describe("3. Follow-up Updating, Completion & Cancellation", () => {
    it("7. should update follow-up fields", async () => {
      const created = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Initial Title",
          dueDate: "2026-10-07",
        },
        testDb
      );

      const updated = await updateFollowUp(
        orgAId,
        created.id,
        {
          title: "Call to confirm weekend batch",
          description: "New updated description",
          dueDate: "2026-10-08",
          dueTime: "15:00",
        },
        testDb
      );

      expect(updated.title).toBe("Call to confirm weekend batch");
      expect(updated.description).toBe("New updated description");
      expect(updated.dueDate).toBe("2026-10-08");
      expect(updated.dueTime).toBe("15:00");
    });

    it("8 & 9. should mark follow-up as completed and record completed_at timestamp", async () => {
      const created = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Action to Complete",
          dueDate: "2026-10-04",
        },
        testDb
      );

      expect(created.completedAt).toBeNull();
      expect(created.status).toBe("pending");

      const completed = await completeFollowUp(orgAId, created.id, testDb);
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).not.toBeNull();
      expect(new Date(completed.completedAt!).getTime()).toBeGreaterThan(0);
    });

    it("10. should mark follow-up as cancelled", async () => {
      const created = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Action to Cancel",
          dueDate: "2026-10-04",
        },
        testDb
      );

      const cancelled = await cancelFollowUp(orgAId, created.id, testDb);
      expect(cancelled.status).toBe("cancelled");
    });

    it("11. should soft-delete/archive follow-up and exclude from normal active listings", async () => {
      const created = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Action to Archive",
          dueDate: "2026-10-10",
        },
        testDb
      );

      const archived = await archiveFollowUp(orgAId, created.id, testDb);
      expect(archived.archivedAt).not.toBeNull();

      // Ensure excluded from default query
      const normalList = await getLeadFollowUps(orgAId, leadAId, undefined, testDb);
      expect(normalList.some((f) => f.id === created.id)).toBe(false);

      // Present when includeArchived = true
      const allList = await getLeadFollowUps(
        orgAId,
        leadAId,
        { includeArchived: true },
        testDb
      );
      expect(allList.some((f) => f.id === created.id)).toBe(true);
    });
  });

  describe("4. Ordering & Primary Next Action Selection", () => {
    it("12 & 13. should list lead follow-ups ordered by due date, due time, and created_at", async () => {
      const fu1 = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Later Date Action",
          dueDate: "2026-10-20",
          dueTime: "10:00",
        },
        testDb
      );

      const fu2 = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Earlier Date Action",
          dueDate: "2026-10-15",
          dueTime: "14:00",
        },
        testDb
      );

      const list = await getLeadFollowUps(orgAId, leadAId, undefined, testDb);
      const idx1 = list.findIndex((f) => f.id === fu1.id);
      const idx2 = list.findIndex((f) => f.id === fu2.id);

      expect(idx2).toBeLessThan(idx1); // 2026-10-15 precedes 2026-10-20
    });

    it("14. selectPrimaryNextAction should correctly pick the earliest pending follow-up", () => {
      const sampleList: (typeof schema.followUps.$inferSelect)[] = [
        {
          id: "fu-completed",
          organizationId: orgAId,
          leadId: leadAId,
          dealId: null,
          assignedToUserId: null,
          title: "Past completed follow-up",
          description: null,
          dueDate: "2026-10-01",
          dueTime: "09:00",
          status: "completed",
          createdByUserId: userAId,
          createdAt: new Date("2026-10-01"),
          updatedAt: new Date("2026-10-01"),
          completedAt: new Date(),
          archivedAt: null,
        },
        {
          id: "fu-pending-later",
          organizationId: orgAId,
          leadId: leadAId,
          dealId: null,
          assignedToUserId: null,
          title: "Later pending action",
          description: null,
          dueDate: "2026-10-12",
          dueTime: "10:00",
          status: "pending",
          createdByUserId: userAId,
          createdAt: new Date("2026-10-01"),
          updatedAt: new Date("2026-10-01"),
          completedAt: null,
          archivedAt: null,
        },
        {
          id: "fu-pending-earliest",
          organizationId: orgAId,
          leadId: leadAId,
          dealId: null,
          assignedToUserId: null,
          title: "Earliest pending action",
          description: null,
          dueDate: "2026-10-04",
          dueTime: "11:00",
          status: "pending",
          createdByUserId: userAId,
          createdAt: new Date("2026-10-01"),
          updatedAt: new Date("2026-10-01"),
          completedAt: null,
          archivedAt: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const primary = selectPrimaryNextAction(sampleList as any);
      expect(primary).toBeDefined();
      expect(primary?.id).toBe("fu-pending-earliest");
    });
  });

  describe("5. Multi-Tenant Isolation & Security Checks", () => {
    it("15. should isolate follow-up listings between organizations", async () => {
      const orgBList = await getLeadFollowUps(orgBId, leadBId, undefined, testDb);
      expect(orgBList.some((f) => f.leadId === leadAId)).toBe(false);
    });

    it("16. should reject follow-up creation against a lead belonging to another organization", async () => {
      await expect(
        createFollowUp(
          orgBId, // Org B
          userBId,
          leadAId, // Belongs to Org A
          {
            title: "Cross Tenant Lead Hack",
            dueDate: "2026-10-05",
          },
          testDb
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("17. should reject assigning follow-up to a user belonging to another organization", async () => {
      await expect(
        createFollowUp(
          orgAId, // Org A
          userAId,
          leadAId,
          {
            title: "Cross Tenant Assignee Hack",
            dueDate: "2026-10-05",
            assignedToUserId: userBId, // userB belongs only to Org B!
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("18. should reject cross-tenant follow-up access (view, update, archive)", async () => {
      const followUpA = await createFollowUp(
        orgAId,
        userAId,
        leadAId,
        {
          title: "Org A Secret Follow-up",
          dueDate: "2026-10-09",
        },
        testDb
      );

      // Org B cannot retrieve Org A follow-up
      await expect(
        getFollowUpById(orgBId, followUpA.id, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org B cannot update Org A follow-up
      await expect(
        updateFollowUp(orgBId, followUpA.id, { title: "Hacked" }, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org B cannot archive Org A follow-up
      await expect(
        archiveFollowUp(orgBId, followUpA.id, testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("6. RBAC & Organization Admin Permission Availability", () => {
    it("19. should verify all required follow-up permission keys exist in INITIAL_PERMISSIONS", () => {
      const required = [
        "follow_ups.view",
        "follow_ups.create",
        "follow_ups.update",
        "follow_ups.delete",
      ];

      for (const p of required) {
        expect(INITIAL_PERMISSIONS.some((ip) => ip.key === p)).toBe(true);
      }
    });

    it("20. Organization Admin role must have all follow-up permissions configured", async () => {
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

      expect(permKeys).toContain("follow_ups.view");
      expect(permKeys).toContain("follow_ups.create");
      expect(permKeys).toContain("follow_ups.update");
      expect(permKeys).toContain("follow_ups.delete");
    });
  });
});
