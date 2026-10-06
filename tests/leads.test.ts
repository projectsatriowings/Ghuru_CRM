import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createCustomField } from "@/lib/services/custom-field.service";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  archiveLead,
  restoreLead,
} from "@/lib/services/lead.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.2 — Lead Management Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let user1Id: string;
  let user2Id: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // 1. Initialize in-memory PostgreSQL instance with PGlite
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply DDL migrations 0000 to 0006
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
      const content = fs.readFileSync(
        path.resolve(__dirname, `../drizzle/${file}`),
        "utf-8"
      );
      for (const stmt of content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)) {
        await client.exec(stmt);
      }
    }

    // 3. Create test users
    user1Id = crypto.randomUUID();
    user2Id = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: user1Id,
        name: "User Alpha",
        email: "alpha@orga.com",
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "User Beta",
        email: "beta@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organization A (User Alpha is Admin) and Organization B (User Beta is Admin)
    const orgA = await createOrganization(
      { name: "Alpha Academy", slug: "alpha-academy", userId: user1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Realty", slug: "beta-realty", userId: user2Id },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Create Custom Fields for Leads in Org A
    await createCustomField(
      orgAId,
      {
        entityType: "lead",
        key: "career_goal",
        label: "Career Goal",
        fieldType: "text",
        required: true,
      },
      testDb
    );

    await createCustomField(
      orgAId,
      {
        entityType: "lead",
        key: "course_interested",
        label: "Course Interested",
        fieldType: "select",
        required: false,
        config: {
          options: [
            { label: "Full Stack", value: "full_stack" },
            { label: "Data Science", value: "data_science" },
            { label: "UI/UX Design", value: "ui_ux" },
          ],
        },
      },
      testDb
    );

    await createCustomField(
      orgAId,
      {
        entityType: "lead",
        key: "preferred_shifts",
        label: "Preferred Shifts",
        fieldType: "multiselect",
        required: false,
        config: {
          options: [
            { label: "Morning", value: "morning" },
            { label: "Evening", value: "evening" },
            { label: "Weekend", value: "weekend" },
          ],
        },
      },
      testDb
    );
  });

  describe("1. Lead Creation & Standard Fields", () => {
    it("should successfully create a lead with standard fields and valid custom fields", async () => {
      const lead = await createLead(
        orgAId,
        {
          firstName: "Rahul",
          lastName: "Kumar",
          email: "rahul@example.com",
          phone: "+91 98765 43210",
          source: "website",
          status: "new",
          assignedToUserId: user1Id,
          notes: "Initial enquiry via web contact form.",
          customFields: {
            career_goal: "Full Stack Developer",
            course_interested: "full_stack",
            preferred_shifts: ["morning", "weekend"],
          },
        },
        testDb
      );

      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.organizationId).toBe(orgAId);
      expect(lead.firstName).toBe("Rahul");
      expect(lead.lastName).toBe("Kumar");
      expect(lead.email).toBe("rahul@example.com");
      expect(lead.phone).toBe("+91 98765 43210");
      expect(lead.source).toBe("website");
      expect(lead.status).toBe("new");
      expect(lead.assignedToUserId).toBe(user1Id);
      expect(lead.assignedToUser?.name).toBe("User Alpha");
      expect(lead.notes).toBe("Initial enquiry via web contact form.");
      expect(lead.archivedAt).toBeNull();

      // Custom fields verification
      expect(lead.customFields?.career_goal).toBe("Full Stack Developer");
      expect(lead.customFields?.course_interested).toBe("full_stack");
      expect(lead.customFields?.preferred_shifts).toEqual(["morning", "weekend"]);
    });

    it("should reject lead creation without first name", async () => {
      await expect(
        createLead(
          orgAId,
          {
            firstName: "",
            customFields: { career_goal: "Engineer" },
          },
          testDb
        )
      ).rejects.toThrow();
    });

    it("should reject lead creation when required custom field is missing", async () => {
      await expect(
        createLead(
          orgAId,
          {
            firstName: "Priya",
            lastName: "Sharma",
            email: "priya@example.com",
            // missing required 'career_goal'
            customFields: {
              course_interested: "ui_ux",
            },
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should reject lead creation when select custom field option is invalid", async () => {
      await expect(
        createLead(
          orgAId,
          {
            firstName: "Ankit",
            customFields: {
              career_goal: "Developer",
              course_interested: "astrophysics", // not in configured options
            },
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should reject lead creation when multiselect custom field option is invalid", async () => {
      await expect(
        createLead(
          orgAId,
          {
            firstName: "Sneha",
            customFields: {
              career_goal: "Developer",
              preferred_shifts: ["morning", "midnight_shift"], // 'midnight_shift' invalid
            },
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("2. Lead Retrieval & Details", () => {
    it("should retrieve lead by ID with assigned user and custom field values", async () => {
      const created = await createLead(
        orgAId,
        {
          firstName: "Amit",
          lastName: "Patel",
          email: "amit@example.com",
          source: "meta_ads",
          status: "contacted",
          assignedToUserId: user1Id,
          customFields: {
            career_goal: "Cloud Architect",
          },
        },
        testDb
      );

      const fetched = await getLeadById(orgAId, created.id, testDb);
      expect(fetched.id).toBe(created.id);
      expect(fetched.firstName).toBe("Amit");
      expect(fetched.source).toBe("meta_ads");
      expect(fetched.status).toBe("contacted");
      expect(fetched.assignedToUser?.name).toBe("User Alpha");
      expect(fetched.customFields?.career_goal).toBe("Cloud Architect");
    });

    it("should throw NotFoundError for non-existent lead ID", async () => {
      await expect(
        getLeadById(orgAId, "non-existent-id", testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("3. Lead Updating", () => {
    it("should update standard lead fields and custom fields", async () => {
      const created = await createLead(
        orgAId,
        {
          firstName: "Vikram",
          status: "new",
          source: "walk_in",
          customFields: { career_goal: "Junior Dev" },
        },
        testDb
      );

      const updated = await updateLead(
        orgAId,
        created.id,
        {
          firstName: "Vikramaditya",
          status: "qualified",
          notes: "Spoke to candidate, highly qualified.",
          customFields: {
            career_goal: "Senior Full Stack Dev",
            course_interested: "full_stack",
          },
        },
        testDb
      );

      expect(updated.firstName).toBe("Vikramaditya");
      expect(updated.status).toBe("qualified");
      expect(updated.notes).toBe("Spoke to candidate, highly qualified.");
      expect(updated.customFields?.career_goal).toBe("Senior Full Stack Dev");
      expect(updated.customFields?.course_interested).toBe("full_stack");
    });
  });

  describe("4. Lead Archiving & Restoring", () => {
    it("should soft delete a lead by populating archivedAt", async () => {
      const lead = await createLead(
        orgAId,
        {
          firstName: "ArchiveMe",
          customFields: { career_goal: "Tester" },
        },
        testDb
      );

      const archived = await archiveLead(orgAId, lead.id, testDb);
      expect(archived.archivedAt).not.toBeNull();

      // Ensure it does not appear in default active leads query
      const activeLeads = await getLeads(orgAId, { archived: "false" }, testDb);
      expect(activeLeads.data.some((l) => l.id === lead.id)).toBe(false);

      // Ensure it appears in archived query
      const archivedLeads = await getLeads(orgAId, { archived: "true" }, testDb);
      expect(archivedLeads.data.some((l) => l.id === lead.id)).toBe(true);

      // Restore lead
      const restored = await restoreLead(orgAId, lead.id, testDb);
      expect(restored.archivedAt).toBeNull();

      // Ensure it is back in active leads
      const activeAfterRestore = await getLeads(orgAId, { archived: "false" }, testDb);
      expect(activeAfterRestore.data.some((l) => l.id === lead.id)).toBe(true);
    });
  });

  describe("5. Lead Search & Filtering", () => {
    beforeAll(async () => {
      // Seed identifiable leads for search & filter tests
      await createLead(
        orgAId,
        {
          firstName: "SearchOne",
          lastName: "TargetLastName",
          email: "findme@searchable.com",
          phone: "9112233445",
          source: "google_ads",
          status: "qualified",
          customFields: { career_goal: "Target 1" },
        },
        testDb
      );

      await createLead(
        orgAId,
        {
          firstName: "SearchTwo",
          lastName: "OtherName",
          email: "second@other.com",
          phone: "9988776655",
          source: "whatsapp",
          status: "lost",
          customFields: { career_goal: "Target 2" },
        },
        testDb
      );
    });

    it("should search by first name", async () => {
      const res = await getLeads(orgAId, { search: "SearchOne" }, testDb);
      expect(res.data.length).toBe(1);
      expect(res.data[0].firstName).toBe("SearchOne");
    });

    it("should search by email", async () => {
      const res = await getLeads(orgAId, { search: "findme@searchable.com" }, testDb);
      expect(res.data.length).toBe(1);
      expect(res.data[0].email).toBe("findme@searchable.com");
    });

    it("should search by phone", async () => {
      const res = await getLeads(orgAId, { search: "9112233445" }, testDb);
      expect(res.data.length).toBe(1);
      expect(res.data[0].phone).toBe("9112233445");
    });

    it("should filter by status", async () => {
      const res = await getLeads(orgAId, { status: "lost" }, testDb);
      expect(res.data.every((l) => l.status === "lost")).toBe(true);
    });

    it("should filter by source", async () => {
      const res = await getLeads(orgAId, { source: "whatsapp" }, testDb);
      expect(res.data.every((l) => l.source === "whatsapp")).toBe(true);
    });
  });

  describe("6. Pagination", () => {
    it("should return correct pagination metadata", async () => {
      const res = await getLeads(orgAId, { page: 1, pageSize: 2 }, testDb);
      expect(res.pagination.page).toBe(1);
      expect(res.pagination.pageSize).toBe(2);
      expect(res.pagination.total).toBeGreaterThanOrEqual(4);
      expect(res.pagination.totalPages).toBe(Math.ceil(res.pagination.total / 2));
      expect(res.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("7. Multi-Tenant Isolation & Assignment Security", () => {
    it("should isolate leads between organizations", async () => {
      // Create lead in Org B
      const orgBLead = await createLead(
        orgBId,
        {
          firstName: "BetaProspect",
          source: "events",
          status: "new",
        },
        testDb
      );

      // Org A cannot get Org B's lead by ID
      await expect(
        getLeadById(orgAId, orgBLead.id, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org A's query does not contain Org B's lead
      const orgALeads = await getLeads(orgAId, undefined, testDb);
      expect(orgALeads.data.some((l) => l.id === orgBLead.id)).toBe(false);

      // Org A cannot update Org B's lead
      await expect(
        updateLead(orgAId, orgBLead.id, { firstName: "Hacked" }, testDb)
      ).rejects.toThrow(NotFoundError);

      // Org A cannot archive Org B's lead
      await expect(
        archiveLead(orgAId, orgBLead.id, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject assigning a lead to a user from another organization", async () => {
      // User 2 belongs to Org B, not Org A
      await expect(
        createLead(
          orgAId,
          {
            firstName: "CrossTenantLead",
            assignedToUserId: user2Id, // User from Org B!
            customFields: { career_goal: "Developer" },
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });
  });
});
