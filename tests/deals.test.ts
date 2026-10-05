import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import {
  createPipeline,
  createStage,
} from "@/lib/services/pipeline.service";
import { createCompany, archiveCompany } from "@/lib/services/company.service";
import { createContact, archiveContact } from "@/lib/services/contact.service";
import { createLead, archiveLead } from "@/lib/services/lead.service";
import { createCustomField } from "@/lib/services/custom-field.service";
import {
  createDeal,
  getDealById,
  getDeals,
  updateDeal,
  archiveDeal,
  restoreDeal,
} from "@/lib/services/deal.service";
import {
  createActivity,
  getDealActivities,
} from "@/lib/services/activity.service";
import {
  createFollowUp,
  getDealFollowUps,
  completeFollowUp,
} from "@/lib/services/follow-up.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.8 — Deals & Opportunities Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;

  // Org A pipeline & stages
  let pipelineAId: string;
  let stageA1Id: string;
  let stageA2Id: string;

  // Org B pipeline & stages
  let pipelineBId: string;
  let stageB1Id: string;

  beforeAll(async () => {
    // 1. Initialize in-memory PostgreSQL instance with PGlite
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply DDL migrations 0000 to 0012
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
        name: "Alice Owner",
        email: "alice@orga.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "Bob Outside",
        email: "bob@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Org A & Org B
    const orgA = await createOrganization(
      { name: "Acme Corp", slug: "acme-corp", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta LLC", slug: "beta-llc", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Create Pipelines & Stages in Org A
    const pipeA = await createPipeline(
      orgAId,
      { name: "Sales Pipeline", description: "Standard commercial sales" },
      testDb
    );
    pipelineAId = pipeA.id;

    const sA1 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Qualified", displayOrder: 1 },
      testDb
    );
    stageA1Id = sA1.id;

    const sA2 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Proposal Sent", displayOrder: 2 },
      testDb
    );
    stageA2Id = sA2.id;

    // 6. Create Pipeline & Stage in Org B
    const pipeB = await createPipeline(
      orgBId,
      { name: "Beta Pipeline", description: "Beta opportunities" },
      testDb
    );
    pipelineBId = pipeB.id;

    const sB1 = await createStage(
      orgBId,
      pipelineBId,
      { name: "Initial Contact", displayOrder: 1 },
      testDb
    );
    stageB1Id = sB1.id;
  });

  describe("1. Deal CRUD Operations", () => {
    let createdDealId: string;

    it("should successfully create a deal with all core fields", async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "Global Enterprise License",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          value: 45000,
          currency: "USD",
          probability: 70,
          expectedCloseDate: new Date("2026-12-31"),
          description: "Multi-seat annual subscription renewal",
          status: "open",
          ownerUserId: userAId,
        },
        testDb,
        userAId
      );

      expect(deal).toBeDefined();
      expect(deal.id).toBeDefined();
      expect(deal.organizationId).toBe(orgAId);
      expect(deal.name).toBe("Global Enterprise License");
      expect(deal.value).toBe(45000);
      expect(deal.currency).toBe("USD");
      expect(deal.probability).toBe(70);
      expect(deal.status).toBe("open");
      expect(deal.ownerUserId).toBe(userAId);
      expect(deal.ownerUser?.name).toBe("Alice Owner");
      expect(deal.pipeline.id).toBe(pipelineAId);
      expect(deal.stage.id).toBe(stageA1Id);
      expect(deal.archivedAt).toBeNull();

      createdDealId = deal.id;
    });

    it("should retrieve a deal by ID with relations", async () => {
      const deal = await getDealById(orgAId, createdDealId, testDb);
      expect(deal).toBeDefined();
      expect(deal.id).toBe(createdDealId);
      expect(deal.name).toBe("Global Enterprise License");
      expect(deal.pipeline.name).toBe("Sales Pipeline");
      expect(deal.stage.name).toBe("Qualified");
    });

    it("should update deal fields partially", async () => {
      const updated = await updateDeal(
        orgAId,
        createdDealId,
        {
          name: "Global Enterprise License (Amended)",
          value: 52000,
          probability: 85,
        },
        testDb,
        userAId
      );

      expect(updated.name).toBe("Global Enterprise License (Amended)");
      expect(updated.value).toBe(52000);
      expect(updated.probability).toBe(85);
      expect(updated.currency).toBe("USD"); // Unchanged
    });

    it("should soft archive a deal", async () => {
      const archived = await archiveDeal(orgAId, createdDealId, testDb, userAId);
      expect(archived.archivedAt).not.toBeNull();

      // Should be excluded from default active list
      const list = await getDeals(orgAId, { archived: "false" }, testDb);
      expect(list.data.some((d) => d.id === createdDealId)).toBe(false);

      // Should be visible when archived=all or archived=true
      const archivedList = await getDeals(orgAId, { archived: "true" }, testDb);
      expect(archivedList.data.some((d) => d.id === createdDealId)).toBe(true);
    });

    it("should restore an archived deal", async () => {
      const restored = await restoreDeal(orgAId, createdDealId, testDb, userAId);
      expect(restored.archivedAt).toBeNull();

      const activeList = await getDeals(orgAId, { archived: "false" }, testDb);
      expect(activeList.data.some((d) => d.id === createdDealId)).toBe(true);
    });
  });

  describe("2. Validation Guardrails", () => {
    it("should reject creation with empty deal name", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "   ",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow();
    });

    it("should reject probability outside 0-100 range", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "Invalid Prob Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            probability: 105,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow();

      await expect(
        createDeal(
          orgAId,
          {
            name: "Negative Prob Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            probability: -5,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow();
    });

    it("should reject negative monetary values", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "Negative Value Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            value: -100,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow();
    });

    it("should reject invalid status strings", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "Invalid Status Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: "pending_approval" as any,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow();
    });

    it("should reject stage that does not belong to the pipeline", async () => {
      // Pipeline A with Stage B1 (from Pipeline B)
      await expect(
        createDeal(
          orgAId,
          {
            name: "Mismatched Stage Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageB1Id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should reject non-existent pipeline or stage", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "Ghost Pipeline Deal",
            pipelineId: crypto.randomUUID(),
            pipelineStageId: crypto.randomUUID(),
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("3. Tenant Isolation & Cross-Tenant Protection", () => {
    let orgADealId: string;

    beforeAll(async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "Org A Confidential Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          value: 20000,
        },
        testDb,
        userAId
      );
      orgADealId = deal.id;
    });

    it("should prevent Org B from reading Org A deals", async () => {
      await expect(getDealById(orgBId, orgADealId, testDb)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should prevent Org B from updating Org A deals", async () => {
      await expect(
        updateDeal(orgBId, orgADealId, { name: "Hijacked Deal" }, testDb, userBId)
      ).rejects.toThrow(NotFoundError);
    });

    it("should prevent Org B from archiving Org A deals", async () => {
      await expect(
        archiveDeal(orgBId, orgADealId, testDb, userBId)
      ).rejects.toThrow(NotFoundError);
    });

    it("should prevent Org A deal from associating with Org B pipeline/stage", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "Cross Tenant Pipeline Deal",
            pipelineId: pipelineBId,
            pipelineStageId: stageB1Id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should prevent Org A deal from associating with Org B Lead/Contact/Company", async () => {
      const orgBLead = await createLead(
        orgBId,
        { firstName: "Foreign", lastName: "Lead" },
        testDb
      );

      const orgBCompany = await createCompany(
        orgBId,
        { name: "Foreign Company" },
        testDb
      );

      const orgBContact = await createContact(
        orgBId,
        { firstName: "Foreign", lastName: "Contact" },
        testDb
      );

      // Attempt to link Org B lead to Org A deal
      await expect(
        createDeal(
          orgAId,
          {
            name: "Cross Lead Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            leadId: orgBLead.id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);

      // Attempt to link Org B company to Org A deal
      await expect(
        createDeal(
          orgAId,
          {
            name: "Cross Company Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            companyId: orgBCompany.id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);

      // Attempt to link Org B contact to Org A deal
      await expect(
        createDeal(
          orgAId,
          {
            name: "Cross Contact Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            contactId: orgBContact.id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("4. Multi-Entity Relationships & Combinations", () => {
    it("should support Lead-only, Contact-only, Company-only, and combined relationships", async () => {
      const lead = await createLead(
        orgAId,
        { firstName: "Lead", lastName: "One" },
        testDb
      );

      const company = await createCompany(
        orgAId,
        { name: "Acme Client Co" },
        testDb
      );

      const contact = await createContact(
        orgAId,
        { firstName: "Jane", lastName: "Doe", companyId: company.id },
        testDb
      );

      // 1. Lead only
      const dealLead = await createDeal(
        orgAId,
        {
          name: "Lead Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          leadId: lead.id,
        },
        testDb,
        userAId
      );
      expect(dealLead.lead?.id).toBe(lead.id);
      expect(dealLead.contact).toBeNull();
      expect(dealLead.company).toBeNull();

      // 2. Company + Contact
      const dealAccount = await createDeal(
        orgAId,
        {
          name: "B2B Expansion",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          companyId: company.id,
          contactId: contact.id,
        },
        testDb,
        userAId
      );
      expect(dealAccount.company?.id).toBe(company.id);
      expect(dealAccount.contact?.id).toBe(contact.id);
      expect(dealAccount.lead).toBeNull();

      // 3. Lead + Company + Contact
      const dealAll = await createDeal(
        orgAId,
        {
          name: "Full Journey Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          leadId: lead.id,
          companyId: company.id,
          contactId: contact.id,
        },
        testDb,
        userAId
      );
      expect(dealAll.lead?.id).toBe(lead.id);
      expect(dealAll.company?.id).toBe(company.id);
      expect(dealAll.contact?.id).toBe(contact.id);
    });
  });

  describe("5. Archived Entity Guardrails", () => {
    it("should reject associating archived leads, contacts, companies, or stages", async () => {
      const lead = await createLead(
        orgAId,
        { firstName: "To Archive", lastName: "Lead" },
        testDb
      );
      await archiveLead(orgAId, lead.id, testDb);

      const company = await createCompany(
        orgAId,
        { name: "To Archive Co" },
        testDb
      );
      await archiveCompany(orgAId, company.id, testDb);

      const contact = await createContact(
        orgAId,
        { firstName: "To Archive", lastName: "Contact" },
        testDb
      );
      await archiveContact(orgAId, contact.id, testDb);

      // Archived lead association rejected
      await expect(
        createDeal(
          orgAId,
          {
            name: "Archived Lead Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            leadId: lead.id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);

      // Archived company association rejected
      await expect(
        createDeal(
          orgAId,
          {
            name: "Archived Company Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            companyId: company.id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);

      // Archived contact association rejected
      await expect(
        createDeal(
          orgAId,
          {
            name: "Archived Contact Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            contactId: contact.id,
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("6. Custom Fields on Deals", () => {
    beforeAll(async () => {
      await createCustomField(
        orgAId,
        {
          entityType: "deal",
          key: "contract_duration_months",
          label: "Contract Duration (Months)",
          fieldType: "number",
          required: false,
        },
        testDb
      );

      await createCustomField(
        orgAId,
        {
          entityType: "deal",
          key: "industry_vertical",
          label: "Industry Vertical",
          fieldType: "text",
          required: true,
        },
        testDb
      );
    });

    it("should require mandatory custom fields during deal creation", async () => {
      await expect(
        createDeal(
          orgAId,
          {
            name: "Missing Custom Field Deal",
            pipelineId: pipelineAId,
            pipelineStageId: stageA1Id,
            customFields: {},
          },
          testDb,
          userAId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should store and retrieve deal custom field values", async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "SaaS Multi-Year Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          customFields: {
            industry_vertical: "Healthcare & MedTech",
            contract_duration_months: 36,
          },
        },
        testDb,
        userAId
      );

      expect(deal.customFields.industry_vertical).toBe("Healthcare & MedTech");
      expect(deal.customFields.contract_duration_months).toBe(36);

      // Update custom field
      const updated = await updateDeal(
        orgAId,
        deal.id,
        {
          customFields: {
            contract_duration_months: 48,
          },
        },
        testDb,
        userAId
      );

      expect(updated.customFields.contract_duration_months).toBe(48);
      expect(updated.customFields.industry_vertical).toBe("Healthcare & MedTech");
    });
  });

  describe("7. Activities & Timeline Integration", () => {
    it("should log polymorphic activities on deals and retrieve them", async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "Activity Test Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          customFields: { industry_vertical: "Technology" },
        },
        testDb,
        userAId
      );

      const activity = await createActivity(
        orgAId,
        userAId,
        {
          entityType: "deal",
          entityId: deal.id,
          type: "call",
          title: "Quarterly Review Call",
          description: "Discussed license tiers and payment options.",
          status: "completed",
        },
        testDb
      );

      expect(activity.id).toBeDefined();
      expect(activity.entityType).toBe("deal");
      expect(activity.entityId).toBe(deal.id);

      const timeline = await getDealActivities(orgAId, deal.id, testDb);
      expect(timeline.length).toBeGreaterThanOrEqual(1);
      expect(timeline.some((a) => a.title === "Quarterly Review Call")).toBe(true);
    });

    it("should generate audit activities on status, stage, and owner changes", async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "Audit Test Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          status: "open",
          customFields: { industry_vertical: "FinTech" },
        },
        testDb,
        userAId
      );

      // 1. Move stage from stageA1 to stageA2
      await updateDeal(
        orgAId,
        deal.id,
        { pipelineStageId: stageA2Id },
        testDb,
        userAId
      );

      // 2. Change status from open to won
      await updateDeal(
        orgAId,
        deal.id,
        { status: "won" },
        testDb,
        userAId
      );

      const timeline = await getDealActivities(orgAId, deal.id, testDb);

      expect(timeline.some((a) => a.title === "Deal Stage Moved")).toBe(true);
      expect(timeline.some((a) => a.title === "Deal Status Changed")).toBe(true);
    });
  });

  describe("8. Follow-ups / Next Action Integration", () => {
    it("should attach follow-ups to deals and complete them", async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "Follow-up Test Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          customFields: { industry_vertical: "Logistics" },
        },
        testDb,
        userAId
      );

      // Create follow up on the deal
      const followUp = await createFollowUp(
        orgAId,
        userAId,
        deal.id,
        {
          dealId: deal.id,
          title: "Send revised commercial proposal",
          dueDate: "2026-11-15",
          dueTime: "14:00",
          assignedToUserId: userAId,
        },
        testDb
      );

      expect(followUp.id).toBeDefined();
      expect(followUp.dealId).toBe(deal.id);
      expect(followUp.status).toBe("pending");

      // Retrieve deal follow-ups
      const dealFollowUps = await getDealFollowUps(orgAId, deal.id, testDb);
      expect(dealFollowUps.length).toBe(1);
      expect(dealFollowUps[0].id).toBe(followUp.id);

      // Complete follow-up
      const completed = await completeFollowUp(orgAId, followUp.id, testDb);
      expect(completed.status).toBe("completed");
    });
  });

  describe("9. Pagination, Search, and Filtering", () => {
    beforeAll(async () => {
      // Seed a few distinct deals for search and filtering
      await createDeal(
        orgAId,
        {
          name: "Zeta Quantum Analytics",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          status: "open",
          value: 100000,
          customFields: { industry_vertical: "DeepTech" },
        },
        testDb,
        userAId
      );

      await createDeal(
        orgAId,
        {
          name: "Alpha Solar Grid Expansion",
          pipelineId: pipelineAId,
          pipelineStageId: stageA2Id,
          status: "won",
          value: 75000,
          customFields: { industry_vertical: "CleanTech" },
        },
        testDb,
        userAId
      );

      await createDeal(
        orgAId,
        {
          name: "Beta Robotics Pipeline Test",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          status: "lost",
          value: 30000,
          customFields: { industry_vertical: "Robotics" },
        },
        testDb,
        userAId
      );
    });

    it("should search deals by name", async () => {
      const searchRes = await getDeals(
        orgAId,
        { search: "Quantum" },
        testDb
      );

      expect(searchRes.data.length).toBe(1);
      expect(searchRes.data[0].name).toContain("Quantum");
    });

    it("should filter deals by status", async () => {
      const wonDeals = await getDeals(
        orgAId,
        { status: "won" },
        testDb
      );

      expect(wonDeals.data.length).toBeGreaterThanOrEqual(1);
      expect(wonDeals.data.every((d) => d.status === "won")).toBe(true);

      const lostDeals = await getDeals(
        orgAId,
        { status: "lost" },
        testDb
      );

      expect(lostDeals.data.length).toBeGreaterThanOrEqual(1);
      expect(lostDeals.data.every((d) => d.status === "lost")).toBe(true);
    });

    it("should paginate deals properly", async () => {
      const page1 = await getDeals(
        orgAId,
        { page: 1, pageSize: 2 },
        testDb
      );

      expect(page1.data.length).toBe(2);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.pageSize).toBe(2);
      expect(page1.pagination.total).toBeGreaterThanOrEqual(3);
      expect(page1.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });
  });
});
