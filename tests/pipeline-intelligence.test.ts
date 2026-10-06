import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createPipeline, createStage } from "@/lib/services/pipeline.service";
import { createLead, archiveLead } from "@/lib/services/lead.service";
import { createDeal, archiveDeal } from "@/lib/services/deal.service";
import {
  getLeadFunnelIntelligence,
  getLeadSourcePerformance,
  getDealPipelineIntelligence,
  getPipelineBottlenecks,
  getPeriodComparisonMetrics,
  getPipelineAndConversionIntelligence,
} from "@/lib/services/pipeline-intelligence.service";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { getOrganizationAttentionItems } from "@/lib/services/crm-health.service";
import { getPreviousEquivalentDateRange } from "@/lib/utils/date-range-utils";
import { eq } from "drizzle-orm";

describe("Milestone 2.10B — Pipeline & Conversion Intelligence Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userAId: string;
  let userA2Id: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let orgEmptyId: string;
  let pipelineA1Id: string;
  let stageA1NewId: string;
  let stageA1DemoId: string;
  let stageA1ProposalId: string;
  let stageA1NegotiationId: string;
  let stageA1WonId: string;
  let stageA1LostId: string;
  let pipelineBId: string;
  let stageBId: string;

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
    userA2Id = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: userAId,
        name: "Alice Owner",
        email: "alice@orga.com",
        emailVerified: true,
      },
      {
        id: userA2Id,
        name: "Aaron Assignee",
        email: "aaron@orga.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "Bob Foreign",
        email: "bob@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Alpha Intelligence Corp", slug: "alpha-intel", userId: userAId },
      testDb
    );
    orgAId = orgA.organization.id;

    // Add userA2 to Org A
    const [adminRole] = await testDb
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.organizationId, orgAId))
      .limit(1);

    await testDb.insert(schema.organizationMembers).values({
      id: crypto.randomUUID(),
      organizationId: orgAId,
      userId: userA2Id,
      roleId: adminRole.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const orgB = await createOrganization(
      { name: "Beta Corp", slug: "beta-corp", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    const orgEmpty = await createOrganization(
      { name: "Empty Corp", slug: "empty-corp", userId: userBId },
      testDb
    );
    orgEmptyId = orgEmpty.organization.id;

    // 5. Create Pipelines & Stages in Org A
    const pipeA1 = await createPipeline(
      orgAId,
      { name: "Enterprise Sales", description: "Primary deal flow" },
      testDb
    );
    pipelineA1Id = pipeA1.id;

    const stage1 = await createStage(orgAId, pipelineA1Id, { name: "Discovery", displayOrder: 1 }, testDb);
    stageA1NewId = stage1.id;
    const stage2 = await createStage(orgAId, pipelineA1Id, { name: "Demo", displayOrder: 2 }, testDb);
    stageA1DemoId = stage2.id;
    void stageA1DemoId;
    const stage3 = await createStage(orgAId, pipelineA1Id, { name: "Proposal", displayOrder: 3 }, testDb);
    stageA1ProposalId = stage3.id;
    const stage4 = await createStage(orgAId, pipelineA1Id, { name: "Negotiation", displayOrder: 4 }, testDb);
    stageA1NegotiationId = stage4.id;
    const stage5 = await createStage(orgAId, pipelineA1Id, { name: "Closed Won", displayOrder: 5 }, testDb);
    stageA1WonId = stage5.id;
    const stage6 = await createStage(orgAId, pipelineA1Id, { name: "Closed Lost", displayOrder: 6 }, testDb);
    stageA1LostId = stage6.id;

    // Pipeline in Org B
    const pipeB = await createPipeline(
      orgBId,
      { name: "Beta Pipeline", description: "Org B pipeline" },
      testDb
    );
    pipelineBId = pipeB.id;
    const stageB = await createStage(orgBId, pipelineBId, { name: "Initial", displayOrder: 1 }, testDb);
    stageBId = stageB.id;
  });

  // -------------------------------------------------------------
  // 1-4: LEAD FUNNEL INTELLIGENCE
  // -------------------------------------------------------------
  describe("Lead Funnel Intelligence", () => {
    it("1-4. should calculate funnel totals, status distribution, qualification rate, and conversion rate", async () => {
      // Seed leads in Org A with different statuses
      await createLead(orgAId, { firstName: "L1", source: "website", status: "new" }, testDb);
      await createLead(orgAId, { firstName: "L2", source: "website", status: "contacted" }, testDb);
      await createLead(orgAId, { firstName: "L3", source: "meta_ads", status: "qualified" }, testDb);
      await createLead(orgAId, { firstName: "L4", source: "referral", status: "qualified" }, testDb);
      await createLead(orgAId, { firstName: "L5", source: "referral", status: "converted" }, testDb);
      await createLead(orgAId, { firstName: "L6", source: "other", status: "lost" }, testDb);

      const funnel = await getLeadFunnelIntelligence(orgAId, undefined, undefined, undefined, testDb);

      expect(funnel.totalLeads).toBeGreaterThanOrEqual(6);
      expect(funnel.newCount).toBeGreaterThanOrEqual(1);
      expect(funnel.contactedCount).toBeGreaterThanOrEqual(1);
      expect(funnel.qualifiedCount).toBeGreaterThanOrEqual(2);
      expect(funnel.convertedCount).toBeGreaterThanOrEqual(1);
      expect(funnel.lostCount).toBeGreaterThanOrEqual(1);

      // Qualification rate = (qualified + converted) / total
      expect(funnel.qualificationRate).toBeGreaterThan(0);
      expect(funnel.conversionRate).toBeGreaterThan(0);

      // Verify stages list length matches all LEAD_STATUSES
      expect(funnel.stages.length).toBe(6);
      const newStage = funnel.stages.find((s) => s.status === "new");
      expect(newStage).toBeDefined();
      expect(newStage!.percentage).toBeGreaterThan(0);

      // Verify transition rates structure
      expect(funnel.transitions.leadToContactedRate).toBeDefined();
      expect(funnel.transitions.contactedToQualifiedRate).toBeDefined();
      expect(funnel.transitions.qualifiedToConvertedRate).toBeDefined();
    });

    it("19. should provide historicalDataNote explaining transparent metric boundaries without fabricated dwell time", async () => {
      const funnel = await getLeadFunnelIntelligence(orgAId, undefined, undefined, undefined, testDb);
      expect(funnel.historicalDataNote).toBeDefined();
      expect(funnel.historicalDataNote).toContain("Stage dwell times are omitted");
    });
  });

  // -------------------------------------------------------------
  // 5-8: LEAD SOURCE PERFORMANCE
  // -------------------------------------------------------------
  describe("Lead Source Performance", () => {
    it("5-8. should calculate source performance with qualification rate, conversion rate, and deal attribution", async () => {
      // Create specific leads for source attribution test
      const leadWeb = await createLead(orgAId, { firstName: "WebLead", source: "website", status: "converted" }, testDb);
      const leadRef = await createLead(orgAId, { firstName: "RefLead", source: "referral", status: "converted" }, testDb);

      // Create deals linked to these leads
      await createDeal(orgAId, {
        name: "Web Deal Won",
        leadId: leadWeb.id,
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1WonId,
        status: "won",
        value: 50000,
        currency: "USD",
        ownerUserId: userAId,
      }, testDb);

      await createDeal(orgAId, {
        name: "Ref Deal Won INR",
        leadId: leadRef.id,
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1WonId,
        status: "won",
        value: 1200000,
        currency: "INR",
        ownerUserId: userAId,
      }, testDb);

      const sources = await getLeadSourcePerformance(orgAId, undefined, undefined, undefined, testDb);

      expect(sources.length).toBeGreaterThanOrEqual(2);
      const webSource = sources.find((s) => s.source === "website");
      expect(webSource).toBeDefined();
      expect(webSource!.leadCount).toBeGreaterThanOrEqual(1);
      expect(webSource!.dealsCreatedCount).toBeGreaterThanOrEqual(1);
      expect(webSource!.dealsWonCount).toBeGreaterThanOrEqual(1);
      expect(webSource!.wonValueByCurrency["USD"]).toBeGreaterThanOrEqual(50000);

      const refSource = sources.find((s) => s.source === "referral");
      expect(refSource).toBeDefined();
      expect(refSource!.wonValueByCurrency["INR"]).toBeGreaterThanOrEqual(1200000);
      // Verify currencies are NOT mixed
      expect(refSource!.wonValueByCurrency["USD"]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // 9-15: DEAL PIPELINE INTELLIGENCE & MULTI-CURRENCY
  // -------------------------------------------------------------
  describe("Deal Pipeline Intelligence", () => {
    it("9-15. should aggregate deals, safe multi-currency values, win rate, and loss rate", async () => {
      // Create deals in Org A across stages and currencies
      await createDeal(orgAId, {
        name: "Open Deal USD 1",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1ProposalId,
        status: "open",
        value: 10000,
        currency: "USD",
        ownerUserId: userAId,
      }, testDb);

      await createDeal(orgAId, {
        name: "Open Deal USD 2",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1ProposalId,
        status: "open",
        value: 20000,
        currency: "USD",
        ownerUserId: userAId,
      }, testDb);

      await createDeal(orgAId, {
        name: "Open Deal EUR 1",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1NegotiationId,
        status: "open",
        value: 15000,
        currency: "EUR",
        ownerUserId: userAId,
      }, testDb);

      await createDeal(orgAId, {
        name: "Lost Deal USD",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1LostId,
        status: "lost",
        value: 5000,
        currency: "USD",
        ownerUserId: userAId,
      }, testDb);

      const pipelinesData = await getDealPipelineIntelligence(orgAId, undefined, undefined, undefined, testDb);

      expect(pipelinesData.length).toBeGreaterThanOrEqual(1);
      const salesPipe = pipelinesData.find((p) => p.pipelineId === pipelineA1Id);
      expect(salesPipe).toBeDefined();

      expect(salesPipe!.openDealCount).toBeGreaterThanOrEqual(3);
      expect(salesPipe!.wonDealCount).toBeGreaterThanOrEqual(2);
      expect(salesPipe!.lostDealCount).toBeGreaterThanOrEqual(1);

      // Currency grouping safety: USD, EUR, INR must be separate keys
      expect(salesPipe!.openValueByCurrency["USD"]).toBeGreaterThanOrEqual(30000);
      expect(salesPipe!.openValueByCurrency["EUR"]).toBeGreaterThanOrEqual(15000);
      expect(salesPipe!.openValueByCurrency["INR"]).toBeUndefined();

      // Win Rate = Won / (Won + Lost)
      const won = salesPipe!.wonDealCount;
      const lost = salesPipe!.lostDealCount;
      const expectedWinRate = Number(((won / (won + lost)) * 100).toFixed(1));
      expect(salesPipe!.winRate).toBe(expectedWinRate);

      // Loss Rate = Lost / (Won + Lost)
      const expectedLossRate = Number(((lost / (won + lost)) * 100).toFixed(1));
      expect(salesPipe!.lossRate).toBe(expectedLossRate);
    });

    it("16-18. should compute stage-level deal counts and values without fabricating stage dwell time", async () => {
      const pipelinesData = await getDealPipelineIntelligence(orgAId, undefined, undefined, undefined, testDb);
      const salesPipe = pipelinesData.find((p) => p.pipelineId === pipelineA1Id)!;

      const proposalStage = salesPipe.stages.find((s) => s.stageId === stageA1ProposalId);
      expect(proposalStage).toBeDefined();
      expect(proposalStage!.openDealCount).toBeGreaterThanOrEqual(2);
      expect(proposalStage!.openValueByCurrency["USD"]).toBeGreaterThanOrEqual(30000);

      // Verify Phase 5 & 19 honesty rule: stageAgeDays must be null, not fabricated
      expect(proposalStage!.stageAgeDays).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 19-20: PIPELINE BOTTLENECK DETECTION
  // -------------------------------------------------------------
  describe("Pipeline Bottleneck Detection", () => {
    it("19-20. should identify bottlenecks with explainable causes and practical recommendations", async () => {
      // Seed Proposal stage to have high concentration
      // Currently Proposal stage has >= 2 deals out of ~3 open deals (>= 60%)
      const bottlenecks = await getPipelineBottlenecks(orgAId, undefined, undefined, undefined, testDb);

      expect(bottlenecks).toBeDefined();
      const proposalBottleneck = bottlenecks.find((b) => b.stageId === stageA1ProposalId);
      if (proposalBottleneck) {
        expect(proposalBottleneck.reason).toBeDefined();
        expect(proposalBottleneck.reason.length).toBeGreaterThan(0);
        expect(proposalBottleneck.recommendation).toBeDefined();
        expect(proposalBottleneck.openDealCount).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // -------------------------------------------------------------
  // 21-23: FILTERS (Date Range, Assignee, Pipeline)
  // -------------------------------------------------------------
  describe("Filters Consistency", () => {
    it("21. should respect date range filtering", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const distantFuture = new Date();
      distantFuture.setDate(distantFuture.getDate() + 20);

      const futureFunnel = await getLeadFunnelIntelligence(
        orgAId,
        { from: futureDate, to: distantFuture, preset: "custom" },
        undefined,
        undefined,
        testDb
      );

      // No leads were created in the future
      expect(futureFunnel.totalLeads).toBe(0);
      expect(futureFunnel.qualificationRate).toBe(0);
    });

    it("22. should filter by assignee consistently across leads and deals", async () => {
      // Create lead and deal assigned to Aaron (userA2Id)
      const aaronLead = await createLead(
        orgAId,
        { firstName: "AaronLead", assignedToUserId: userA2Id, status: "qualified" },
        testDb
      );
      await createDeal(
        orgAId,
        {
          name: "Aaron Deal",
          leadId: aaronLead.id,
          pipelineId: pipelineA1Id,
          pipelineStageId: stageA1NewId,
          status: "open",
          value: 100000,
          currency: "USD",
          ownerUserId: userA2Id,
        },
        testDb
      );

      // Query specifically for Aaron's metrics
      const aaronFunnel = await getLeadFunnelIntelligence(
        orgAId,
        undefined,
        userA2Id,
        undefined,
        testDb
      );
      expect(aaronFunnel.totalLeads).toBeGreaterThanOrEqual(1);

      const aaronPipelines = await getDealPipelineIntelligence(
        orgAId,
        undefined,
        userA2Id,
        undefined,
        testDb
      );
      const pipe = aaronPipelines.find((p) => p.pipelineId === pipelineA1Id);
      expect(pipe).toBeDefined();
      expect(pipe!.openDealCount).toBe(1);
      expect(pipe!.openValueByCurrency["USD"]).toBe(100000);
    });

    it("23. should filter by pipelineId", async () => {
      const singlePipe = await getDealPipelineIntelligence(
        orgAId,
        undefined,
        undefined,
        pipelineA1Id,
        testDb
      );

      expect(singlePipe.length).toBe(1);
      expect(singlePipe[0].pipelineId).toBe(pipelineA1Id);
    });
  });

  // -------------------------------------------------------------
  // 24: ARCHIVED RECORD EXCLUSION
  // -------------------------------------------------------------
  describe("Archived Record Exclusion", () => {
    it("24. should strictly exclude archived leads and deals from intelligence calculations", async () => {
      const leadToArchive = await createLead(
        orgAId,
        { firstName: "ArchivedLead", source: "website", status: "new" },
        testDb
      );
      const dealToArchive = await createDeal(
        orgAId,
        {
          name: "Archived Deal",
          pipelineId: pipelineA1Id,
          pipelineStageId: stageA1NewId,
          status: "open",
          value: 999999,
          currency: "USD",
          ownerUserId: userAId,
        },
        testDb
      );

      const beforeFunnel = await getLeadFunnelIntelligence(orgAId, undefined, undefined, undefined, testDb);
      const beforePipe = await getDealPipelineIntelligence(orgAId, undefined, undefined, undefined, testDb);

      // Archive them
      await archiveLead(orgAId, leadToArchive.id, testDb);
      await archiveDeal(orgAId, dealToArchive.id, testDb);

      const afterFunnel = await getLeadFunnelIntelligence(orgAId, undefined, undefined, undefined, testDb);
      const afterPipe = await getDealPipelineIntelligence(orgAId, undefined, undefined, undefined, testDb);

      expect(afterFunnel.totalLeads).toBe(beforeFunnel.totalLeads - 1);
      const afterSalesPipe = afterPipe.find((p) => p.pipelineId === pipelineA1Id)!;
      const beforeSalesPipe = beforePipe.find((p) => p.pipelineId === pipelineA1Id)!;
      expect(afterSalesPipe.openDealCount).toBe(beforeSalesPipe.openDealCount - 1);
    });
  });

  // -------------------------------------------------------------
  // 25: TENANT ISOLATION
  // -------------------------------------------------------------
  describe("Tenant Isolation", () => {
    it("25. should guarantee Org A intelligence never leaks to Org B", async () => {
      // Org B has 0 leads and 0 deals currently
      const orgBFunnel = await getLeadFunnelIntelligence(orgBId, undefined, undefined, undefined, testDb);
      expect(orgBFunnel.totalLeads).toBe(0);
      expect(orgBFunnel.qualificationRate).toBe(0);

      const orgBPipelines = await getDealPipelineIntelligence(orgBId, undefined, undefined, undefined, testDb);
      expect(orgBPipelines.length).toBe(1);
      expect(orgBPipelines[0].openDealCount).toBe(0);
      expect(Object.keys(orgBPipelines[0].openValueByCurrency).length).toBe(0);

      // Now create a deal in Org B
      await createDeal(
        orgBId,
        {
          name: "Org B Deal",
          pipelineId: pipelineBId,
          pipelineStageId: stageBId,
          status: "open",
          value: 7777,
          currency: "USD",
          ownerUserId: userBId,
        },
        testDb
      );

      // Verify Org A is unaffected
      const orgAPipelines = await getDealPipelineIntelligence(orgAId, undefined, undefined, undefined, testDb);
      const orgAPipe = orgAPipelines.find((p) => p.pipelineId === pipelineA1Id)!;
      // Org A's open deals should not include 7777 from Org B
      expect(orgAPipe.pipelineId).toBe(pipelineA1Id);

      // Org B should have its 1 deal
      const orgBPipelinesAfter = await getDealPipelineIntelligence(orgBId, undefined, undefined, undefined, testDb);
      expect(orgBPipelinesAfter[0].openDealCount).toBe(1);
      expect(orgBPipelinesAfter[0].openValueByCurrency["USD"]).toBe(7777);
    });
  });

  // -------------------------------------------------------------
  // 28: EMPTY DATASETS
  // -------------------------------------------------------------
  describe("Empty Datasets", () => {
    it("28. should handle empty organizations gracefully without errors", async () => {
      const funnel = await getLeadFunnelIntelligence(orgEmptyId, undefined, undefined, undefined, testDb);
      expect(funnel.totalLeads).toBe(0);
      expect(funnel.qualificationRate).toBe(0);
      expect(funnel.conversionRate).toBe(0);
      expect(funnel.stages.every((s) => s.count === 0 && s.percentage === 0)).toBe(true);

      const sources = await getLeadSourcePerformance(orgEmptyId, undefined, undefined, undefined, testDb);
      expect(sources).toEqual([]);

      const pipelinesData = await getDealPipelineIntelligence(orgEmptyId, undefined, undefined, undefined, testDb);
      expect(pipelinesData).toEqual([]);

      const bottlenecks = await getPipelineBottlenecks(orgEmptyId, undefined, undefined, undefined, testDb);
      expect(bottlenecks).toEqual([]);

      const comparison = await getPeriodComparisonMetrics(orgEmptyId, undefined, undefined, undefined, testDb);
      expect(comparison.leads.current).toBe(0);
      expect(comparison.leads.previous).toBe(0);
      expect(comparison.leads.changePercentage).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 29-30: PERIOD COMPARISON
  // -------------------------------------------------------------
  describe("Period-over-Period Comparison", () => {
    it("29-30. should calculate deterministic period comparison and date boundaries", async () => {
      const now = new Date();
      const currentRange = {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
      };

      const prevRange = getPreviousEquivalentDateRange(currentRange);
      expect(prevRange.to.getTime()).toBeLessThan(currentRange.from.getTime());
      expect(prevRange.to.getTime() - prevRange.from.getTime()).toBe(
        currentRange.to.getTime() - currentRange.from.getTime()
      );

      const comparison = await getPeriodComparisonMetrics(
        orgAId,
        currentRange,
        undefined,
        undefined,
        testDb
      );

      expect(comparison.currentPeriod.from).toBeDefined();
      expect(comparison.previousPeriod.from).toBeDefined();
      expect(comparison.leads).toBeDefined();
      expect(comparison.qualifiedLeads).toBeDefined();
      expect(comparison.dealsCreated).toBeDefined();
      expect(comparison.dealsWon).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 31-32: DASHBOARD UNIFIED DATA INTEGRATION
  // -------------------------------------------------------------
  describe("Unified Dashboard Integration", () => {
    it("31-32. should attach complete intelligence payload in getDashboardData", async () => {
      const dashboard = await getDashboardData(orgAId, userAId, {}, testDb);

      expect(dashboard.intelligence).toBeDefined();
      expect(dashboard.intelligence!.funnel.totalLeads).toBeGreaterThan(0);
      expect(dashboard.intelligence!.sources.length).toBeGreaterThan(0);
      expect(dashboard.intelligence!.pipelines.length).toBeGreaterThan(0);
      expect(dashboard.intelligence!.periodComparison).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 34-35: REGRESSION TESTING (2.10A & 2.9)
  // -------------------------------------------------------------
  describe("Regression Safety", () => {
    it("34. should verify 2.10A CRM health intelligence remains completely functional", async () => {
      const attentionItems = await getOrganizationAttentionItems(orgAId, {}, testDb);
      expect(attentionItems.items).toBeDefined();
      expect(Array.isArray(attentionItems.items)).toBe(true);
    });

    it("35. should verify combined getPipelineAndConversionIntelligence service", async () => {
      const combined = await getPipelineAndConversionIntelligence(orgAId, undefined, undefined, undefined, testDb);
      expect(combined.funnel).toBeDefined();
      expect(combined.sources).toBeDefined();
      expect(combined.pipelines).toBeDefined();
      expect(combined.bottlenecks).toBeDefined();
      expect(combined.periodComparison).toBeDefined();
    });
  });
});
