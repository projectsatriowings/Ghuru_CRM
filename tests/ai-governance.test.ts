import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToString } from "react-dom/server";
import { AIGovernanceView } from "@/components/settings/ai-governance/ai-governance-view";

import { createOrganization } from "@/lib/services/organization.service";
import { createPipeline, createStage } from "@/lib/services/pipeline.service";
import { createLead, getLeads } from "@/lib/services/lead.service";
import { createDeal, getDeals } from "@/lib/services/deal.service";
import {
  recordAIAuditEvent,
  getOrganizationAIAuditLogs,
} from "@/lib/services/ai/ai-audit.service";
import {
  getOrganizationAISettings,
  getOrganizationAIUsage,
  assertOrganizationAIQuota,
  updateOrganizationAISettings,
} from "@/lib/services/ai/ai-quota.service";
import {
  getAIGovernanceSummary,
  getOrganizationAIAuditLogsPaginated,
  getAIErrorSummary,
  getAIUsageByEndpoint,
  getAIUsageByUser,
} from "@/lib/services/ai/ai-governance.service";
import { getSafePublicAIConfig } from "@/lib/services/ai/ai-config";
import { AIError } from "@/lib/services/ai/ai-errors";
import { updateAISettingsSchema } from "@/lib/validations/ai-governance";

