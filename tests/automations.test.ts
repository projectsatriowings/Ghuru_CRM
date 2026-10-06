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
import { createLead, updateLead } from "@/lib/services/lead.service";
import {
  createDeal,
  updateDeal,
} from "@/lib/services/deal.service";
import {
  createAutomation,
  getAutomations,
  getAutomationById,
  updateAutomation,
  archiveAutomation,
  restoreAutomation,
  getAutomationExecutions,
} from "@/lib/services/automation.service";
import {
  evaluateOperator,
  evaluateConditionGroups,
} from "@/lib/automation/condition-evaluator";
import { getLeadActivities } from "@/lib/services/activity.service";
import { getDealFollowUps } from "@/lib/services/follow-up.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("Milestone 2.9 — Automation Engine Foundation Test Suite", () => {
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

    // 2. Read and apply DDL migrations 0000 to 0013
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

    // 3. Seed users
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
        name: "Bob Foreign",
        email: "bob@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Seed organizations
    const orgA = await createOrganization(
      { name: "Acme Corp Org A", slug: `acme-a-${Date.now()}`, userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Corp Org B", slug: `beta-b-${Date.now()}`, userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Seed pipelines and stages
    const pipeA = await createPipeline(
      orgAId,
      { name: "Sales Pipeline A" },
      testDb
    );
    pipelineAId = pipeA.id;

    const sA1 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Discovery", displayOrder: 1 },
      testDb
    );
    stageA1Id = sA1.id;

    const sA2 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Proposal", displayOrder: 2 },
      testDb
    );
    stageA2Id = sA2.id;

    const pipeB = await createPipeline(
      orgBId,
      { name: "Sales Pipeline B" },
      testDb
    );
    pipelineBId = pipeB.id;

    const sB1 = await createStage(
      orgBId,
      pipelineBId,
      { name: "Initial B", displayOrder: 1 },
      testDb
    );
    stageB1Id = sB1.id;
  });

  // =========================================================================
  // 1. PURE OPERATOR & CONDITION EVALUATOR UNIT TESTS
  // =========================================================================
  describe("Condition Evaluator & Safe Operators", () => {
    it("evaluates equals operator with numbers, strings, and booleans", () => {
      expect(evaluateOperator("equals", "Open", "open")).toBe(true);
      expect(evaluateOperator("equals", 100, 100)).toBe(true);
      expect(evaluateOperator("equals", "100", 100)).toBe(true);
      expect(evaluateOperator("equals", true, true)).toBe(true);
      expect(evaluateOperator("equals", "true", true)).toBe(true);
      expect(evaluateOperator("equals", "abc", "def")).toBe(false);
    });

    it("evaluates numeric comparisons (greater_than, less_than)", () => {
      expect(evaluateOperator("greater_than", 150000, 100000)).toBe(true);
      expect(evaluateOperator("greater_than", 100000, 100000)).toBe(false);
      expect(evaluateOperator("greater_than_or_equal", 100000, 100000)).toBe(true);
      expect(evaluateOperator("less_than", 50, 100)).toBe(true);
      expect(evaluateOperator("less_than_or_equal", 50, 50)).toBe(true);
    });

    it("evaluates string operators (contains, starts_with, ends_with)", () => {
      expect(evaluateOperator("contains", "Acme Industries", "indus")).toBe(true);
      expect(evaluateOperator("not_contains", "Acme Industries", "xyz")).toBe(true);
      expect(evaluateOperator("starts_with", "Proposal Sent", "prop")).toBe(true);
      expect(evaluateOperator("ends_with", "Annual Report.pdf", ".pdf")).toBe(true);
    });

    it("evaluates is_empty and is_not_empty", () => {
      expect(evaluateOperator("is_empty", null, null)).toBe(true);
      expect(evaluateOperator("is_empty", "", null)).toBe(true);
      expect(evaluateOperator("is_empty", "   ", null)).toBe(true);
      expect(evaluateOperator("is_empty", [], null)).toBe(true);
      expect(evaluateOperator("is_empty", "hello", null)).toBe(false);
      expect(evaluateOperator("is_not_empty", "hello", null)).toBe(true);
    });

    it("evaluates condition groups with AND within group and OR across groups", () => {
      const entity = {
        value: 120000,
        status: "open",
        source: "referral",
      };

      // Group 1: value > 100000 AND status = open -> Should pass
      const report1 = evaluateConditionGroups(
        [
          {
            conditions: [
              { field: "value", operator: "greater_than", value: 100000 },
              { field: "status", operator: "equals", value: "open" },
            ],
          },
        ],
        entity
      );
      expect(report1.passed).toBe(true);

      // Group 1: value > 100000 AND status = won (fails)
      // Group 2: source = referral (passes)
      // Total (OR) -> passes!
      const report2 = evaluateConditionGroups(
        [
          {
            conditions: [
              { field: "value", operator: "greater_than", value: 100000 },
              { field: "status", operator: "equals", value: "won" },
            ],
          },
          {
            conditions: [
              { field: "source", operator: "equals", value: "referral" },
            ],
          },
        ],
        entity
      );
      expect(report2.passed).toBe(true);
      expect(report2.groupResults[0].passed).toBe(false);
      expect(report2.groupResults[1].passed).toBe(true);
    });
  });

  // =========================================================================
  // 2. AUTOMATION CRUD & VALIDATION TESTS
  // =========================================================================
  describe("Automation CRUD & Validation", () => {
    let createdAutoId: string;

    it("creates a new automation definition with validation", async () => {
      const auto = await createAutomation(
        orgAId,
        {
          name: "High Value Deal Proposal",
          description: "Follow up when deal enters proposal",
          active: true,
          entityType: "deal",
          triggerType: "pipeline_stage_changed",
          conditions: [
            {
              conditions: [
                { field: "value", operator: "greater_than", value: 100000 },
              ],
            },
          ],
          actions: [
            {
              type: "create_follow_up",
              params: {
                title: "Prepare detailed proposal deck",
                dueDate: "+2d",
                assignedToUserId: userAId,
              },
            },
          ],
        },
        testDb,
        userAId
      );

      expect(auto.id).toBeDefined();
      expect(auto.name).toBe("High Value Deal Proposal");
      expect(auto.active).toBe(true);
      expect(auto.entityType).toBe("deal");
      expect(auto.triggerType).toBe("pipeline_stage_changed");
      expect(auto.actions.length).toBe(1);
      createdAutoId = auto.id;
    });

    it("retrieves automation by ID with execution stats", async () => {
      const auto = await getAutomationById(orgAId, createdAutoId, testDb);
      expect(auto.id).toBe(createdAutoId);
      expect(auto.executionStats?.total).toBe(0);
    });

    it("retrieves paginated list of automations with filtering", async () => {
      const result = await getAutomations(
        orgAId,
        { entityType: "deal", status: "active" },
        testDb
      );
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data.some((a) => a.id === createdAutoId)).toBe(true);
    });

    it("updates automation definition and toggles active status", async () => {
      const updated = await updateAutomation(
        orgAId,
        createdAutoId,
        {
          name: "Updated High Value Rule",
          active: false,
        },
        testDb
      );
      expect(updated.name).toBe("Updated High Value Rule");
      expect(updated.active).toBe(false);

      // Re-enable
      await updateAutomation(orgAId, createdAutoId, { active: true }, testDb);
    });

    it("archives and restores an automation", async () => {
      const archived = await archiveAutomation(orgAId, createdAutoId, testDb);
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.active).toBe(false);

      // Should not be in active list
      const activeList = await getAutomations(
        orgAId,
        { status: "active" },
        testDb
      );
      expect(activeList.data.some((a) => a.id === createdAutoId)).toBe(false);

      // Restore
      const restored = await restoreAutomation(orgAId, createdAutoId, testDb);
      expect(restored.archivedAt).toBeNull();
    });

    it("rejects incompatible entity and trigger combinations", async () => {
      await expect(
        createAutomation(
          orgAId,
          {
            name: "Invalid Rule",
            entityType: "contact",
            triggerType: "pipeline_stage_changed", // Contact does not have pipeline stages
            actions: [
              {
                type: "create_activity",
                params: { type: "note", title: "Test" },
              },
            ],
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("rejects cross-tenant user assignment in actions", async () => {
      await expect(
        createAutomation(
          orgAId,
          {
            name: "Cross tenant user rule",
            entityType: "deal",
            triggerType: "entity_created",
            actions: [
              {
                type: "assign_owner",
                params: {
                  targetUserId: userBId, // userB is only in orgB!
                },
              },
            ],
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });

    it("rejects cross-tenant pipeline references in actions", async () => {
      await expect(
        createAutomation(
          orgAId,
          {
            name: "Cross tenant stage rule",
            entityType: "deal",
            triggerType: "entity_created",
            actions: [
              {
                type: "move_pipeline_stage",
                params: {
                  pipelineId: pipelineBId, // Belongs to Org B!
                  stageId: stageB1Id,
                },
              },
            ],
          },
          testDb
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // 3. TENANT ISOLATION TESTS
  // =========================================================================
  describe("Tenant Isolation", () => {
    let orgAAutoId: string;

    beforeAll(async () => {
      const auto = await createAutomation(
        orgAId,
        {
          name: "Org A Automation",
          entityType: "deal",
          triggerType: "entity_created",
          actions: [
            {
              type: "create_activity",
              params: { type: "note", title: "Org A Note" },
            },
          ],
        },
        testDb
      );
      orgAAutoId = auto.id;
    });

    it("prevents Org B from retrieving Org A automation", async () => {
      await expect(
        getAutomationById(orgBId, orgAAutoId, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("prevents Org B from updating Org A automation", async () => {
      await expect(
        updateAutomation(orgBId, orgAAutoId, { name: "Hacked" }, testDb)
      ).rejects.toThrow(NotFoundError);
    });

    it("prevents Org B from archiving Org A automation", async () => {
      await expect(
        archiveAutomation(orgBId, orgAAutoId, testDb)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // 4. REAL INTEGRATION TEST 1: DEAL STAGE CHANGE → FOLLOW-UP AUTOMATION
  // =========================================================================
  describe("Integration Test 1: Real Deal Stage Change Automation", () => {
    it("executes follow-up creation when Deal moves to Proposal and Value > 100000", async () => {
      // 1. Create Deal automation in Org A
      await createAutomation(
        orgAId,
        {
          name: "High Value Proposal Follow-up",
          entityType: "deal",
          triggerType: "pipeline_stage_changed",
          conditions: [
            {
              conditions: [
                { field: "value", operator: "greater_than", value: 100000 },
              ],
            },
          ],
          actions: [
            {
              type: "create_follow_up",
              params: {
                title: "Call CEO regarding Proposal Deck",
                dueDate: "+2d",
                assignedToUserId: "current_owner",
              },
            },
          ],
        },
        testDb
      );

      // 2. Create Deal with value 250,000 in Stage Discovery (A1)
      const deal = await createDeal(
        orgAId,
        {
          name: "Big Enterprise Contract",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          value: 250000,
          ownerUserId: userAId,
        },
        testDb,
        userAId
      );
      // 3. Move Deal from Discovery (A1) to Proposal (A2)
      await updateDeal(
        orgAId,
        deal.id,
        {
          pipelineStageId: stageA2Id,
        },
        testDb,
        userAId
      );

      // 4. Verify that normal follow-up was automatically created!
      const followUps = await getDealFollowUps(orgAId, deal.id, testDb);
      expect(followUps.length).toBe(1);
      expect(followUps[0].title).toBe("Call CEO regarding Proposal Deck");
      expect(followUps[0].assignedToUserId).toBe(userAId);

      // 5. Verify execution history logged success
      const execLogs = await getAutomationExecutions(
        orgAId,
        { entityId: deal.id },
        testDb
      );
      expect(execLogs.data.length).toBeGreaterThanOrEqual(1);
      const matchedExec = execLogs.data.find((e) => e.status === "completed");
      expect(matchedExec).toBeDefined();
      expect(matchedExec?.metadata?.actionsExecuted?.[0]?.status).toBe("success");
    });

    it("does NOT create follow-up when Deal value is <= 100000 (condition mismatch)", async () => {
      // 1. Create smaller Deal (50,000)
      const smallDeal = await createDeal(
        orgAId,
        {
          name: "Small Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          value: 50000,
          ownerUserId: userAId,
        },
        testDb,
        userAId
      );

      // 2. Move to Proposal (A2)
      await updateDeal(
        orgAId,
        smallDeal.id,
        {
          pipelineStageId: stageA2Id,
        },
        testDb,
        userAId
      );

      // 3. Verify NO follow-up was created
      const followUps = await getDealFollowUps(orgAId, smallDeal.id, testDb);
      expect(followUps.length).toBe(0);

      // 4. Verify execution log recorded status 'skipped'
      const execLogs = await getAutomationExecutions(
        orgAId,
        { entityId: smallDeal.id },
        testDb
      );
      const skippedLog = execLogs.data.find(
        (e) => e.eventType === "pipeline_stage_changed" && e.status === "skipped"
      );
      expect(skippedLog).toBeDefined();
      expect(skippedLog?.metadata?.skippedReason).toBe("Conditions did not match");
    });
  });

  // =========================================================================
  // 5. REAL INTEGRATION TEST 2: LEAD STATUS CHANGE → ACTIVITY AUTOMATION
  // =========================================================================
  describe("Integration Test 2: Real Lead Status Change Automation", () => {
    it("creates a normal Activity record when Lead status changes to Qualified", async () => {
      // 1. Create Lead automation in Org A
      await createAutomation(
        orgAId,
        {
          name: "Qualified Lead Activity Creator",
          entityType: "lead",
          triggerType: "entity_status_changed",
          conditions: [
            {
              conditions: [
                { field: "status", operator: "equals", value: "qualified" },
              ],
            },
          ],
          actions: [
            {
              type: "create_activity",
              params: {
                type: "task",
                title: "Conduct Qualification Review Call",
                description: "Lead marked qualified, schedule review call immediately.",
                assignedToUserId: "current_owner",
              },
            },
          ],
        },
        testDb
      );

      // 2. Create Lead in Org A with initial status 'new'
      const lead = await createLead(
        orgAId,
        {
          firstName: "John",
          lastName: "Prospect",
          status: "new",
          source: "website",
          assignedToUserId: userAId,
        },
        testDb
      );

      // 3. Update Lead status to 'qualified'
      await updateLead(
        orgAId,
        lead.id,
        {
          status: "qualified",
        },
        testDb
      );

      // 4. Verify normal Activity record was created and appears on Lead Timeline
      const activities = await getLeadActivities(orgAId, lead.id, testDb);
      const autoActivity = activities.find(
        (a) => a.title === "Conduct Qualification Review Call"
      );
      expect(autoActivity).toBeDefined();
      expect(autoActivity?.type).toBe("task");
      expect(autoActivity?.description).toContain(
        "Lead marked qualified, schedule review call immediately."
      );
    });
  });

  // =========================================================================
  // 6. LOOP & RECURSION DEPTH PROTECTION TEST
  // =========================================================================
  describe("Loop Protection & Recursion Depth Guard", () => {
    it("safely halts execution when automations trigger in a cycle without infinite recursion", async () => {
      // Create Automation 1: When deal stage changes -> update status to 'won'
      const auto1 = await createAutomation(
        orgAId,
        {
          name: "Loop Auto 1 (Stage -> Status Won)",
          entityType: "deal",
          triggerType: "pipeline_stage_changed",
          actions: [
            {
              type: "update_field",
              params: {
                field: "status",
                value: "won",
              },
            },
          ],
        },
        testDb
      );

      // Create Automation 2: When deal status changes -> move stage to Proposal (stageA2Id)
      const auto2 = await createAutomation(
        orgAId,
        {
          name: "Loop Auto 2 (Status Won -> Move Stage)",
          entityType: "deal",
          triggerType: "entity_status_changed",
          actions: [
            {
              type: "move_pipeline_stage",
              params: {
                pipelineId: pipelineAId,
                stageId: stageA2Id,
              },
            },
          ],
        },
        testDb
      );

      // Create a test deal in Stage 1
      const deal = await createDeal(
        orgAId,
        {
          name: "Loop Test Deal",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          status: "open",
        },
        testDb,
        userAId
      );

      // Trigger the loop by moving to Stage 2
      const summary = await updateDeal(
        orgAId,
        deal.id,
        {
          pipelineStageId: stageA2Id,
        },
        testDb,
        userAId
      );

      // Verify the process completed cleanly without infinite loop / stack overflow!
      expect(summary.id).toBe(deal.id);

      // Verify executions recorded with depth protection / recursion protection
      const executions = await getAutomationExecutions(
        orgAId,
        { entityId: deal.id },
        testDb
      );

      expect(executions.data.length).toBeGreaterThan(0);
      // Either loop skip or max depth halt
      const hasLoopOrDepthSkip = executions.data.some(
        (e) =>
          e.status === "skipped" &&
          (String(e.errorMessage).includes("Recursion") ||
            String(e.metadata?.skippedReason).includes("Recursion"))
      );
      expect(hasLoopOrDepthSkip).toBe(true);

      // Clean up the loop automations so they don't affect other tests
      await archiveAutomation(orgAId, auto1.id, testDb);
      await archiveAutomation(orgAId, auto2.id, testDb);
    });
  });
});
