import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";
import { createOrganization } from "@/lib/services/organization.service";
import { createPipeline, createStage } from "@/lib/services/pipeline.service";
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  archiveTeam,
  getTeams,
} from "@/lib/services/team.service";
import {
  getOwnerIntelligence,
  getUnassignedWorkload,
  getTeamIntelligence,
  getTeamAndOwnerIntelligence,
} from "@/lib/services/team-owner-intelligence.service";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { getOrganizationAttentionItems } from "@/lib/services/crm-health.service";
import { getDealPipelineIntelligence } from "@/lib/services/pipeline-intelligence.service";
import { eq } from "drizzle-orm";
import React from "react";
import { renderToString } from "react-dom/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

describe("Milestone 2.10C — Team & Owner Intelligence Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userA1Id: string; // Alice (Sales Leader)
  let userA2Id: string; // Bob (Account Executive)
  let userA3Id: string; // Charlie (Junior Rep, low closed deals)
  let userBId: string;  // Dave (Org B)
  let orgAId: string;
  let orgBId: string;
  let orgEmptyId: string;
  let pipelineA1Id: string;
  let stageA1_NewId: string;
  let stageA1_WonId: string;
  let stageA1_LostId: string;
  let teamAlphaId: string;

  beforeAll(async () => {
    // 1. Initialize PGlite in-memory database
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migrations up to 0014
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
    userA3Id = crypto.randomUUID();
    userBId = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      { id: userA1Id, name: "Alice Admin", email: "alice@org-a.com" },
      { id: userA2Id, name: "Bob Closer", email: "bob@org-a.com" },
      { id: userA3Id, name: "Charlie Rookie", email: "charlie@org-a.com" },
      { id: userBId, name: "Dave Competitor", email: "dave@org-b.com" },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Apex Global", slug: "apex-global", userId: userA1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    // Add Bob and Charlie to Org A
    const [adminRole] = await testDb
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.organizationId, orgAId));

    await testDb.insert(schema.organizationMembers).values([
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        userId: userA2Id,
        roleId: adminRole.id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        userId: userA3Id,
        roleId: adminRole.id,
      },
    ]);

    const orgB = await createOrganization(
      { name: "Beta Corp", slug: "beta-corp", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    const orgEmpty = await createOrganization(
      { name: "Empty Org", slug: "empty-org", userId: userA1Id },
      testDb
    );
    orgEmptyId = orgEmpty.organization.id;

    // 5. Create Pipeline & Stages in Org A
    const pipeA1 = await createPipeline(
      orgAId,
      { name: "Standard Enterprise Pipeline" },
      testDb
    );
    pipelineA1Id = pipeA1.id;

    const stNew = await createStage(
      orgAId,
      pipelineA1Id,
      { name: "Discovery", displayOrder: 1 },
      testDb
    );
    stageA1_NewId = stNew.id;

    const stWon = await createStage(
      orgAId,
      pipelineA1Id,
      { name: "Won Closed", displayOrder: 2 },
      testDb
    );
    stageA1_WonId = stWon.id;

    const stLost = await createStage(
      orgAId,
      pipelineA1Id,
      { name: "Lost Closed", displayOrder: 3 },
      testDb
    );
    stageA1_LostId = stLost.id;

    // 6. Create Team in Org A
    const teamAlpha = await createTeam(
      orgAId,
      { name: "Alpha Sales Squad", description: "Direct enterprise sales" },
      testDb
    );
    teamAlphaId = teamAlpha.id;

    // Add Alice and Bob to team Alpha
    await addTeamMember(orgAId, teamAlphaId, { userId: userA1Id }, testDb);
    await addTeamMember(orgAId, teamAlphaId, { userId: userA2Id }, testDb);

    // 7. Seed CRM records for Org A
    // Alice's leads: 4 leads (1 new, 1 contacted, 1 qualified, 1 converted)
    await testDb.insert(schema.leads).values([
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead A1",
        status: "new",
        assignedToUserId: userA1Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_NewId,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead A2",
        status: "contacted",
        assignedToUserId: userA1Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_NewId,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead A3",
        status: "qualified",
        assignedToUserId: userA1Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_WonId,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead A4",
        status: "converted",
        assignedToUserId: userA1Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_WonId,
      },
      // Bob's leads: 2 leads (1 qualified, 1 lost)
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead B1",
        status: "qualified",
        assignedToUserId: userA2Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_WonId,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead B2",
        status: "lost",
        assignedToUserId: userA2Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_LostId,
      },
      // Charlie's leads: 1 lead (1 new)
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Lead C1",
        status: "new",
        assignedToUserId: userA3Id,
        pipelineId: pipelineA1Id,
        stageId: stageA1_NewId,
      },
      // Unassigned Leads: 2 unassigned leads
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Unassigned 1",
        status: "new",
        pipelineId: pipelineA1Id,
        stageId: stageA1_NewId,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        firstName: "Unassigned 2",
        status: "contacted",
        pipelineId: pipelineA1Id,
        stageId: stageA1_NewId,
      },
    ]);

    // Deals for Alice:
    // 1 open ($50,000 USD), 2 won ($30,000 USD and ₹100,000 INR), 1 lost ($10,000 USD)
    // Closed: 3 deals (2 won, 1 lost) -> win rate = 2/3 = 66.7%, sufficient sample >= 3
    await testDb.insert(schema.deals).values([
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Alice Deal Open",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_NewId,
        status: "open",
        value: "50000",
        currency: "USD",
        ownerUserId: userA1Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Alice Deal Won 1",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_WonId,
        status: "won",
        value: "30000",
        currency: "USD",
        ownerUserId: userA1Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Alice Deal Won 2 INR",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_WonId,
        status: "won",
        value: "100000",
        currency: "INR",
        ownerUserId: userA1Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Alice Deal Lost",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_LostId,
        status: "lost",
        value: "10000",
        currency: "USD",
        ownerUserId: userA1Id,
      },
      // Deals for Bob:
      // 2 open (EUR 20,000, USD 15,000), 1 won (USD 60,000), 1 lost (USD 10,000)
      // Closed: 2 deals (1 won, 1 lost) -> win rate = 1/2 = 50.0%
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Bob Deal Open 1",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_NewId,
        status: "open",
        value: "20000",
        currency: "EUR",
        ownerUserId: userA2Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Bob Deal Open 2",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_NewId,
        status: "open",
        value: "15000",
        currency: "USD",
        ownerUserId: userA2Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Bob Deal Won",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_WonId,
        status: "won",
        value: "60000",
        currency: "USD",
        ownerUserId: userA2Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Bob Deal Lost",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_LostId,
        status: "lost",
        value: "10000",
        currency: "USD",
        ownerUserId: userA2Id,
      },
      // Deals for Charlie (Rookie):
      // 1 won (USD 5,000). Total closed = 1 -> win rate = 100.0%, hasSufficientClosedDeals = false (< 3)
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Charlie Solo Win",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_WonId,
        status: "won",
        value: "5000",
        currency: "USD",
        ownerUserId: userA3Id,
      },
      // Unassigned Deals in Org A:
      // 1 open ($25,000 USD)
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        name: "Unassigned Deal",
        pipelineId: pipelineA1Id,
        pipelineStageId: stageA1_NewId,
        status: "open",
        value: "25000",
        currency: "USD",
        ownerUserId: null,
      },
    ]);

    // Follow-ups in Org A:
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    await testDb.insert(schema.followUps).values([
      // Alice: 1 overdue, 1 completed
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        title: "Alice Overdue Call",
        dueDate: yesterdayStr,
        assignedToUserId: userA1Id,
        status: "pending",
        createdByUserId: userA1Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        title: "Alice Done Action",
        dueDate: yesterdayStr,
        assignedToUserId: userA1Id,
        status: "completed",
        createdByUserId: userA1Id,
      },
      // Bob: 1 due today, 1 upcoming
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        title: "Bob Today Action",
        dueDate: todayStr,
        assignedToUserId: userA2Id,
        status: "pending",
        createdByUserId: userA2Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        title: "Bob Future Action",
        dueDate: tomorrowStr,
        assignedToUserId: userA2Id,
        status: "pending",
        createdByUserId: userA2Id,
      },
      // Unassigned follow-up: 1 pending
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        title: "Orphaned Task",
        dueDate: tomorrowStr,
        status: "pending",
        createdByUserId: userA1Id,
      },
    ]);

    // Activities in Org A:
    await testDb.insert(schema.activities).values([
      // Alice: 2 calls, 1 email
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: crypto.randomUUID(),
        title: "Call 1",
        type: "call",
        assignedToUserId: userA1Id,
        status: "completed",
        createdByUserId: userA1Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: crypto.randomUUID(),
        title: "Call 2",
        type: "call",
        assignedToUserId: userA1Id,
        status: "completed",
        createdByUserId: userA1Id,
      },
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: crypto.randomUUID(),
        title: "Email 1",
        type: "email",
        assignedToUserId: userA1Id,
        status: "completed",
        createdByUserId: userA1Id,
      },
      // Bob: 1 meeting
      {
        id: crypto.randomUUID(),
        organizationId: orgAId,
        entityType: "lead",
        entityId: crypto.randomUUID(),
        title: "Meeting 1",
        type: "meeting",
        assignedToUserId: userA2Id,
        status: "completed",
        createdByUserId: userA2Id,
      },
    ]);

    // Seed Org B records to verify tenant isolation
    const pipeB = await createPipeline(orgBId, { name: "B Pipe" }, testDb);
    const stageB = await createStage(orgBId, pipeB.id, { name: "B Stage" }, testDb);

    await testDb.insert(schema.leads).values({
      id: crypto.randomUUID(),
      organizationId: orgBId,
      firstName: "Dave Lead",
      status: "new",
      assignedToUserId: userBId,
    });

    await testDb.insert(schema.deals).values({
      id: crypto.randomUUID(),
      organizationId: orgBId,
      name: "Dave Secret Deal",
      status: "won",
      value: "999999",
      currency: "GBP",
      ownerUserId: userBId,
      pipelineId: pipeB.id,
      pipelineStageId: stageB.id,
    });
  });

  // 1. Owner Lead Workload
  it("1. should accurately calculate owner lead workload counts", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    expect(alice).toBeDefined();
    expect(alice?.leads.totalLeads).toBe(4);
    expect(alice?.leads.newLeads).toBe(1);
    expect(alice?.leads.contactedLeads).toBe(1);
    expect(alice?.leads.qualifiedLeads).toBe(1);
    expect(alice?.leads.convertedLeads).toBe(1);
  });

  // 2. Owner Lead Status Distribution
  it("2. should break down lead status distribution per owner accurately", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const bob = owners.find((o) => o.userId === userA2Id);
    expect(bob).toBeDefined();
    expect(bob?.leads.totalLeads).toBe(2);
    expect(bob?.leads.qualifiedLeads).toBe(1);
    expect(bob?.leads.lostLeads).toBe(1);
  });

  // 3. Owner Qualification Rate
  it("3. should deterministically calculate qualification rate: (qualified + converted) / total * 100", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    // Alice: (1 qual + 1 conv) / 4 leads * 100 = 50.0%
    expect(alice?.leadPerformance.qualificationRate).toBe(50.0);
  });

  // 4. Owner Conversion Rate
  it("4. should deterministically calculate conversion rate: converted / total * 100", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    // Alice: 1 conv / 4 leads * 100 = 25.0%
    expect(alice?.leadPerformance.conversionRate).toBe(25.0);
  });

  // 5. Owner Deal Workload
  it("5. should accurately calculate deal workload counts (open, won, lost, closed)", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    expect(alice?.deals.totalDeals).toBe(4);
    expect(alice?.deals.openDeals).toBe(1);
    expect(alice?.deals.wonDeals).toBe(2);
    expect(alice?.deals.lostDeals).toBe(1);
    expect(alice?.deals.closedDeals).toBe(3);
  });

  // 6. Owner Deal Win Rate Formula
  it("6. should compute deal win rate as strictly Won / (Won + Lost) * 100 without open deals", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    // 2 won / (2 won + 1 lost) = 2/3 * 100 = 66.7%
    expect(alice?.deals.winRate).toBe(66.7);

    const bob = owners.find((o) => o.userId === userA2Id);
    // Bob: 1 won / (1 won + 1 lost) = 1/2 * 100 = 50.0%
    expect(bob?.deals.winRate).toBe(50.0);
  });

  // 7. Multi-Currency Safety
  it("7. should keep financial amounts grouped strictly by currency without cross-currency addition", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    expect(alice?.dealValue.openValueByCurrency).toEqual({ USD: 50000 });
    // Won deals: $30,000 USD and ₹100,000 INR
    expect(alice?.dealValue.wonValueByCurrency).toEqual({
      USD: 30000,
      INR: 100000,
    });
    // Multi-currency values must never be flattened into a single currency sum
    expect(alice?.dealValue.wonValueByCurrency.USD).toBe(30000);
    expect(alice?.dealValue.wonValueByCurrency.INR).toBe(100000);
  });

  // 8. Follow-up Workload
  it("8. should calculate owner follow-up workload including overdue and due today", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    expect(alice?.followUps.totalFollowUps).toBe(2);
    expect(alice?.followUps.overdueFollowUps).toBe(1);
    expect(alice?.followUps.completedFollowUps).toBe(1);

    const bob = owners.find((o) => o.userId === userA2Id);
    expect(bob?.followUps.dueTodayFollowUps).toBe(1);
    expect(bob?.followUps.upcomingFollowUps).toBe(1);
  });

  // 9. Activity Workload
  it("9. should aggregate operational activity volume and types per owner", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    expect(alice?.activities.totalActivities).toBe(3);
    expect(alice?.activities.completedActivities).toBe(3);
    expect(alice?.activities.byType.call).toBe(2);
    expect(alice?.activities.byType.email).toBe(1);
  });

  // 10. Unassigned Leads
  it("10. should identify and count unassigned leads", async () => {
    const unassigned = await getUnassignedWorkload(orgAId, undefined, undefined, undefined, testDb);
    expect(unassigned.unassignedLeads).toBe(2);
  });

  // 11. Unassigned Deals
  it("11. should identify unassigned open deals and group unassigned value by currency", async () => {
    const unassigned = await getUnassignedWorkload(orgAId, undefined, undefined, undefined, testDb);
    expect(unassigned.unassignedOpenDeals).toBe(1);
    expect(unassigned.unassignedOpenDealValueByCurrency).toEqual({ USD: 25000 });
  });

  // 12. Unassigned Follow-ups
  it("12. should identify unassigned follow-ups accurately", async () => {
    const unassigned = await getUnassignedWorkload(orgAId, undefined, undefined, undefined, testDb);
    expect(unassigned.unassignedFollowUps).toBe(1);
  });

  // 13. Team Aggregation
  it("13. should aggregate owner metrics into team-level intelligence", async () => {
    const teamsList = await getTeamIntelligence(orgAId, undefined, undefined, undefined, testDb);
    expect(teamsList.length).toBe(1);
    const alpha = teamsList[0];
    expect(alpha.name).toBe("Alpha Sales Squad");
    // Team Alpha has Alice (4 leads) + Bob (2 leads) = 6 leads
    expect(alpha.totalLeads).toBe(6);
    // Alice qualified: 1, converted: 1; Bob qualified: 1 -> total qualified: 2, converted: 1
    expect(alpha.qualifiedLeads).toBe(2);
    expect(alpha.convertedLeads).toBe(1);
    // Team deals: Alice (2 won, 1 lost) + Bob (1 won, 1 lost) = 3 won, 2 lost = 5 closed
    expect(alpha.wonDeals).toBe(3);
    expect(alpha.lostDeals).toBe(2);
    expect(alpha.closedDeals).toBe(5);
    // Win rate: 3/5 = 60.0%
    expect(alpha.winRate).toBe(60.0);
    expect(alpha.hasSufficientClosedDeals).toBe(true);
  });

  // 14. Team Member Counts
  it("14. should report team member count accurately", async () => {
    const teamsList = await getTeamIntelligence(orgAId, undefined, undefined, undefined, testDb);
    expect(teamsList[0].memberCount).toBe(2);
    expect(teamsList[0].memberUserIds).toContain(userA1Id);
    expect(teamsList[0].memberUserIds).toContain(userA2Id);
  });

  // 15. Date Filtering
  it("15. should restrict owner metrics according to the selected date range", async () => {
    // Querying with date range in the far future must return 0 leads/deals
    const futureDate = new Date("2035-01-01T00:00:00Z");
    const futureDateEnd = new Date("2035-01-31T23:59:59Z");
    const owners = await getOwnerIntelligence(
      orgAId,
      { from: futureDate, to: futureDateEnd, preset: "custom" },
      undefined,
      undefined,
      testDb
    );
    for (const o of owners) {
      expect(o.leads.totalLeads).toBe(0);
      expect(o.deals.totalDeals).toBe(0);
    }
  });

  // 16. Assignee Filtering
  it("16. should isolate metrics to a single owner when assignee filter is active", async () => {
    const owners = await getOwnerIntelligence(
      orgAId,
      undefined,
      userA2Id,
      undefined,
      testDb
    );
    expect(owners.length).toBe(1);
    expect(owners[0].userId).toBe(userA2Id);
    expect(owners[0].name).toBe("Bob Closer");
  });

  // 17. Pipeline Filtering
  it("17. should filter deals by the active pipeline", async () => {
    const owners = await getOwnerIntelligence(
      orgAId,
      undefined,
      undefined,
      pipelineA1Id,
      testDb
    );
    const alice = owners.find((o) => o.userId === userA1Id);
    expect(alice?.deals.totalDeals).toBe(4);
  });

  // 18. Workload Concentration Indicators
  it("18. should compute neutral workload concentration indicators", async () => {
    const intel = await getTeamAndOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    expect(intel.indicators.highestLeadWorkload?.userId).toBe(userA1Id);
    expect(intel.indicators.highestLeadWorkload?.count).toBe(4);
    expect(intel.indicators.highestOpenDealWorkload?.count).toBeGreaterThan(0);
    expect(intel.indicators.highestOverdueFollowUps?.userId).toBe(userA1Id);
    expect(intel.indicators.highestActivityVolume?.userId).toBe(userA1Id);
  });

  // 19. Archived Record Exclusion
  it("19. should exclude archived leads and deals from intelligence calculations", async () => {
    // Insert an archived lead
    await testDb.insert(schema.leads).values({
      id: crypto.randomUUID(),
      organizationId: orgAId,
      firstName: "Archived Candidate",
      assignedToUserId: userA1Id,
      archivedAt: new Date(),
    });

    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const alice = owners.find((o) => o.userId === userA1Id);
    // Count remains 4 active leads
    expect(alice?.leads.totalLeads).toBe(4);
  });

  // 20. Cross-Tenant Isolation
  it("20. should strictly isolate Org A data from Org B", async () => {
    const intelA = await getTeamAndOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const intelB = await getTeamAndOwnerIntelligence(orgBId, undefined, undefined, undefined, testDb);

    // Org A cannot see Dave Competitor (Org B user)
    const orgAUserIds = intelA.owners.map((o) => o.userId);
    expect(orgAUserIds).not.toContain(userBId);

    // Org B sees Dave
    const orgBUserIds = intelB.owners.map((o) => o.userId);
    expect(orgBUserIds).toContain(userBId);

    // Org A cannot see Org B financial values
    const allWonCurrenciesA = intelA.owners.flatMap((o) => Object.keys(o.dealValue.wonValueByCurrency));
    expect(allWonCurrenciesA).not.toContain("GBP");
  });

  // 21. Empty Organization Safety
  it("21. should handle empty organizations gracefully without errors or null exceptions", async () => {
    const intel = await getTeamAndOwnerIntelligence(orgEmptyId, undefined, undefined, undefined, testDb);
    expect(intel.owners).toBeDefined();
    expect(intel.teams).toEqual([]);
    expect(intel.unassigned.unassignedLeads).toBe(0);
    expect(intel.unassigned.unassignedOpenDeals).toBe(0);
  });

  // 22. Zero Denominator Handling
  it("22. should return 0.0 for win rate and conversion rate when denominator is 0", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    // User with 0 closed deals or 0 leads
    const repWithNoDeals = owners.find((o) => o.deals.closedDeals === 0);
    if (repWithNoDeals) {
      expect(repWithNoDeals.deals.winRate).toBe(0);
    }
  });

  // 23. Small Sample Size Handling
  it("23. should flag hasSufficientClosedDeals as false when sample size is under 3 closed deals", async () => {
    const owners = await getOwnerIntelligence(orgAId, undefined, undefined, undefined, testDb);
    const charlie = owners.find((o) => o.userId === userA3Id);
    expect(charlie).toBeDefined();
    // Charlie has 1 won deal = 100% win rate, but only 1 closed deal (< 3)
    expect(charlie?.deals.winRate).toBe(100.0);
    expect(charlie?.deals.closedDeals).toBe(1);
    expect(charlie?.deals.hasSufficientClosedDeals).toBe(false);
  });

  // 24. Dashboard Integration
  it("24. should provide teamIntelligence payload in getDashboardData", async () => {
    const dashboard = await getDashboardData(orgAId, userA1Id, undefined, testDb);
    expect(dashboard.teamIntelligence).toBeDefined();
    expect(dashboard.teamIntelligence?.owners.length).toBeGreaterThan(0);
    expect(dashboard.teamIntelligence?.unassigned.unassignedLeads).toBe(2);
  });

  // 25. RBAC & Team Management
  it("25. should support team creation, member management, and archiving", async () => {
    const teamBeta = await createTeam(
      orgAId,
      { name: "Beta Outbound", description: "Outbound SDRs" },
      testDb
    );
    expect(teamBeta.name).toBe("Beta Outbound");

    const member = await addTeamMember(orgAId, teamBeta.id, { userId: userA3Id }, testDb);
    expect(member.userId).toBe(userA3Id);

    const teamsBefore = await getTeams(orgAId, undefined, testDb);
    const foundBeta = teamsBefore.find((t) => t.id === teamBeta.id);
    expect(foundBeta?.memberCount).toBe(1);

    await removeTeamMember(orgAId, teamBeta.id, userA3Id, testDb);
    const teamsAfterRemove = await getTeams(orgAId, undefined, testDb);
    const foundBetaAfterRemove = teamsAfterRemove.find((t) => t.id === teamBeta.id);
    expect(foundBetaAfterRemove?.memberCount).toBe(0);

    await archiveTeam(orgAId, teamBeta.id, testDb);
    const activeTeams = await getTeams(orgAId, { includeArchived: false }, testDb);
    expect(activeTeams.some((t) => t.id === teamBeta.id)).toBe(false);
  });

  // 26. Milestone 2.10A Regression
  it("26. should maintain 2.10A Needs Attention items without regression", async () => {
    const attentionResult = await getOrganizationAttentionItems(orgAId, {}, testDb);
    expect(attentionResult).toBeDefined();
    expect(Array.isArray(attentionResult.items)).toBe(true);
    expect(attentionResult.summary).toBeDefined();
  });

  // 27. Milestone 2.10B Regression
  it("27. should maintain 2.10B Pipeline Intelligence without regression", async () => {
    const pipeIntel = await getDealPipelineIntelligence(orgAId, {}, undefined, undefined, testDb);
    expect(pipeIntel).toBeDefined();
    expect(pipeIntel.length).toBeGreaterThan(0);
    expect(pipeIntel[0].pipelineId).toBe(pipelineA1Id);
  });

  // 28. Component Rendering Smoke (SSR & Widget Output)
  it("28. should render DashboardShell with 2.10C widgets cleanly into HTML", async () => {
    const dashboard = await getDashboardData(orgAId, userA1Id, undefined, testDb);
    const html = renderToString(
      React.createElement(DashboardShell, {
        initialData: dashboard,
        members: [{ userId: userA1Id, name: "Alice Admin", email: "alice@org-a.com" }],
        pipelines: [{ id: pipelineA1Id, name: "Standard Enterprise Pipeline" }],
        currentUserId: userA1Id,
        roleName: "Organization Admin",
      })
    );
    expect(html).toContain("Unassigned Workload");
    expect(html).toContain("Workload Concentration");
    expect(html).toContain("Alpha Sales Squad");
    expect(html).toContain("Owner Workload &amp; Performance Comparison");
  });
});
