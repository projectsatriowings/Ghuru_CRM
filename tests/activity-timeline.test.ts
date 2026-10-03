import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createLead, convertLead } from "@/lib/services/lead.service";
import { createContact, getContactById, updateContact, archiveContact } from "@/lib/services/contact.service";
import { createCompany, getCompanyById, updateCompany, archiveCompany } from "@/lib/services/company.service";
import { createFollowUp, getLeadFollowUps } from "@/lib/services/follow-up.service";
import {
  createActivity,
  getActivityById,
  getActivitiesForEntity,
  getLeadActivities,
  updateActivity,
  completeActivity,
  cancelActivity,
} from "@/lib/services/activity.service";
import { createActivitySchema } from "@/lib/validations/activity";
import { NotFoundError } from "@/lib/errors";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { eq, and } from "drizzle-orm";

describe("Milestone 2.6 — Unified CRM Activity & Timeline Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let leadAId: string;
  let contactAId: string;
  let companyAId: string;
  let leadBId: string;
  let contactBId: string;
  let companyBId: string;

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
      "0007_shiny_hellcat.sql",
      "0008_neat_terrax.sql",
      "0009_talented_bastion.sql",
      "0010_amused_gambit.sql",
      "0011_chubby_pete_wisdom.sql",
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

    // 4. Create two isolated organizations
    const orgA = await createOrganization(
      { name: "Alpha Corp", slug: "alpha-corp", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Corp", slug: "beta-corp", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Seed test entities in Org A
    const leadA = await createLead(
      orgAId,
      { firstName: "LeadAlice", lastName: "One", email: "lead1@test.com" },
      testDb
    );
    leadAId = leadA.id;

    const contactA = await createContact(
      orgAId,
      { firstName: "ContactAlice", lastName: "One", email: "contact1@test.com" },
      testDb
    );
    contactAId = contactA.id;

    const companyA = await createCompany(
      orgAId,
      { name: "Acme Org A Corp", website: "https://acme-a.com" },
      testDb
    );
    companyAId = companyA.id;

    // 6. Seed test entities in Org B
    const leadB = await createLead(
      orgBId,
      { firstName: "LeadBob", lastName: "Two", email: "lead2@test.com" },
      testDb
    );
    leadBId = leadB.id;

    const contactB = await createContact(
      orgBId,
      { firstName: "ContactBob", lastName: "Two", email: "contact2@test.com" },
      testDb
    );
    contactBId = contactB.id;

    const companyB = await createCompany(
      orgBId,
      { name: "Beta Org B Corp", website: "https://beta-b.com" },
      testDb
    );
    companyBId = companyB.id;
  });

  // 1. Create Lead activity
  it("1. should create an activity for a Lead", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "lead",
        entityId: leadAId,
        type: "call",
        title: "Initial Discovery Call",
        description: "Discussed requirements with Alice.",
      },
      testDb
    );

    expect(act).toBeDefined();
    expect(act.id).toBeDefined();
    expect(act.organizationId).toBe(orgAId);
    expect(act.entityType).toBe("lead");
    expect(act.entityId).toBe(leadAId);
    expect(act.leadId).toBe(leadAId);
    expect(act.type).toBe("call");
    expect(act.title).toBe("Initial Discovery Call");
    expect(act.status).toBe("completed");
  });

  // 2. Create Contact activity
  it("2. should create an activity for a Contact", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "contact",
        entityId: contactAId,
        type: "email",
        title: "Sent Contract Draft",
        description: "Sent contract draft via email to contact.",
      },
      testDb
    );

    expect(act).toBeDefined();
    expect(act.id).toBeDefined();
    expect(act.organizationId).toBe(orgAId);
    expect(act.entityType).toBe("contact");
    expect(act.entityId).toBe(contactAId);
    expect(act.leadId).toBeNull();
    expect(act.type).toBe("email");
    expect(act.title).toBe("Sent Contract Draft");
  });

  // 3. Create Company activity
  it("3. should create an activity for a Company", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "company",
        entityId: companyAId,
        type: "meeting",
        title: "Executive QBR Meeting",
        description: "Met with stakeholders for quarterly review.",
      },
      testDb
    );

    expect(act).toBeDefined();
    expect(act.id).toBeDefined();
    expect(act.organizationId).toBe(orgAId);
    expect(act.entityType).toBe("company");
    expect(act.entityId).toBe(companyAId);
    expect(act.leadId).toBeNull();
    expect(act.type).toBe("meeting");
    expect(act.title).toBe("Executive QBR Meeting");
  });

  // 4. Get activity by ID
  it("4. should retrieve an activity by ID with creator details", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "contact",
        entityId: contactAId,
        type: "note",
        title: "Contact Background Note",
        description: "Contact previously worked at Initech.",
      },
      testDb
    );

    const fetched = await getActivityById(orgAId, act.id, testDb);
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(act.id);
    expect(fetched.title).toBe("Contact Background Note");
    expect(fetched.createdByUser).toBeDefined();
    expect(fetched.createdByUser?.id).toBe(userAId);
    expect(fetched.createdByUser?.name).toBe("Alice Admin");
  });

  // 5. Get entity timeline
  it("5. should retrieve entity timeline for contact and company", async () => {
    const contactTimeline = await getActivitiesForEntity(
      orgAId,
      "contact",
      contactAId,
      {},
      testDb
    );
    expect(contactTimeline.data.length).toBeGreaterThanOrEqual(2);
    expect(contactTimeline.data.every((a) => a.entityType === "contact" && a.entityId === contactAId)).toBe(true);

    const companyTimeline = await getActivitiesForEntity(
      orgAId,
      "company",
      companyAId,
      {},
      testDb
    );
    expect(companyTimeline.data.length).toBeGreaterThanOrEqual(1);
    expect(companyTimeline.data.every((a) => a.entityType === "company" && a.entityId === companyAId)).toBe(true);
  });

  // 6. Timeline chronological ordering (newest first)
  it("6. should return activities ordered newest first (descending createdAt)", async () => {
    // Insert three sequential activities with explicit timestamps
    const now = Date.now();
    await testDb.insert(schema.activities).values([
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: leadAId,
        leadId: leadAId,
        type: "note",
        title: "Chronological 1",
        createdByUserId: userAId,
        createdAt: new Date(now - 3000),
        updatedAt: new Date(now - 3000),
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: leadAId,
        leadId: leadAId,
        type: "note",
        title: "Chronological 2",
        createdByUserId: userAId,
        createdAt: new Date(now - 2000),
        updatedAt: new Date(now - 2000),
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: leadAId,
        leadId: leadAId,
        type: "note",
        title: "Chronological 3",
        createdByUserId: userAId,
        createdAt: new Date(now - 1000),
        updatedAt: new Date(now - 1000),
      },
    ]);

    const result = await getActivitiesForEntity(
      orgAId,
      "lead",
      leadAId,
      { pageSize: 50 },
      testDb
    );

    const chronoItems = result.data.filter((a) => a.title.startsWith("Chronological "));
    expect(chronoItems.length).toBe(3);
    expect(chronoItems[0].title).toBe("Chronological 3");
    expect(chronoItems[1].title).toBe("Chronological 2");
    expect(chronoItems[2].title).toBe("Chronological 1");
  });

  // 7. Pagination
  it("7. should correctly paginate entity activities", async () => {
    const page1 = await getActivitiesForEntity(
      orgAId,
      "lead",
      leadAId,
      { page: 1, pageSize: 2 },
      testDb
    );
    expect(page1.data.length).toBe(2);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.pageSize).toBe(2);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(4);
    expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(2);

    const page2 = await getActivitiesForEntity(
      orgAId,
      "lead",
      leadAId,
      { page: 2, pageSize: 2 },
      testDb
    );
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
    expect(page2.pagination.page).toBe(2);
    // Page 2 items must not overlap with page 1 items
    expect(page1.data[0].id).not.toBe(page2.data[0].id);
  });

  // 8. Activity type validation
  it("8. should validate and accept all 10 supported activity types, rejecting invalid types", async () => {
    const validTypes = [
      "call",
      "email",
      "meeting",
      "note",
      "task",
      "follow_up",
      "status_change",
      "assignment_change",
      "conversion",
      "relationship_change",
    ] as const;

    for (const t of validTypes) {
      const act = await createActivity(
        orgAId,
        userAId,
        {
          entityType: "contact",
          entityId: contactAId,
          type: t,
          title: `Testing type ${t}`,
        },
        testDb
      );
      expect(act.type).toBe(t);
    }

    // Invalid type rejected by Zod schema
    const invalidResult = createActivitySchema.safeParse({
      entityType: "contact",
      entityId: contactAId,
      type: "pigeon_mail",
      title: "Invalid Type Activity",
    });
    expect(invalidResult.success).toBe(false);
  });

  // 9. Activity status validation
  it("9. should support pending, completed, and cancelled statuses with default completed", async () => {
    // Default status is completed
    const defaultAct = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "company",
        entityId: companyAId,
        type: "note",
        title: "Default status test",
      },
      testDb
    );
    expect(defaultAct.status).toBe("completed");

    // Explicit pending status
    const pendingAct = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "company",
        entityId: companyAId,
        type: "task",
        title: "Send NDA agreement",
        status: "pending",
        dueAt: new Date(Date.now() + 86400000),
      },
      testDb
    );
    expect(pendingAct.status).toBe("pending");
    expect(pendingAct.dueAt).toBeDefined();
  });

  // 10. Update activity
  it("10. should update activity title, description, type, and assigned user", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "lead",
        entityId: leadAId,
        type: "task",
        title: "Initial Title",
        description: "Initial description",
        status: "pending",
      },
      testDb
    );

    const updated = await updateActivity(
      orgAId,
      act.id,
      {
        title: "Updated Task Title",
        description: "Updated task description",
        type: "call",
        assignedToUserId: userAId,
      },
      testDb
    );

    expect(updated.title).toBe("Updated Task Title");
    expect(updated.description).toBe("Updated task description");
    expect(updated.type).toBe("call");
    expect(updated.assignedToUserId).toBe(userAId);
  });

  // 11. Complete activity
  it("11. should complete a pending activity and record completedAt timestamp", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "contact",
        entityId: contactAId,
        type: "task",
        title: "Call contact back",
        status: "pending",
      },
      testDb
    );
    expect(act.status).toBe("pending");
    expect(act.completedAt).toBeNull();

    const completed = await completeActivity(orgAId, act.id, testDb);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeDefined();
    expect(new Date(completed.completedAt!).getTime()).toBeLessThanOrEqual(Date.now());
  });

  // 12. Cancel activity
  it("12. should cancel an activity and mark status as cancelled", async () => {
    const act = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "company",
        entityId: companyAId,
        type: "task",
        title: "Schedule demo",
        status: "pending",
      },
      testDb
    );

    const cancelled = await cancelActivity(orgAId, act.id, testDb);
    expect(cancelled.status).toBe("cancelled");
  });

  // 13. Tenant isolation
  it("13. should strictly isolate activities between organizations", async () => {
    // Create activity in Org A
    const actA = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "company",
        entityId: companyAId,
        type: "note",
        title: "Org A Secret Note",
      },
      testDb
    );

    // Create activity in Org B
    const actB = await createActivity(
      orgBId,
      userBId,
      {
        entityType: "company",
        entityId: companyBId,
        type: "note",
        title: "Org B Secret Note",
      },
      testDb
    );

    // Org A cannot see Org B's activity
    await expect(getActivityById(orgAId, actB.id, testDb)).rejects.toThrow(NotFoundError);

    // Org B cannot see Org A's activity
    await expect(getActivityById(orgBId, actA.id, testDb)).rejects.toThrow(NotFoundError);

    // Org B cannot update or complete Org A's activity
    await expect(updateActivity(orgBId, actA.id, { title: "Hacked" }, testDb)).rejects.toThrow(NotFoundError);
    await expect(completeActivity(orgBId, actA.id, testDb)).rejects.toThrow(NotFoundError);

    // Timeline for companyA in Org B context returns empty or fails entity validation
    await expect(
      getActivitiesForEntity(orgBId, "company", companyAId, {}, testDb)
    ).rejects.toThrow(NotFoundError);
  });

  // 14. Cross-tenant entity rejection
  it("14. should reject activity creation against entities from another organization", async () => {
    // Org A tries to create activity for Org B's Lead
    await expect(
      createActivity(
        orgAId,
        userAId,
        {
          entityType: "lead",
          entityId: leadBId,
          type: "note",
          title: "Malicious lead activity",
        },
        testDb
      )
    ).rejects.toThrow(NotFoundError);

    // Org A tries to create activity for Org B's Contact
    await expect(
      createActivity(
        orgAId,
        userAId,
        {
          entityType: "contact",
          entityId: contactBId,
          type: "note",
          title: "Malicious contact activity",
        },
        testDb
      )
    ).rejects.toThrow(NotFoundError);

    // Org A tries to create activity for Org B's Company
    await expect(
      createActivity(
        orgAId,
        userAId,
        {
          entityType: "company",
          entityId: companyBId,
          type: "note",
          title: "Malicious company activity",
        },
        testDb
      )
    ).rejects.toThrow(NotFoundError);
  });

  // 15. RBAC view
  it("15. should verify activities.view permission exists and is granted to Org Admin", async () => {
    expect(INITIAL_PERMISSIONS.some((p) => p.key === "activities.view")).toBe(true);

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

    const keys = rolePerms.map((rp: { key: string }) => rp.key);
    expect(keys).toContain("activities.view");
  });

  // 16. RBAC create
  it("16. should verify activities.create permission exists and is granted to Org Admin", async () => {
    expect(INITIAL_PERMISSIONS.some((p) => p.key === "activities.create")).toBe(true);

    const [adminRole] = await testDb
      .select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.organizationId, orgAId),
          eq(schema.roles.name, DEFAULT_ORG_ADMIN_ROLE)
        )
      );

    const rolePerms = await testDb
      .select({ key: schema.permissions.key })
      .from(schema.rolePermissions)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id)
      )
      .where(eq(schema.rolePermissions.roleId, adminRole.id));

    const keys = rolePerms.map((rp: { key: string }) => rp.key);
    expect(keys).toContain("activities.create");
  });

  // 17. RBAC update
  it("17. should verify activities.update and activities.delete permissions exist", async () => {
    expect(INITIAL_PERMISSIONS.some((p) => p.key === "activities.update")).toBe(true);
    expect(INITIAL_PERMISSIONS.some((p) => p.key === "activities.delete")).toBe(true);

    const [adminRole] = await testDb
      .select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.organizationId, orgAId),
          eq(schema.roles.name, DEFAULT_ORG_ADMIN_ROLE)
        )
      );

    const rolePerms = await testDb
      .select({ key: schema.permissions.key })
      .from(schema.rolePermissions)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id)
      )
      .where(eq(schema.rolePermissions.roleId, adminRole.id));

    const keys = rolePerms.map((rp: { key: string }) => rp.key);
    expect(keys).toContain("activities.update");
    expect(keys).toContain("activities.delete");
  });

  // 18. Existing Lead activity behavior
  it("18. should preserve legacy createActivity signature and getLeadActivities query", async () => {
    // Legacy 4-param signature: createActivity(orgId, userId, leadId, input)
    const act = await createActivity(
      orgAId,
      userAId,
      leadAId,
      {
        type: "note",
        title: "Legacy signature note",
        description: "Created via legacy 4-parameter call signature.",
      },
      testDb
    );

    expect(act).toBeDefined();
    expect(act.leadId).toBe(leadAId);
    expect(act.entityType).toBe("lead");
    expect(act.entityId).toBe(leadAId);

    // Legacy getLeadActivities helper
    const leadActs = await getLeadActivities(orgAId, leadAId, testDb);
    expect(leadActs.length).toBeGreaterThanOrEqual(1);
    expect(leadActs.some((a) => a.title === "Legacy signature note")).toBe(true);
  });

  // 19. Existing Contact CRUD still works
  it("19. should verify Contact CRUD operations continue to function normally", async () => {
    const contact = await createContact(
      orgAId,
      { firstName: "CRUD", lastName: "Contact", email: "crud@example.com" },
      testDb
    );
    expect(contact.id).toBeDefined();

    const fetched = await getContactById(orgAId, contact.id, testDb);
    expect(fetched.firstName).toBe("CRUD");

    const updated = await updateContact(
      orgAId,
      contact.id,
      { firstName: "CRUD-Updated" },
      testDb
    );
    expect(updated.firstName).toBe("CRUD-Updated");

    const archived = await archiveContact(orgAId, contact.id, testDb);
    expect(archived.archivedAt).toBeDefined();
  });

  // 20. Existing Company CRUD still works
  it("20. should verify Company CRUD operations continue to function normally", async () => {
    const company = await createCompany(
      orgAId,
      { name: "CRUD Co", website: "https://crudco.com" },
      testDb
    );
    expect(company.id).toBeDefined();

    const fetched = await getCompanyById(orgAId, company.id, testDb);
    expect(fetched.name).toBe("CRUD Co");

    const updated = await updateCompany(
      orgAId,
      company.id,
      { name: "CRUD Co Updated" },
      testDb
    );
    expect(updated.name).toBe("CRUD Co Updated");

    const archived = await archiveCompany(orgAId, company.id, testDb);
    expect(archived.archivedAt).toBeDefined();
  });

  // 21. Existing Follow-ups still work
  it("21. should verify Follow-up creation and retrieval still work seamlessly", async () => {
    const fu = await createFollowUp(
      orgAId,
      userAId,
      leadAId,
      {
        title: "Follow up about project timeline",
        dueDate: new Date(Date.now() + 3600000).toISOString(),
        description: "Follow up about project timeline",
      },
      testDb
    );
    expect(fu.id).toBeDefined();
    expect(fu.leadId).toBe(leadAId);

    const followUps = await getLeadFollowUps(orgAId, leadAId, undefined, testDb);
    expect(followUps.length).toBeGreaterThanOrEqual(1);
    expect(followUps.some((f) => f.id === fu.id)).toBe(true);
  });

  // 22. Existing Lead → Contact conversion still works
  it("22. should successfully convert a lead into a contact", async () => {
    const convertibleLead = await createLead(
      orgAId,
      { firstName: "Convertible", lastName: "Lead", email: "convertible@example.com" },
      testDb
    );

    const conversionResult = await convertLead(
      orgAId,
      convertibleLead.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    expect(conversionResult.lead.status).toBe("converted");
    expect(conversionResult.contactId).toBeDefined();
  });

  // 23. Conversion activity appears in Lead timeline
  it("23. should show the lead conversion audit activity naturally in the Lead timeline", async () => {
    const leadToConvert = await createLead(
      orgAId,
      { firstName: "AuditTimeline", lastName: "User", email: "audit@example.com" },
      testDb
    );

    await convertLead(
      orgAId,
      leadToConvert.id,
      userAId,
      { mode: "create_new" },
      testDb
    );

    // Retrieve timeline for this lead
    const timeline = await getActivitiesForEntity(
      orgAId,
      "lead",
      leadToConvert.id,
      {},
      testDb
    );

    const convActivity = timeline.data.find(
      (a) => a.type === "note" && a.title.includes("Lead converted to contact")
    );

    expect(convActivity).toBeDefined();
    expect(convActivity?.entityType).toBe("lead");
    expect(convActivity?.entityId).toBe(leadToConvert.id);
    expect(convActivity?.description).toContain("AuditTimeline User");
  });

  // 24. Archived entity behavior
  it("24. should reject activity creation against an archived entity", async () => {
    const leadToArchive = await createLead(
      orgAId,
      { firstName: "Archive", lastName: "Test", email: "archive-lead@test.com" },
      testDb
    );

    // Soft delete/archive the lead
    await testDb
      .update(schema.leads)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.leads.organizationId, orgAId), eq(schema.leads.id, leadToArchive.id)));

    await expect(
      createActivity(
        orgAId,
        userAId,
        {
          entityType: "lead",
          entityId: leadToArchive.id,
          type: "note",
          title: "Activity on archived lead",
        },
        testDb
      )
    ).rejects.toThrow("Cannot create activity for an archived lead");
  });

  // 25. Relationship activity behavior
  it("25. should support logging relationship_change activities for CRM audit history", async () => {
    const relAct = await createActivity(
      orgAId,
      userAId,
      {
        entityType: "contact",
        entityId: contactAId,
        type: "relationship_change",
        title: "Contact linked to Company",
        description: `Contact ${contactAId} was associated with Acme Org A Corp.`,
      },
      testDb
    );

    expect(relAct).toBeDefined();
    expect(relAct.type).toBe("relationship_change");
    expect(relAct.title).toBe("Contact linked to Company");
  });
});
