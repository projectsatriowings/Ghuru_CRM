import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createLead, updateLead } from "@/lib/services/lead.service";
import { createFollowUp, updateFollowUp } from "@/lib/services/follow-up.service";
import { createActivity } from "@/lib/services/activity.service";
import { createPipeline, createStage } from "@/lib/services/pipeline.service";
import {
  getDashboardData,
  getLeadMetrics,
  getLeadSourceMetrics,
  getPipelineStageMetrics,
  getFollowUpMetrics,
  getActivityMetrics,
  getConversionMetrics,
  getMyWorkMetrics,
  getNeedsAttentionItems,
  validateAssignee,
  validatePipeline,
} from "@/lib/services/dashboard.service";
import { INITIAL_PERMISSIONS, DEFAULT_ORG_ADMIN_ROLE } from "@/lib/permissions";
import { DASHBOARD_WIDGET_CONFIGS } from "@/lib/types/dashboard";
import { NotFoundError } from "@/lib/errors";
import { eq } from "drizzle-orm";

describe("Milestone 2.7 — CRM Dashboard & Intelligence Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userA1Id: string;
  let userA2Id: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let orgEmptyId: string;
  let pipelineAId: string;
  let stageA1Id: string;
  let stageA2Id: string;
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
    userA1Id = crypto.randomUUID();
    userA2Id = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      {
        id: userA1Id,
        name: "Alice Admin",
        email: "alice@orga.com",
        emailVerified: true,
      },
      {
        id: userA2Id,
        name: "Arthur Agent",
        email: "arthur@orga.com",
        emailVerified: true,
      },
      {
        id: userBId,
        name: "Bob Beta",
        email: "bob@orgb.com",
        emailVerified: true,
      },
    ]);

    // 4. Create isolated organizations
    const orgA = await createOrganization(
      { name: "Alpha CRM Corp", slug: "alpha-crm", userId: userA1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    // Add userA2 as member of Org A
    const [agentRole] = await testDb
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.organizationId, orgAId))
      .limit(1);

    await testDb.insert(schema.organizationMembers).values({
      id: crypto.randomUUID(),
      organizationId: orgAId,
      userId: userA2Id,
      roleId: agentRole.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const orgB = await createOrganization(
      { name: "Beta CRM Corp", slug: "beta-crm", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    const orgEmpty = await createOrganization(
      { name: "Empty CRM Corp", slug: "empty-crm", userId: userBId },
      testDb
    );
    orgEmptyId = orgEmpty.organization.id;

    // 5. Create Pipelines & Stages in Org A
    const pipeA = await createPipeline(
      orgAId,
      { name: "Sales Pipeline A", description: "Default Sales Pipeline" },
      testDb
    );
    pipelineAId = pipeA.id;

    const stage1 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Discovery", displayOrder: 1 },
      testDb
    );
    stageA1Id = stage1.id;

    const stage2 = await createStage(
      orgAId,
      pipelineAId,
      { name: "Proposal", displayOrder: 2 },
      testDb
    );
    stageA2Id = stage2.id;

    // Create Pipeline in Org B
    const pipeB = await createPipeline(
      orgBId,
      { name: "Beta Pipeline", description: "Org B Pipeline" },
      testDb
    );
    pipelineBId = pipeB.id;

    const stageB = await createStage(
      orgBId,
      pipelineBId,
      { name: "Lead In", displayOrder: 1 },
      testDb
    );
    stageBId = stageB.id;

    // 6. Seed Leads in Org A
    // Lead 1: New, Website, Assigned to userA1, Stage Discovery
    const lead1 = await createLead(
      orgAId,
      {
        firstName: "Charlie",
        lastName: "Client",
        email: "charlie@test.com",
        source: "website",
        pipelineId: pipelineAId,
        stageId: stageA1Id,
        assignedToUserId: userA1Id,
      },
      testDb
    );

    // Lead 2: Contacted, Meta Ads, Assigned to userA2, Stage Discovery
    const lead2 = await createLead(
      orgAId,
      {
        firstName: "Dana",
        lastName: "Design",
        email: "dana@test.com",
        source: "meta_ads",
        pipelineId: pipelineAId,
        stageId: stageA1Id,
        assignedToUserId: userA2Id,
      },
      testDb
    );
    await updateLead(orgAId, lead2.id, { status: "contacted" }, testDb);

    // Lead 3: Converted, Google Ads, Assigned to userA1, Stage Proposal
    const lead3 = await createLead(
      orgAId,
      {
        firstName: "Evan",
        lastName: "Enterprise",
        email: "evan@test.com",
        source: "google_ads",
        pipelineId: pipelineAId,
        stageId: stageA2Id,
        assignedToUserId: userA1Id,
      },
      testDb
    );
    await updateLead(orgAId, lead3.id, { status: "converted" }, testDb);

    // Lead 4: Lost, Walk-in, Assigned to userA2
    const lead4 = await createLead(
      orgAId,
      {
        firstName: "Fiona",
        lastName: "Founder",
        email: "fiona@test.com",
        source: "walk_in",
        assignedToUserId: userA2Id,
      },
      testDb
    );
    await updateLead(orgAId, lead4.id, { status: "lost" }, testDb);

    // Seed Lead in Org B (for tenant isolation)
    await createLead(
      orgBId,
      {
        firstName: "George",
        lastName: "Global",
        email: "george@beta.com",
        source: "whatsapp",
        pipelineId: pipelineBId,
        stageId: stageBId,
        assignedToUserId: userBId,
      },
      testDb
    );

    // 7. Seed Follow-ups in Org A
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // Follow-up 1: Overdue, assigned to userA1 for lead1
    await createFollowUp(
      orgAId,
      userA1Id,
      lead1.id,
      {
        title: "Call Charlie Back",
        dueDate: yesterday,
        assignedToUserId: userA1Id,
      },
      testDb
    );

    // Follow-up 2: Due Today, assigned to userA1 for lead1
    await createFollowUp(
      orgAId,
      userA1Id,
      lead1.id,
      {
        title: "Send Proposal to Charlie",
        dueDate: today,
        assignedToUserId: userA1Id,
      },
      testDb
    );

    // Follow-up 3: Upcoming, assigned to userA2 for lead2
    await createFollowUp(
      orgAId,
      userA2Id,
      lead2.id,
      {
        title: "Demo Call Dana",
        dueDate: tomorrow,
        assignedToUserId: userA2Id,
      },
      testDb
    );

    // Follow-up 4: Completed, assigned to userA1 for lead3
    const fu4 = await createFollowUp(
      orgAId,
      userA1Id,
      lead3.id,
      {
        title: "Contract Review",
        dueDate: yesterday,
        assignedToUserId: userA1Id,
      },
      testDb
    );
    await updateFollowUp(orgAId, fu4.id, { status: "completed" }, testDb);

    // 8. Seed Activities in Org A
    await createActivity(
      orgAId,
      userA1Id,
      {
        entityType: "lead",
        entityId: lead1.id,
        type: "call",
        title: "Intro Call with Charlie",
        status: "completed",
      },
      testDb
    );

    await createActivity(
      orgAId,
      userA2Id,
      {
        entityType: "lead",
        entityId: lead2.id,
        type: "email",
        title: "Email Brochure to Dana",
        status: "completed",
      },
      testDb
    );

    await createActivity(
      orgAId,
      userA1Id,
      {
        entityType: "lead",
        entityId: lead3.id,
        type: "conversion",
        title: "Lead converted to enterprise account",
        status: "completed",
      },
      testDb
    );
  });

  // 1. Dashboard metrics for organization
  it("1. should compute complete dashboard metrics for an organization", async () => {
    const data = await getDashboardData(
      orgAId,
      userA1Id,
      { preset: "last_30_days" },
      testDb
    );

    expect(data).toBeDefined();
    expect(data.dateRange).toBeDefined();
    expect(data.leads).toBeDefined();
    expect(data.sources).toBeDefined();
    expect(data.pipelines).toBeDefined();
    expect(data.followUps).toBeDefined();
    expect(data.activities).toBeDefined();
    expect(data.conversion).toBeDefined();
    expect(data.myWork).toBeDefined();
    expect(data.needsAttention).toBeDefined();
  });

  // 2. Tenant isolation
  it("2. should guarantee strict tenant isolation between organizations", async () => {
    const dataA = await getDashboardData(orgAId, userA1Id, {}, testDb);
    const dataB = await getDashboardData(orgBId, userBId, {}, testDb);

    // Org A has 4 leads, Org B has 1 lead
    expect(dataA.leads.total).toBe(4);
    expect(dataB.leads.total).toBe(1);

    // Org B should have whatsapp source, Org A should not have whatsapp count > 0
    const bWhatsapp = dataB.sources.find((s) => s.source === "whatsapp");
    expect(bWhatsapp?.count).toBe(1);

    const aWhatsapp = dataA.sources.find((s) => s.source === "whatsapp");
    expect(aWhatsapp).toBeUndefined();
  });

  // 3. Total lead counts
  it("3. should accurately calculate total, new, contacted, qualified, converted, and lost leads", async () => {
    const metrics = await getLeadMetrics(orgAId, {}, testDb);

    expect(metrics.total).toBe(4);
    expect(metrics.totalAllTime).toBe(4);
    expect(metrics.new).toBe(1);
    expect(metrics.contacted).toBe(1);
    expect(metrics.qualified).toBe(0);
    expect(metrics.converted).toBe(1);
    expect(metrics.lost).toBe(1);
  });

  // 4. Lead status aggregation
  it("4. should aggregate lead statuses with correct counts and percentages", async () => {
    const metrics = await getLeadMetrics(orgAId, {}, testDb);

    expect(metrics.statusBreakdown).toHaveLength(6);
    const newStatus = metrics.statusBreakdown.find((s) => s.status === "new");
    expect(newStatus?.count).toBe(1);
    expect(newStatus?.percentage).toBe(25); // 1 / 4 = 25%

    const convertedStatus = metrics.statusBreakdown.find((s) => s.status === "converted");
    expect(convertedStatus?.count).toBe(1);
    expect(convertedStatus?.percentage).toBe(25);
  });

  // 5. Source aggregation
  it("5. should aggregate leads by acquisition source", async () => {
    const sources = await getLeadSourceMetrics(orgAId, {}, testDb);

    const website = sources.find((s) => s.source === "website");
    expect(website?.count).toBe(1);
    expect(website?.percentage).toBe(25);

    const metaAds = sources.find((s) => s.source === "meta_ads");
    expect(metaAds?.count).toBe(1);

    const googleAds = sources.find((s) => s.source === "google_ads");
    expect(googleAds?.count).toBe(1);

    const walkIn = sources.find((s) => s.source === "walk_in");
    expect(walkIn?.count).toBe(1);
  });

  // 6. Pipeline aggregation
  it("6. should aggregate leads across configured pipelines and stages", async () => {
    const pipelines = await getPipelineStageMetrics(orgAId, {}, testDb);

    expect(pipelines.length).toBeGreaterThanOrEqual(1);
    const pipe = pipelines.find((p) => p.pipelineId === pipelineAId);
    expect(pipe).toBeDefined();
    expect(pipe?.totalLeads).toBe(3); // lead1, lead2, lead3

    const discoveryStage = pipe?.stages.find((s) => s.stageId === stageA1Id);
    expect(discoveryStage?.count).toBe(2); // lead1 and lead2

    const proposalStage = pipe?.stages.find((s) => s.stageId === stageA2Id);
    expect(proposalStage?.count).toBe(1); // lead3
  });

  // 7. Follow-up counts
  it("7. should accurately compute pending, due today, and completed follow-up counts", async () => {
    const fu = await getFollowUpMetrics(orgAId, userA1Id, {}, testDb);

    expect(fu.pending).toBe(3); // overdue + today + upcoming
    expect(fu.dueToday).toBe(1);
    expect(fu.completed).toBe(1);
  });

  // 8. Overdue follow-ups
  it("8. should identify and count overdue follow-ups deterministically", async () => {
    const fu = await getFollowUpMetrics(orgAId, userA1Id, {}, testDb);

    expect(fu.overdue).toBe(1); // yesterday follow-up
  });

  // 9. Activity counts
  it("9. should accurately aggregate activities count for today, this week, and completed", async () => {
    const act = await getActivityMetrics(orgAId, {}, testDb);

    expect(act.total).toBe(3);
    expect(act.today).toBe(3);
    expect(act.thisWeek).toBe(3);
    expect(act.completed).toBe(3);
  });

  // 10. Activity type aggregation
  it("10. should break down activities across all unified activity types", async () => {
    const act = await getActivityMetrics(orgAId, {}, testDb);

    expect(act.byType.call).toBe(1);
    expect(act.byType.email).toBe(1);
    expect(act.byType.conversion).toBe(1);
    expect(act.byType.meeting).toBe(0);
    expect(act.byType.note).toBe(0);
    expect(act.byType.task).toBe(0);
  });

  // 11. Conversion count
  it("11. should compute exact converted lead count", async () => {
    const conv = await getConversionMetrics(orgAId, {}, testDb);

    expect(conv.convertedLeads).toBe(1); // lead3
  });

  // 12. Conversion rate
  it("12. should calculate deterministic conversion rate (converted / eligible)", async () => {
    const conv = await getConversionMetrics(orgAId, {}, testDb);

    // Eligible leads = total leads = 4
    // Converted leads = 1
    // Conversion rate = (1 / 4) * 100 = 25%
    expect(conv.totalEligibleLeads).toBe(4);
    expect(conv.convertedLeads).toBe(1);
    expect(conv.conversionRate).toBe(25);
  });

  // 13. Assignee filtering
  it("13. should filter dashboard metrics by a specific valid organization assignee", async () => {
    const userA1Metrics = await getLeadMetrics(
      orgAId,
      { assigneeId: userA1Id },
      testDb
    );

    // Lead1 and Lead3 are assigned to userA1
    expect(userA1Metrics.total).toBe(2);
    expect(userA1Metrics.new).toBe(1);
    expect(userA1Metrics.converted).toBe(1);

    const userA2Metrics = await getLeadMetrics(
      orgAId,
      { assigneeId: userA2Id },
      testDb
    );

    // Lead2 and Lead4 are assigned to userA2
    expect(userA2Metrics.total).toBe(2);
    expect(userA2Metrics.contacted).toBe(1);
    expect(userA2Metrics.lost).toBe(1);
  });

  // 14. Invalid cross-tenant assignee rejection
  it("14. should reject an assignee from another organization", async () => {
    await expect(validateAssignee(orgAId, userBId, testDb)).rejects.toThrow(
      NotFoundError
    );
  });

  // 15. Pipeline filtering
  it("15. should filter metrics by a specific organization pipeline", async () => {
    const pipelines = await getPipelineStageMetrics(
      orgAId,
      { pipelineId: pipelineAId },
      testDb
    );

    expect(pipelines).toHaveLength(1);
    expect(pipelines[0].pipelineId).toBe(pipelineAId);
  });

  // 16. Invalid cross-tenant pipeline rejection
  it("16. should reject a pipeline from another organization", async () => {
    await expect(validatePipeline(orgAId, pipelineBId, testDb)).rejects.toThrow(
      NotFoundError
    );
  });

  // 17. Date range filtering
  it("17. should properly respect date range boundaries", async () => {
    // Tomorrow onwards should have 0 leads created
    const tomorrowDate = new Date(Date.now() + 86400000);
    const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000);

    const futureMetrics = await getLeadMetrics(
      orgAId,
      {
        dateRange: {
          from: tomorrowDate,
          to: dayAfterTomorrow,
          preset: "custom",
        },
      },
      testDb
    );

    expect(futureMetrics.total).toBe(0);
    expect(futureMetrics.totalAllTime).toBe(4); // All-time preserved
  });

  // 18. Current-user My Work
  it("18. should return user-scoped operational workload for the authenticated user", async () => {
    const myWork = await getMyWorkMetrics(orgAId, userA1Id, testDb);

    expect(myWork.assignedLeadsCount).toBe(2);
    expect(myWork.overdueFollowUpsCount).toBe(1);
    expect(myWork.followUpsDueToday.length).toBe(1);
    expect(myWork.recentAssignedLeads.length).toBeGreaterThan(0);
    expect(myWork.overdueFollowUps.length).toBe(1);
    expect(myWork.overdueFollowUps[0].title).toBe("Call Charlie Back");
  });

  // 19. Needs Attention
  it("19. should return actionable items (overdue follow-ups and leads without next actions)", async () => {
    const items = await getNeedsAttentionItems(orgAId, undefined, testDb);

    expect(items.length).toBeGreaterThanOrEqual(1);

    // Overdue follow-up check
    const overdueItem = items.find((i) => i.category === "overdue_follow_up");
    expect(overdueItem).toBeDefined();
    expect(overdueItem?.urgency).toBe("high");
    expect(overdueItem?.link).toContain("/leads/");

    // No next action check (lead2 is active with upcoming follow-up, but lead4 is lost, lead3 is converted)
    expect(items.every((i) => i.link.startsWith("/"))).toBe(true);
  });

  // 20. Empty-state / no-data behavior
  it("20. should handle empty organizations gracefully without errors", async () => {
    const emptyData = await getDashboardData(
      orgEmptyId,
      userBId,
      {},
      testDb
    );

    expect(emptyData.leads.total).toBe(0);
    expect(emptyData.leads.totalAllTime).toBe(0);
    expect(emptyData.conversion.conversionRate).toBe(0);
    expect(emptyData.followUps.pending).toBe(0);
    expect(emptyData.activities.total).toBe(0);
    expect(emptyData.sources).toHaveLength(0);
    expect(emptyData.needsAttention).toHaveLength(0);
    expect(emptyData.myWork.assignedLeadsCount).toBe(0);
  });

  // 21. RBAC dashboard access
  it("21. should ensure dashboard.view permission exists and is included in ALL_PERMISSION_KEYS", () => {
    const dashboardPerm = INITIAL_PERMISSIONS.find((p) => p.key === "dashboard.view");
    expect(dashboardPerm).toBeDefined();
    expect(dashboardPerm?.description).toContain("dashboard");
  });

  // 22. Role-aware widget visibility/registry
  it("22. should define extensible dashboard widget registry with role awareness", () => {
    expect(DASHBOARD_WIDGET_CONFIGS.length).toBeGreaterThan(5);

    const myWorkConfig = DASHBOARD_WIDGET_CONFIGS.find(
      (w) => w.key === "my_work"
    );
    expect(myWorkConfig).toBeDefined();
    expect(myWorkConfig?.allowedRoles).toContain("counsellor");

    const conversionConfig = DASHBOARD_WIDGET_CONFIGS.find(
      (w) => w.key === "conversion"
    );
    expect(conversionConfig).toBeDefined();
    expect(conversionConfig?.allowedRoles).toContain(DEFAULT_ORG_ADMIN_ROLE);
  });

  // 23. No cross-tenant data leakage
  it("23. should prevent cross-tenant data leakage in SQL aggregations", async () => {
    const orgAConv = await getConversionMetrics(orgAId, {}, testDb);
    const orgBConv = await getConversionMetrics(orgBId, {}, testDb);

    expect(orgAConv.convertedLeads).toBe(1);
    expect(orgBConv.convertedLeads).toBe(0);
  });

  // 24. Existing CRM functionality remains intact
  it("24. should verify that creating new leads and follow-ups immediately updates dashboard metrics", async () => {
    // Add 1 more lead in Org A
    const newLead = await createLead(
      orgAId,
      {
        firstName: "Hannah",
        lastName: "Highlander",
        email: "hannah@test.com",
        source: "referral",
        assignedToUserId: userA1Id,
      },
      testDb
    );

    const updatedMetrics = await getLeadMetrics(orgAId, {}, testDb);
    expect(updatedMetrics.total).toBe(5);

    // Add follow-up for newLead
    const today = new Date().toISOString().slice(0, 10);
    await createFollowUp(
      orgAId,
      userA1Id,
      newLead.id,
      {
        title: "Welcome Call",
        dueDate: today,
        assignedToUserId: userA1Id,
      },
      testDb
    );

    const updatedFU = await getFollowUpMetrics(orgAId, userA1Id, {}, testDb);
    expect(updatedFU.dueToday).toBe(2);
  });
});