describe("Milestone 2.10F — AI Governance & Administration Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userA1Id: string; // Org A Admin
  let userA2Id: string; // Org A Member
  let userB1Id: string; // Org B Admin
  let orgAId: string;
  let orgBId: string;
  let pipelineAId: string;
  let stageAId: string;

  beforeAll(async () => {
    // 1. Initialize PGlite database
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migrations
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
      "0015_puzzling_swarm.sql",
      "0016_salty_the_liberteens.sql",
      "0017_minor_starfox.sql",
      "0018_mute_boom_boom.sql",
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
    userB1Id = crypto.randomUUID();

    await testDb.insert(schema.users).values([
      { id: userA1Id, name: "Alice Admin", email: "alice@org-a.com" },
      { id: userA2Id, name: "Bob Sales", email: "bob@org-a.com" },
      { id: userB1Id, name: "Charlie Beta", email: "charlie@org-b.com" },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Acme Enterprises", slug: "acme-enterprises", userId: userA1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta Global", slug: "beta-global", userId: userB1Id },
      testDb
    );
    orgBId = orgB.organization.id;

    // Add Bob to Org A
    await testDb.insert(schema.organizationMembers).values({
      id: crypto.randomUUID(),
      organizationId: orgAId,
      userId: userA2Id,
      roleId: orgA.role.id,
    });

    // 5. Setup Pipelines & CRM records in Org A
    const pipe = await createPipeline(orgAId, { name: "Direct Sales" }, testDb);
    pipelineAId = pipe.id;
    const s1 = await createStage(orgAId, pipelineAId, { name: "Discovery", displayOrder: 1 }, testDb);
    stageAId = s1.id;

    await createLead(
      orgAId,
      {
        firstName: "Stark",
        lastName: "Industries",
        email: "tony@stark.com",
        source: "website",
        status: "new",
        pipelineId: pipelineAId,
        stageId: stageAId,
      },
      testDb
    );

    await createDeal(
      orgAId,
      {
        name: "Enterprise Arc Reactor Deal",
        pipelineId: pipelineAId,
        pipelineStageId: stageAId,
        currency: "USD",
        value: 500000,
        status: "open",
      },
      testDb
    );
  });

  describe("1. RBAC & AI Governance Permissions", () => {
    it("assigns ai_governance.view and ai_governance.manage to Organization Admin role", async () => {
      // Organization Admin in Org A should have the newly created permissions
      const adminRole = await testDb
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.organizationId, orgAId));
      expect(adminRole.length).toBeGreaterThan(0);

      const rolePerms = await testDb
        .select()
        .from(schema.rolePermissions)
        .where(eq(schema.rolePermissions.roleId, adminRole[0].id));

      const permIds = rolePerms.map((rp: { permissionId: string }) => rp.permissionId);
      expect(permIds).toContain("perm_ai_governance_view");
      expect(permIds).toContain("perm_ai_governance_manage");
    });
  });

  describe("2. Tenant Isolation & Audit Storage", () => {
    beforeEach(async () => {
      // Clear audit events before test
      await testDb.delete(schema.aiAuditEvents);
    });

    it("strictly isolates audit logs between Organization A and Organization B", async () => {
      // Record 3 events in Org A
      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA1Id,
          endpoint: "briefing",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_org_a_1",
          durationMs: 450,
          status: "success",
          promptTokens: 120,
          completionTokens: 80,
          totalTokens: 200,
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA2Id,
          endpoint: "next-actions",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_org_a_2",
          durationMs: 310,
          status: "success",
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        testDb
      );

      // Record 2 events in Org B
      await recordAIAuditEvent(
        {
          organizationId: orgBId,
          userId: userB1Id,
          endpoint: "explain",
          provider: "mock",
          model: "mock-model",
          correlationId: "corr_org_b_1",
          durationMs: 120,
          status: "success",
          promptTokens: 50,
          completionTokens: 30,
          totalTokens: 80,
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgBId,
          userId: userB1Id,
          endpoint: "ask",
          provider: "mock",
          model: "mock-model",
          correlationId: "corr_org_b_2",
          durationMs: 200,
          status: "failure",
          errorCategory: "PROVIDER_TIMEOUT",
        },
        testDb
      );

      // Fetch logs for Org A
      const logsA = await getOrganizationAIAuditLogsPaginated(orgAId, {}, testDb);
      expect(logsA.items).toHaveLength(2);
      expect(logsA.pagination.totalCount).toBe(2);
      expect(logsA.items.every((i) => i.organizationId === orgAId)).toBe(true);
      expect(logsA.items.map((i) => i.correlationId)).not.toContain("corr_org_b_1");
      expect(logsA.items.map((i) => i.correlationId)).not.toContain("corr_org_b_2");

      // Fetch logs for Org B
      const logsB = await getOrganizationAIAuditLogsPaginated(orgBId, {}, testDb);
      expect(logsB.items).toHaveLength(2);
      expect(logsB.pagination.totalCount).toBe(2);
      expect(logsB.items.every((i) => i.organizationId === orgBId)).toBe(true);
      expect(logsB.items.map((i) => i.correlationId)).not.toContain("corr_org_a_1");
      expect(logsB.items.map((i) => i.correlationId)).not.toContain("corr_org_a_2");
    });

    it("strictly isolates usage metrics between Organization A and Organization B", async () => {
      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA1Id,
          endpoint: "briefing",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_a_1",
          durationMs: 300,
          status: "success",
          totalTokens: 400,
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgBId,
          userId: userB1Id,
          endpoint: "ask",
          provider: "mock",
          model: "mock-model",
          correlationId: "corr_b_1",
          durationMs: 150,
          status: "success",
          totalTokens: 100,
        },
        testDb
      );

      const usageA = await getOrganizationAIUsage(orgAId, testDb);
      const usageB = await getOrganizationAIUsage(orgBId, testDb);

      expect(usageA.totalRequests).toBe(1);
      expect(usageA.totalTokensConsumed).toBe(400);
      expect(usageA.byEndpoint["briefing"]).toBe(1);
      expect(usageA.byEndpoint["ask"]).toBeUndefined();

      expect(usageB.totalRequests).toBe(1);
      expect(usageB.totalTokensConsumed).toBe(100);
      expect(usageB.byEndpoint["ask"]).toBe(1);
      expect(usageB.byEndpoint["briefing"]).toBeUndefined();
    });

    it("strictly isolates user capacity breakdowns between organizations", async () => {
      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA1Id,
          endpoint: "briefing",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_a_1",
          durationMs: 300,
          status: "success",
          totalTokens: 250,
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgBId,
          userId: userB1Id,
          endpoint: "explain",
          provider: "mock",
          model: "mock-model",
          correlationId: "corr_b_1",
          durationMs: 120,
          status: "success",
          totalTokens: 80,
        },
        testDb
      );

      const usersA = await getAIUsageByUser(orgAId, testDb);
      expect(usersA).toHaveLength(1);
      expect(usersA[0].userId).toBe(userA1Id);
      expect(usersA[0].userName).toBe("Alice Admin");

      const usersB = await getAIUsageByUser(orgBId, testDb);
      expect(usersB).toHaveLength(1);
      expect(usersB[0].userId).toBe(userB1Id);
      expect(usersB[0].userName).toBe("Charlie Beta");
    });
  });

  describe("3. Operational Governance Summary & Aggregations", () => {
    beforeEach(async () => {
      await testDb.delete(schema.aiAuditEvents);

      // Seed realistic operational data in Org A
      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA1Id,
          endpoint: "briefing",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_seed_1",
          durationMs: 500,
          status: "success",
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA2Id,
          endpoint: "next-actions",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_seed_2",
          durationMs: 400,
          status: "success",
          promptTokens: 150,
          completionTokens: 50,
          totalTokens: 200,
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA2Id,
          endpoint: "explain",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_seed_3",
          durationMs: 120,
          status: "failure",
          errorCategory: "PROVIDER_TIMEOUT",
        },
        testDb
      );

      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA1Id,
          endpoint: "ask",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_seed_4",
          durationMs: 80,
          status: "failure",
          errorCategory: "AI_REQUEST_LIMIT_EXCEEDED",
        },
        testDb
      );
    });

    it("aggregates total, successful, failed requests, and token volume accurately", async () => {
      const summary = await getAIGovernanceSummary(orgAId, testDb);

      expect(summary.organizationId).toBe(orgAId);
      expect(summary.usage.totalRequests).toBe(4);
      expect(summary.usage.successfulRequests).toBe(2);
      expect(summary.usage.failedRequests).toBe(2);
      expect(summary.usage.totalTokensConsumed).toBe(500);
      expect(summary.usage.dailyUsage.used).toBe(4);
      expect(summary.usage.dailyUsage.limit).toBeGreaterThan(0);
      expect(summary.usage.monthlyUsage.used).toBe(4);
      expect(summary.usage.monthlyUsage.limit).toBeGreaterThan(0);
    });

    it("aggregates deterministic error categories and identifies affected endpoints", async () => {
      const errors = await getAIErrorSummary(orgAId, testDb);

      expect(errors).toHaveLength(2);
      const timeoutError = errors.find((e) => e.errorCategory === "PROVIDER_TIMEOUT");
      expect(timeoutError).toBeDefined();
      expect(timeoutError!.count).toBe(1);
      expect(timeoutError!.affectedEndpoints).toContain("explain");

      const quotaError = errors.find((e) => e.errorCategory === "AI_REQUEST_LIMIT_EXCEEDED");
      expect(quotaError).toBeDefined();
      expect(quotaError!.count).toBe(1);
      expect(quotaError!.affectedEndpoints).toContain("ask");
    });

    it("aggregates usage by endpoint with request and token counts", async () => {
      const endpoints = await getAIUsageByEndpoint(orgAId, testDb);

      expect(endpoints.length).toBe(4);
      const briefingEp = endpoints.find((e) => e.endpoint === "briefing");
      expect(briefingEp).toBeDefined();
      expect(briefingEp!.totalRequests).toBe(1);
      expect(briefingEp!.successfulRequests).toBe(1);
      expect(briefingEp!.totalTokens).toBe(300);

      const explainEp = endpoints.find((e) => e.endpoint === "explain");
      expect(explainEp).toBeDefined();
      expect(explainEp!.totalRequests).toBe(1);
      expect(explainEp!.failedRequests).toBe(1);
    });

    it("aggregates usage by member without employee scoring or surveillance attributes", async () => {
      const userUsage = await getAIUsageByUser(orgAId, testDb);

      expect(userUsage.length).toBe(2);
      const userA1 = userUsage.find((u) => u.userId === userA1Id);
      expect(userA1).toBeDefined();
      expect(userA1!.userName).toBe("Alice Admin");
      expect(userA1!.totalRequests).toBe(2);
      expect(userA1!.successfulRequests).toBe(1);
      expect(userA1!.failedRequests).toBe(1);

      // Verify absence of any surveillance/HR scoring fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawUserObj = userA1 as any;
      expect(rawUserObj.productivityScore).toBeUndefined();
      expect(rawUserObj.rank).toBeUndefined();
      expect(rawUserObj.rating).toBeUndefined();
    });
  });

  describe("4. Audit Log Pagination & Filtering", () => {
    beforeEach(async () => {
      await testDb.delete(schema.aiAuditEvents);

      // Generate 15 distinct events in Org A
      for (let i = 1; i <= 15; i++) {
        await recordAIAuditEvent(
          {
            organizationId: orgAId,
            userId: i % 2 === 0 ? userA2Id : userA1Id,
            endpoint: i <= 5 ? "briefing" : i <= 10 ? "next-actions" : "ask",
            provider: "openai-compatible",
            model: "gpt-4o-mini",
            correlationId: `corr_page_${i.toString().padStart(2, "0")}`,
            durationMs: 100 * i,
            status: i % 4 === 0 ? "failure" : "success",
            errorCategory: i % 4 === 0 ? "PROVIDER_TIMEOUT" : undefined,
            totalTokens: i * 50,
          },
          testDb
        );
      }
    });

    it("paginates audit logs with server-side page and pageSize controls", async () => {
      const page1 = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { page: 1, pageSize: 5 },
        testDb
      );

      expect(page1.items).toHaveLength(5);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.pageSize).toBe(5);
      expect(page1.pagination.totalCount).toBe(15);
      expect(page1.pagination.totalPages).toBe(3);

      const page2 = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { page: 2, pageSize: 5 },
        testDb
      );

      expect(page2.items).toHaveLength(5);
      expect(page2.pagination.page).toBe(2);
      // Items must be distinct across pages
      const idsPage1 = new Set(page1.items.map((i) => i.id));
      expect(page2.items.every((i) => !idsPage1.has(i.id))).toBe(true);
    });

    it("filters audit logs by endpoint", async () => {
      const result = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { endpoint: "briefing" },
        testDb
      );

      expect(result.items.length).toBe(5);
      expect(result.items.every((i) => i.endpoint === "briefing")).toBe(true);
    });

    it("filters audit logs by status (success vs failure)", async () => {
      const failures = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { status: "failure" },
        testDb
      );

      // In 15 items, indices 4, 8, 12 failed (3 failures)
      expect(failures.items.length).toBe(3);
      expect(failures.items.every((i) => i.status === "failure")).toBe(true);
      expect(failures.items.every((i) => i.errorCategory === "PROVIDER_TIMEOUT")).toBe(true);
    });

    it("filters audit logs by user ID", async () => {
      const userA2Logs = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { userId: userA2Id },
        testDb
      );

      expect(userA2Logs.items.length).toBe(7); // Even indices 2, 4, 6, 8, 10, 12, 14
      expect(userA2Logs.items.every((i) => i.userId === userA2Id)).toBe(true);
      expect(userA2Logs.items.every((i) => i.userName === "Bob Sales")).toBe(true);
    });

    it("filters audit logs by correlation ID", async () => {
      const result = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { correlationId: "corr_page_07" },
        testDb
      );

      expect(result.items.length).toBe(1);
      expect(result.items[0].correlationId).toBe("corr_page_07");
    });

    it("returns empty items array cleanly when no matches exist", async () => {
      const result = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { endpoint: "non_existent_endpoint" },
        testDb
      );

      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe("5. Organization AI Limit Settings & Policy Enforcement", () => {
    it("reads default quotas when organization settings are uncustomized", async () => {
      const settings = await getOrganizationAISettings(orgAId, testDb);
      expect(settings.aiEnabled).toBe(true);
      expect(settings.dailyRequestLimit).toBe(100);
      expect(settings.monthlyRequestLimit).toBe(2000);
    });

    it("updates daily and monthly limits with tenant isolation", async () => {
      const updated = await updateOrganizationAISettings(
        orgAId,
        { dailyRequestLimit: 250, monthlyRequestLimit: 5000 },
        testDb
      );

      expect(updated.dailyRequestLimit).toBe(250);
      expect(updated.monthlyRequestLimit).toBe(5000);

      // Verify Org B remains at default and was not affected
      const settingsB = await getOrganizationAISettings(orgBId, testDb);
      expect(settingsB.dailyRequestLimit).toBe(100);
      expect(settingsB.monthlyRequestLimit).toBe(2000);
    });

    it("validates limits strictly and rejects negative numbers, zero, or excessive bounds", () => {
      // Negative limit
      const neg = updateAISettingsSchema.safeParse({ dailyRequestLimit: -10 });
      expect(neg.success).toBe(false);

      // Zero limit
      const zero = updateAISettingsSchema.safeParse({ dailyRequestLimit: 0 });
      expect(zero.success).toBe(false);

      // Float / non-integer
      const float = updateAISettingsSchema.safeParse({ dailyRequestLimit: 25.5 });
      expect(float.success).toBe(false);

      // Exceeds upper bound
      const excessive = updateAISettingsSchema.safeParse({ dailyRequestLimit: 200000 });
      expect(excessive.success).toBe(false);

      // Empty payload
      const empty = updateAISettingsSchema.safeParse({});
      expect(empty.success).toBe(false);

      // Valid payload
      const valid = updateAISettingsSchema.safeParse({
        aiEnabled: false,
        dailyRequestLimit: 50,
      });
      expect(valid.success).toBe(true);
    });

    it("safely disables AI for an organization and causes assertOrganizationAIQuota to fail gracefully", async () => {
      // Disable AI in Org A
      await updateOrganizationAISettings(orgAId, { aiEnabled: false }, testDb);

      const settings = await getOrganizationAISettings(orgAId, testDb);
      expect(settings.aiEnabled).toBe(false);

      // assertOrganizationAIQuota should throw AIError with normalized message
      let errorThrown: AIError | null = null;
      try {
        await assertOrganizationAIQuota(orgAId, "corr_test_disabled", testDb);
      } catch (err) {
        if (err instanceof AIError) {
          errorThrown = err;
        }
      }

      expect(errorThrown).not.toBeNull();
      expect(errorThrown!.message).toContain(
        "AI intelligence is currently disabled for this organization. Standard CRM intelligence remains available."
      );
      expect(errorThrown!.statusCode).toBe(403);

      // Re-enable AI
      await updateOrganizationAISettings(orgAId, { aiEnabled: true }, testDb);
      const reenabled = await getOrganizationAISettings(orgAId, testDb);
      expect(reenabled.aiEnabled).toBe(true);
    });

    it("guarantees standard CRM functionality is unaffected when AI is disabled", async () => {
      // 1. Disable AI in Org A
      await updateOrganizationAISettings(orgAId, { aiEnabled: false }, testDb);

      // 2. Leads service remains fully functional
      const leads = await getLeads(orgAId, {}, testDb);
      expect(leads.data.length).toBeGreaterThan(0);

      // 3. Deals service remains fully functional
      const deals = await getDeals(orgAId, {}, testDb);
      expect(deals.data.length).toBeGreaterThan(0);

      // 4. Restore AI enabled state
      await updateOrganizationAISettings(orgAId, { aiEnabled: true }, testDb);
    });
  });

  describe("6. Security, Credential & Prompt Leak Prevention", () => {
    it("never returns API keys or raw base URLs in public configuration", () => {
      const publicConfig = getSafePublicAIConfig();
      expect(publicConfig).toBeDefined();
      expect(publicConfig.model).toBeDefined();
      expect(publicConfig.providerType).toBeDefined();
      expect(publicConfig.isConfigured).toBeDefined();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawObj = publicConfig as any;
      expect(rawObj.apiKey).toBeUndefined();
      expect(rawObj.baseUrl).toBeUndefined();
      expect(rawObj.authorization).toBeUndefined();
      expect(rawObj.token).toBeUndefined();
    });

    it("never returns raw prompt text or CRM context through audit records", async () => {
      await recordAIAuditEvent(
        {
          organizationId: orgAId,
          userId: userA1Id,
          endpoint: "briefing",
          provider: "openai-compatible",
          model: "gpt-4o-mini",
          correlationId: "corr_security_audit",
          durationMs: 320,
          status: "success",
          promptTokens: 250,
          completionTokens: 100,
          totalTokens: 350,
        },
        testDb
      );

      const logs = await getOrganizationAIAuditLogs(orgAId, { limit: 10 }, testDb);
      expect(logs.length).toBeGreaterThan(0);

      for (const log of logs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = log as any;
        expect(raw.prompt).toBeUndefined();
        expect(raw.promptText).toBeUndefined();
        expect(raw.systemPrompt).toBeUndefined();
        expect(raw.completion).toBeUndefined();
        expect(raw.crmContext).toBeUndefined();
        expect(raw.lead).toBeUndefined();
        expect(raw.deal).toBeUndefined();
        expect(raw.apiKey).toBeUndefined();
      }
    });

    it("never returns raw prompt text or CRM notes through paginated audit logs", async () => {
      const paginated = await getOrganizationAIAuditLogsPaginated(
        orgAId,
        { correlationId: "corr_security_audit" },
        testDb
      );

      expect(paginated.items.length).toBe(1);
      const item = paginated.items[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = item as any;
      expect(raw.prompt).toBeUndefined();
      expect(raw.promptText).toBeUndefined();
      expect(raw.crmNotes).toBeUndefined();
      expect(raw.systemPrompt).toBeUndefined();
      expect(raw.apiKey).toBeUndefined();
    });
  });

  describe("7. Component Rendering Smoke (SSR & UI Output)", () => {
    it("renders AIGovernanceView cleanly to static HTML without crashing", async () => {
      const summary = await getAIGovernanceSummary(orgAId, testDb);
      const auditLogs = await getOrganizationAIAuditLogsPaginated(orgAId, { page: 1, pageSize: 25 }, testDb);

      const html = renderToString(
        React.createElement(AIGovernanceView, {
          initialSummary: summary,
          initialAuditLogs: auditLogs,
          canManage: true,
        })
      );

      expect(html).toContain("AI Governance &amp; Quota Administration");
      expect(html).toContain("AI Provider &amp; System Status");
      expect(html).toContain("Daily Request Quota");
      expect(html).toContain("Monthly Request Quota");

      const auditHtml = renderToString(
        React.createElement((await import("@/components/settings/ai-governance/ai-audit-log-table")).AIAuditLogTable, {
          initialData: auditLogs,
        })
      );
      expect(auditHtml).toContain("AI Operational Audit Trail");
    });
  });
});

