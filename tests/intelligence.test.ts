import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createPipeline, createStage } from "@/lib/services/pipeline.service";
import { createLead, updateLead, archiveLead } from "@/lib/services/lead.service";
import { createDeal } from "@/lib/services/deal.service";
import { createActivity } from "@/lib/services/activity.service";
import { createFollowUp, completeFollowUp } from "@/lib/services/follow-up.service";
import {
  evaluateLeadSignals,
  evaluateDealSignals,
  compareAttentionItems,
  getLeadHealth,
  getDealHealth,
  getOrganizationAttentionItems,
  getOrganizationAttentionSummary,
  type MinimalActivity,
  type MinimalFollowUp,
} from "@/lib/services/crm-health.service";
import { isHighValueDeal } from "@/lib/intelligence/config";
import { SIGNAL_CATALOG } from "@/lib/intelligence/signal-registry";
import { NotFoundError } from "@/lib/errors";

describe("Milestone 2.10A — CRM Health, Aging & Needs-Attention Intelligence Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let pipelineAId: string;
  let stageA1Id: string;
  let pipelineBId: string;
  let stageB1Id: string;

  beforeAll(async () => {
    // 1. Initialize in-memory PostgreSQL instance with PGlite
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
        name: "Alice Advisor",
        email: "alice@orga.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "Bob Boundary",
        email: "bob@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Org A & Org B
    const orgA = await createOrganization(
      { name: "Alpha Intelligence Corp", slug: "alpha-intel", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Independent LLC", slug: "beta-indep", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Create Pipeline & Stages in Org A
    const pipeA = await createPipeline(
      orgAId,
      { name: "Standard Pipeline", description: "Default pipeline" },
      testDb
    );
    pipelineAId = pipeA.id;

    const sA1 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Lead Qualification", displayOrder: 1 },
      testDb
    );
    stageA1Id = sA1.id;

    await createStage(
      orgAId,
      pipelineAId,
      { name: "Proposal Review", displayOrder: 2 },
      testDb
    );

    // 6. Create Pipeline & Stage in Org B
    const pipeB = await createPipeline(
      orgBId,
      { name: "Org B Pipeline", description: "Org B pipeline" },
      testDb
    );
    pipelineBId = pipeB.id;

    const sB1 = await createStage(
      orgBId,
      pipelineBId,
      { name: "Org B Discovery", displayOrder: 1 },
      testDb
    );
    stageB1Id = sB1.id;
  });

  describe("1. Pure Signal Evaluation & Rules", () => {
    it("should return empty signals for a healthy lead with recent activity and upcoming follow-up", () => {
      const now = new Date();
      const mockLead = {
        id: "lead-1",
        organizationId: "org-1",
        firstName: "Sarah",
        lastName: "Connor",
        status: "contacted",
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000), // 2h ago
        updatedAt: now,
        archivedAt: null,
      };

      const mockActivity: MinimalActivity = {
        id: "act-1",
        type: "call",
        createdAt: new Date(now.getTime() - 1 * 3600 * 1000), // 1h ago
      };

      const mockFollowUp: MinimalFollowUp = {
        id: "fu-1",
        title: "Send Brochure",
        dueDate: new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10), // tomorrow
        status: "pending",
      };

      const signals = evaluateLeadSignals(
        mockLead,
        [mockActivity],
        [mockFollowUp],
        now
      );

      expect(signals).toHaveLength(0);
    });

    it("should detect new_lead_no_contact when lead is new and older than 24h with no activity", () => {
      const now = new Date();
      const mockLead = {
        id: "lead-2",
        organizationId: "org-1",
        firstName: "Kyle",
        lastName: "Reese",
        status: "new",
        createdAt: new Date(now.getTime() - 25 * 3600 * 1000), // 25 hours ago
        updatedAt: now,
        archivedAt: null,
      };

      const signals = evaluateLeadSignals(
        mockLead,
        [],
        [],
        now
      );

      expect(signals.map((s) => s.signalType)).toContain("new_lead_no_contact");
      const signal = signals.find((s) => s.signalType === "new_lead_no_contact");
      expect(signal?.severity).toBe("low");
      expect(signal?.recommendedAction).toBe(
        SIGNAL_CATALOG.new_lead_no_contact.buildRecommendedAction({})
      );
    });

    it("should detect qualified_lead_no_next_action when lead is qualified without upcoming follow-ups", () => {
      const now = new Date();
      const mockLead = {
        id: "lead-3",
        organizationId: "org-1",
        firstName: "John",
        lastName: "Connor",
        status: "qualified",
        createdAt: new Date(now.getTime() - 48 * 3600 * 1000),
        updatedAt: now,
        archivedAt: null,
      };

      const mockActivity: MinimalActivity = {
        id: "act-2",
        type: "meeting",
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
      };

      const signals = evaluateLeadSignals(
        mockLead,
        [mockActivity],
        [],
        now
      );

      expect(signals.map((s) => s.signalType)).toContain("qualified_lead_no_next_action");
      expect(signals.map((s) => s.signalType)).not.toContain("stale_lead");
    });

    it("should detect overdue_lead_follow_up with high severity", () => {
      const now = new Date();
      const mockLead = {
        id: "lead-4",
        organizationId: "org-1",
        firstName: "Miles",
        lastName: "Dyson",
        status: "contacted",
        createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
        updatedAt: now,
        archivedAt: null,
      };

      const overdueFollowUp: MinimalFollowUp = {
        id: "fu-2",
        title: "Follow-up discussion",
        dueDate: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10), // 2 days ago
        status: "pending",
      };

      const signals = evaluateLeadSignals(
        mockLead,
        [],
        [overdueFollowUp],
        now
      );

      expect(signals.map((s) => s.signalType)).toContain("overdue_lead_follow_up");
      const item = signals.find((s) => s.signalType === "overdue_lead_follow_up");
      expect(item?.severity).toBe("high");
    });

    it("should detect stale_lead when last activity was older than 7 days", () => {
      const now = new Date();
      const mockLead = {
        id: "lead-5",
        organizationId: "org-1",
        firstName: "Marcus",
        lastName: "Wright",
        status: "contacted",
        createdAt: new Date(now.getTime() - 20 * 24 * 3600 * 1000),
        updatedAt: now,
        archivedAt: null,
      };

      const oldActivity: MinimalActivity = {
        id: "act-old",
        type: "note",
        createdAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000), // 10 days ago (> 7 days)
      };

      const signals = evaluateLeadSignals(
        mockLead,
        [oldActivity],
        [],
        now
      );

      expect(signals.map((s) => s.signalType)).toContain("stale_lead");
    });

    it("should NOT generate signals for converted or lost leads", () => {
      const now = new Date();
      const convertedLead = {
        id: "lead-conv",
        organizationId: "org-1",
        firstName: "Converted",
        lastName: "User",
        status: "converted",
        createdAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
        updatedAt: now,
        archivedAt: null,
      };

      const signals = evaluateLeadSignals(
        convertedLead,
        [],
        [],
        now
      );

      expect(signals).toHaveLength(0);
    });
  });

  describe("2. Deal Signal Rules & Intelligence", () => {
    it("should detect deal_no_next_action on open deal with no upcoming follow-up", () => {
      const now = new Date();
      const mockDeal = {
        id: "deal-1",
        organizationId: "org-1",
        name: "Enterprise Cloud Contract",
        value: 20000,
        currency: "USD",
        status: "open",
        expectedCloseDate: null as Date | null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };

      const recentActivity: MinimalActivity = {
        id: "act-recent",
        type: "meeting",
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
      };

      const signals = evaluateDealSignals(
        mockDeal,
        [recentActivity],
        [],
        now
      );

      expect(signals.map((s) => s.signalType)).toContain("deal_no_next_action");
      expect(signals.map((s) => s.signalType)).not.toContain("stale_deal");
    });

    it("should detect high_value_stale_deal with high severity when value exceeds threshold and activity is stale", () => {
      const now = new Date();
      const mockDeal = {
        id: "deal-hv",
        organizationId: "org-1",
        name: "Global Defense System",
        value: 250000, // > USD 50,000 threshold
        currency: "USD",
        status: "open",
        expectedCloseDate: null as Date | null,
        createdAt: new Date(now.getTime() - 20 * 24 * 3600 * 1000),
        updatedAt: now,
        archivedAt: null,
      };

      const oldActivity: MinimalActivity = {
        id: "act-old-deal",
        type: "call",
        createdAt: new Date(now.getTime() - 9 * 24 * 3600 * 1000), // 9 days ago
      };

      const signals = evaluateDealSignals(
        mockDeal,
        [oldActivity],
        [],
        now
      );

      const types = signals.map((s) => s.signalType);
      expect(types).toContain("high_value_stale_deal");
      // high_value_stale_deal supersedes stale_deal for elevated severity
      const hvSignal = signals.find((s) => s.signalType === "high_value_stale_deal");
      expect(hvSignal?.severity).toBe("high");
      expect(hvSignal?.description).toMatch(/2[0-9,]+000/);
    });

    it("should detect approaching_expected_close and expected_close_without_next_action", () => {
      const now = new Date();
      const expectedClose = new Date(now.getTime() + 4 * 24 * 3600 * 1000); // 4 days from now (< 7 days)

      const mockDeal = {
        id: "deal-close",
        organizationId: "org-1",
        name: "Security Audit Package",
        value: 10000,
        currency: "USD",
        status: "open",
        expectedCloseDate: expectedClose,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };

      const recentActivity: MinimalActivity = {
        id: "act-deal-recent",
        type: "note",
        createdAt: now,
      };

      // Case A: Without upcoming follow-up -> expected_close_without_next_action should fire
      const signalsWithoutAction = evaluateDealSignals(
        mockDeal,
        [recentActivity],
        [],
        now
      );

      expect(signalsWithoutAction.map((s) => s.signalType)).toContain(
        "expected_close_without_next_action"
      );
      const compoundSignal = signalsWithoutAction.find(
        (s) => s.signalType === "expected_close_without_next_action"
      );
      expect(compoundSignal?.severity).toBe("high");

      // Case B: With upcoming follow-up scheduled -> approaching_expected_close should fire
      const mockUpcomingFollowUp: MinimalFollowUp = {
        id: "fu-deal-up",
        title: "Closing call",
        dueDate: new Date(now.getTime() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        status: "pending",
      };

      const signalsWithAction = evaluateDealSignals(
        mockDeal,
        [recentActivity],
        [mockUpcomingFollowUp],
        now
      );

      expect(signalsWithAction.map((s) => s.signalType)).toContain(
        "approaching_expected_close"
      );
    });

    it("should NOT generate signals for won or lost deals", () => {
      const now = new Date();
      const wonDeal = {
        id: "deal-won",
        organizationId: "org-1",
        name: "Closed Contract",
        value: 1000000,
        currency: "USD",
        status: "won",
        expectedCloseDate: new Date(now.getTime() - 10 * 24 * 3600 * 1000),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };

      const signals = evaluateDealSignals(
        wonDeal,
        [],
        [],
        now
      );

      expect(signals).toHaveLength(0);
    });

    it("should respect currency-aware thresholds without converting or confusing currencies", () => {
      expect(isHighValueDeal(300000, "INR")).toBe(false);
      expect(isHighValueDeal(600000, "INR")).toBe(true);
      expect(isHighValueDeal(40000, "USD")).toBe(false);
      expect(isHighValueDeal(60000, "USD")).toBe(true);
    });
  });

  describe("3. Deterministic Ranking & Severity Sorting", () => {
    it("should sort critical before high, high before medium, and medium before low", () => {
      const itemLow = {
        id: "1",
        organizationId: "org",
        entityType: "lead" as const,
        entityId: "lead-1",
        entityName: "Test Lead",
        signalType: "lead_stuck_in_stage" as const,
        severity: "low" as const,
        title: "Stuck in Stage",
        description: "Desc",
        recommendedAction: "Action",
        detectedAt: new Date(),
        metadata: {},
        link: "/leads/lead-1",
      };
      const itemMed = {
        ...itemLow,
        id: "2",
        signalType: "stale_lead" as const,
        severity: "medium" as const,
      };
      const itemHigh = {
        ...itemLow,
        id: "3",
        signalType: "overdue_lead_follow_up" as const,
        severity: "high" as const,
      };
      const itemCrit = {
        ...itemLow,
        id: "4",
        signalType: "overdue_lead_follow_up" as const,
        severity: "critical" as const,
      };

      const sorted = [itemMed, itemLow, itemCrit, itemHigh].sort(compareAttentionItems);

      expect(sorted.map((s) => s.severity)).toEqual([
        "critical",
        "high",
        "medium",
        "low",
      ]);
    });
  });

  describe("4. End-to-End Service Tests with Database", () => {
    it("should return healthy status for freshly created lead with upcoming follow-up", async () => {
      const lead = await createLead(
        orgAId,
        {
          firstName: "Diana",
          lastName: "Prince",
          email: "diana@themyscira.com",
          source: "referral",
          assignedToUserId: userAId,
        },
        testDb
      );

      // Create upcoming follow-up
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
      await createFollowUp(
        orgAId,
        userAId,
        lead.id,
        {
          title: "Follow up call",
          dueDate: tomorrow,
          assignedToUserId: userAId,
        },
        testDb
      );

      const health = await getLeadHealth(orgAId, lead.id, testDb);
      expect(health.entityId).toBe(lead.id);
      expect(health.healthState).toBe("healthy");
      expect(health.signals).toHaveLength(0);
      expect(health.recommendedAction).toBeNull();
    });

    it("should dynamically detect and clear signals for a realistic Deal lifecycle", async () => {
      // 1. Create open deal in Org A
      const deal = await createDeal(
        orgAId,
        {
          name: "Acme Megadeal",
          value: 75000, // USD 75,000 (high value)
          currency: "USD",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          ownerUserId: userAId,
        },
        testDb
      );

      // 2. Initial health: Has no upcoming follow-up -> should have deal_no_next_action
      const initialHealth = await getDealHealth(orgAId, deal.id, testDb);
      expect(initialHealth.healthState).toBe("needs_attention");
      const signalTypes = initialHealth.signals.map((i) => i.signalType);
      expect(signalTypes).toContain("deal_no_next_action");

      // 3. Add an upcoming follow-up
      const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      await createFollowUp(
        orgAId,
        userAId,
        deal.id,
        {
          title: "Contract review call",
          dueDate: nextWeek,
          assignedToUserId: userAId,
        },
        testDb
      );

      // 4. Check health again: deal_no_next_action should disappear!
      const afterFollowUpHealth = await getDealHealth(orgAId, deal.id, testDb);
      expect(
        afterFollowUpHealth.signals.some((i) => i.signalType === "deal_no_next_action")
      ).toBe(false);

      // 5. Create an overdue follow-up on this deal
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const overdueFu = await createFollowUp(
        orgAId,
        userAId,
        deal.id,
        {
          title: "Urgent check-in",
          dueDate: yesterday,
          assignedToUserId: userAId,
        },
        testDb
      );

      const overdueHealth = await getDealHealth(orgAId, deal.id, testDb);
      expect(
        overdueHealth.signals.some((i) => i.signalType === "overdue_deal_follow_up")
      ).toBe(true);
      expect(overdueHealth.healthState).toBe("at_risk");

      // 6. Complete the overdue follow-up -> should disappear!
      await completeFollowUp(orgAId, overdueFu.id, testDb);

      const resolvedHealth = await getDealHealth(orgAId, deal.id, testDb);
      expect(
        resolvedHealth.signals.some((i) => i.signalType === "overdue_deal_follow_up")
      ).toBe(false);
    });

    it("should dynamically detect and clear signals for a realistic Lead lifecycle", async () => {
      // 1. Create a lead and set status to 'qualified'
      const lead = await createLead(
        orgAId,
        {
          firstName: "Bruce",
          lastName: "Wayne",
          email: "bruce@wayne-enterprises.com",
          source: "website",
          assignedToUserId: userAId,
        },
        testDb
      );
      await updateLead(orgAId, lead.id, { status: "qualified" }, testDb);

      // 2. Health check: should flag qualified_lead_no_next_action
      const healthBefore = await getLeadHealth(orgAId, lead.id, testDb);
      expect(
        healthBefore.signals.some(
          (i) => i.signalType === "qualified_lead_no_next_action"
        )
      ).toBe(true);

      // 3. Create a follow-up for this qualified lead
      const inTwoDays = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      await createFollowUp(
        orgAId,
        userAId,
        lead.id,
        {
          title: "Pitch Deck Presentation",
          dueDate: inTwoDays,
          assignedToUserId: userAId,
        },
        testDb
      );

      // 4. Health check: qualified_lead_no_next_action should be cleared!
      const healthAfter = await getLeadHealth(orgAId, lead.id, testDb);
      expect(
        healthAfter.signals.some(
          (i) => i.signalType === "qualified_lead_no_next_action"
        )
      ).toBe(false);
    });

    it("should enforce strict Tenant Isolation: Org A cannot view Org B intelligence", async () => {
      // Create a deal in Org B
      const dealB = await createDeal(
        orgBId,
        {
          name: "Secret Org B Operation",
          value: 100000,
          currency: "USD",
          pipelineId: pipelineBId,
          pipelineStageId: stageB1Id,
          ownerUserId: userBId,
        },
        testDb
      );

      // Org A attempting to inspect dealB must throw NotFoundError
      await expect(getDealHealth(orgAId, dealB.id, testDb)).rejects.toThrow(NotFoundError);

      // Batch query for Org A must NEVER contain any records from Org B
      const orgAAttention = await getOrganizationAttentionItems(orgAId, {}, testDb);
      const foundOrgB = orgAAttention.items.some((item) => item.entityId === dealB.id);
      expect(foundOrgB).toBe(false);
    });

    it("should support batch queries with filtering, pagination, and summary counts", async () => {
      const summary = await getOrganizationAttentionSummary(orgAId, undefined, testDb);
      expect(summary).toBeDefined();
      expect(typeof summary.total).toBe("number");
      expect(typeof summary.critical).toBe("number");
      expect(typeof summary.high).toBe("number");
      expect(typeof summary.medium).toBe("number");
      expect(typeof summary.low).toBe("number");
      expect(summary.total).toBe(
        summary.critical + summary.high + summary.medium + summary.low
      );

      // Test filtered pagination
      const pageResult = await getOrganizationAttentionItems(
        orgAId,
        {
          pageSize: 2,
          page: 1,
        },
        testDb
      );

      expect(pageResult.items.length).toBeLessThanOrEqual(2);
      expect(pageResult.pageSize).toBe(2);
      expect(pageResult.page).toBe(1);
      expect(typeof pageResult.total).toBe("number");
      expect(typeof pageResult.totalPages).toBe("number");
    });

    it("should not generate attention items for archived leads or deals", async () => {
      // Create lead in Org A
      const lead = await createLead(
        orgAId,
        {
          firstName: "Archived",
          lastName: "Target",
          email: "archived@test.com",
          source: "website",
        },
        testDb
      );

      // Archive it
      await archiveLead(orgAId, lead.id, testDb);

      // Directly requesting health should return healthy with no attention items
      const health = await getLeadHealth(orgAId, lead.id, testDb);
      expect(health.healthState).toBe("healthy");
      expect(health.signals).toHaveLength(0);

      // Should not appear in batch attention query
      const batch = await getOrganizationAttentionItems(orgAId, {}, testDb);
      expect(batch.items.some((i) => i.entityId === lead.id)).toBe(false);
    });

    it("should return healthy status for an open deal with recent activity and scheduled follow-up", async () => {
      const deal = await createDeal(
        orgAId,
        {
          name: "Healthy Tech Renewal",
          value: 30000,
          currency: "USD",
          pipelineId: pipelineAId,
          pipelineStageId: stageA1Id,
          ownerUserId: userAId,
        },
        testDb
      );

      // Create recent activity
      await createActivity(
        orgAId,
        userAId,
        {
          entityType: "deal",
          entityId: deal.id,
          type: "meeting",
          title: "Quarterly Review Call",
        },
        testDb
      );

      // Create upcoming follow-up
      const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      await createFollowUp(
        orgAId,
        userAId,
        deal.id,
        {
          title: "Send Renewal Proposal",
          dueDate: nextWeek,
        },
        testDb
      );

      const health = await getDealHealth(orgAId, deal.id, testDb);
      expect(health.entityId).toBe(deal.id);
      expect(health.healthState).toBe("healthy");
      expect(health.signals).toHaveLength(0);
      expect(health.highestSeverity).toBeNull();
      expect(health.recommendedAction).toBeNull();
    });

    it("should correctly combine multiple signals and prioritize highest severity", () => {
      const now = new Date();
      const expectedClose = new Date(now.getTime() + 2 * 24 * 3600 * 1000); // 2 days -> critical approaching close without action

      const mockDeal = {
        id: "deal-multi",
        organizationId: "org-1",
        name: "High Stakes Deal",
        value: 300000, // high value
        currency: "USD",
        status: "open",
        expectedCloseDate: expectedClose,
        createdAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
        updatedAt: now,
        archivedAt: null,
      };

      const oldActivity: MinimalActivity = {
        id: "act-old",
        type: "note",
        createdAt: new Date(now.getTime() - 15 * 24 * 3600 * 1000), // 15 days inactive
      };

      // Deal has:
      // 1. High value stale (15 days inactive, $300k > $50k) -> high
      // 2. Expected close in 2 days without next action -> critical
      const signals = evaluateDealSignals(
        mockDeal,
        [oldActivity],
        [],
        now
      );

      const types = signals.map((s) => s.signalType);
      expect(types).toContain("high_value_stale_deal");
      expect(types).toContain("expected_close_without_next_action");

      // Sorted ranking should place critical item first
      signals.sort(compareAttentionItems);
      expect(signals[0].severity).toBe("critical");
      expect(signals[0].signalType).toBe("expected_close_without_next_action");
    });

    it("should ensure batch intelligence does not produce duplicate items", async () => {
      const batch = await getOrganizationAttentionItems(orgAId, { pageSize: 100 }, testDb);
      const itemIds = batch.items.map((i) => i.id);
      const uniqueIds = new Set(itemIds);
      expect(itemIds.length).toBe(uniqueIds.size);
    });
  });
});
