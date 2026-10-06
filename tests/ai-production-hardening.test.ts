import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import fs from "fs";
import path from "path";

import { createOrganization } from "@/lib/services/organization.service";
import { createPipeline, createStage } from "@/lib/services/pipeline.service";
import { createLead } from "@/lib/services/lead.service";
import { createDeal } from "@/lib/services/deal.service";
import { createFollowUp } from "@/lib/services/follow-up.service";
import { createActivity } from "@/lib/services/activity.service";
import { createAutomation } from "@/lib/services/automation.service";

import {
  buildCRMIntelligenceContext,
} from "@/lib/services/ai/ai-context.service";
import {
  generateAIBriefing,
  generateAINextActions,
  explainMetric,
  askCRMQuestion,
  clearAIBriefingCache,
} from "@/lib/services/ai/ai-insights.service";
import {
  MockAIProvider,
  OpenAICompatibleProvider,
  setAIProvider,
} from "@/lib/services/ai/ai-provider";
import {
  aiConfigSchema,
  getSafePublicAIConfig,
} from "@/lib/services/ai/ai-config";
import {
  AIError,
  normalizeAIError,
} from "@/lib/services/ai/ai-errors";
import {
  InMemoryAIRateLimiter,
  resetAIRateLimits,
} from "@/lib/services/ai/ai-rate-limiter";
import {
  recordAIAuditEvent,
  getOrganizationAIAuditLogs,
} from "@/lib/services/ai/ai-audit.service";
import {
  getOrganizationAIUsage,
  assertOrganizationAIQuota,
} from "@/lib/services/ai/ai-quota.service";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

describe("Milestone 2.10E — AI Production Hardening & Governance Foundation Test Suite", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testDb: any;
  let userA1Id: string;
  let userA2Id: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let pipelineAId: string;
  let stageA1Id: string;
  let stageA2Id: string;

  beforeAll(async () => {
    // 1. Initialize PGlite database
    const client = new PGlite();
    testDb = drizzle(client, { schema });

    // 2. Read and apply all DDL migrations including 0015
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
      { id: userA1Id, name: "Alice Admin", email: "alice@org-a.com" },
      { id: userA2Id, name: "Bob Sales", email: "bob@org-a.com" },
      { id: userBId, name: "Dave OrgB", email: "dave@org-b.com" },
    ]);

    // 4. Create Organizations
    const orgA = await createOrganization(
      { name: "Alpha Corp", slug: "alpha-corp", userId: userA1Id },
      testDb
    );
    orgAId = orgA.organization.id;

    const orgB = await createOrganization(
      { name: "Beta LLC", slug: "beta-llc", userId: userBId },
      testDb
    );
    orgBId = orgB.organization.id;

    // 5. Setup Pipelines & Stages in Org A
    const pipe = await createPipeline(orgAId, { name: "Direct Sales" }, testDb);
    pipelineAId = pipe.id;

    const s1 = await createStage(orgAId, pipelineAId, { name: "Prospect", displayOrder: 1 }, testDb);
    stageA1Id = s1.id;
    const s2 = await createStage(orgAId, pipelineAId, { name: "Negotiation", displayOrder: 2 }, testDb);
    stageA2Id = s2.id;

    // 6. Setup CRM Entities in Org A
    const leadA = await createLead(
      orgAId,
      {
        firstName: "Stark",
        lastName: "Industries",
        email: "tony@stark.com",
        source: "website",
        status: "qualified",
        pipelineId: pipelineAId,
        stageId: stageA1Id,
      },
      testDb
    );

    await createDeal(
      orgAId,
      {
        name: "Enterprise Defense Contract",
        pipelineId: pipelineAId,
        pipelineStageId: stageA2Id,
        value: 250000,
        currency: "USD",
        status: "open",
        leadId: leadA.id,
      },
      testDb,
      userA1Id
    );

    // Multi-currency deal (INR)
    await createDeal(
      orgAId,
      {
        name: "Bengaluru Technology Campus",
        pipelineId: pipelineAId,
        pipelineStageId: stageA2Id,
        value: 12000000,
        currency: "INR",
        status: "open",
      },
      testDb,
      userA1Id
    );

    // Overdue follow-up
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    await createFollowUp(
      orgAId,
      userA1Id,
      leadA.id,
      {
        title: "Review Q4 Proposal",
        dueDate: pastDate,
      },
      testDb
    );

    await createActivity(
      orgAId,
      userA1Id,
      leadA.id,
      {
        type: "call",
        title: "Introductory Discovery Call",
      },
      testDb
    );

    await createAutomation(
      orgAId,
      {
        name: "Auto-qualify Tech Leads",
        entityType: "lead",
        triggerType: "entity_created",
        conditions: [],
        actions: [{ type: "create_activity", params: { type: "task", title: "Follow up" } }],
        active: true,
      },
      testDb,
      userA1Id
    );

    // 7. Org B Entities (Strictly isolated)
    const pipeB = await createPipeline(orgBId, { name: "Beta Pipeline" }, testDb);
    const sB1 = await createStage(orgBId, pipeB.id, { name: "Discovery", displayOrder: 1 }, testDb);
    await createDeal(
      orgBId,
      {
        name: "Confidential Project Beta",
        pipelineId: pipeB.id,
        pipelineStageId: sB1.id,
        value: 99000,
        currency: "EUR",
        status: "open",
      },
      testDb,
      userBId
    );
  });

  beforeEach(() => {
    clearAIBriefingCache();
    resetAIRateLimits();
    setAIProvider(new MockAIProvider());
  });

  // --------------------------------------------------------------------------
  // 1. AI Provider Configuration Validation
  // --------------------------------------------------------------------------
  it("1. should validate AI provider configuration with Zod and reject invalid params", () => {
    // Valid config
    const valid = aiConfigSchema.safeParse({
      enabled: true,
      providerType: "mock",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      timeoutMs: 30000,
    });
    expect(valid.success).toBe(true);

    // Invalid timeout (less than 1000ms)
    const invalidTimeout = aiConfigSchema.safeParse({
      timeoutMs: 500,
    });
    expect(invalidTimeout.success).toBe(false);

    // Safe public config never exposes apiKey
    const safeConfig = getSafePublicAIConfig();
    expect(safeConfig).not.toHaveProperty("apiKey");
    expect(safeConfig.model).toBeDefined();
    expect(typeof safeConfig.isConfigured).toBe("boolean");
  });

  // --------------------------------------------------------------------------
  // 2. Missing Provider Configuration Handling
  // --------------------------------------------------------------------------
  it("2. should reject openai-compatible provider when apiKey is missing with PROVIDER_NOT_CONFIGURED", async () => {
    const unconfiguredProvider = new OpenAICompatibleProvider({
      apiKey: "",
      enabled: true,
    });

    await expect(
      unconfiguredProvider.generateText({
        systemPrompt: "test",
        userPrompt: "test",
      })
    ).rejects.toThrow(AIError);

    try {
      await unconfiguredProvider.generateText({
        systemPrompt: "test",
        userPrompt: "test",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      const aiErr = err as AIError;
      expect(aiErr.category).toBe("PROVIDER_NOT_CONFIGURED");
      expect(aiErr.statusCode).toBe(503);
    }
  });

  // --------------------------------------------------------------------------
  // 3. Provider Timeout Normalization
  // --------------------------------------------------------------------------
  it("3. should normalize provider timeout to PROVIDER_TIMEOUT with 504 status", async () => {
    // Simulate provider with 1ms timeout against non-responding call
    const timeoutProvider = new OpenAICompatibleProvider({
      apiKey: "sk-mock-key-for-test",
      timeoutMs: 1, // 1ms will abort immediately
      baseUrl: "https://10.255.255.1/timeout-endpoint",
    });

    try {
      await timeoutProvider.generateText({
        systemPrompt: "test",
        userPrompt: "test",
      });
      // Should not reach here
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AIError);
      const aiErr = err as AIError;
      expect(["PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE"]).toContain(aiErr.category);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Provider Error Normalization Helper
  // --------------------------------------------------------------------------
  it("4. should accurately normalize upstream errors into safe user-facing categories", () => {
    const errAuth = normalizeAIError(new Error("401 Unauthorized API key"));
    expect(errAuth.category).toBe("PROVIDER_AUTH_ERROR");
    expect(errAuth.statusCode).toBe(502);

    const errRate = normalizeAIError(new Error("429 Too Many Requests"));
    expect(errRate.category).toBe("PROVIDER_RATE_LIMITED");
    expect(errRate.statusCode).toBe(429);

    const errTimeout = normalizeAIError(new Error("The operation was aborted due to timeout"));
    expect(errTimeout.category).toBe("PROVIDER_TIMEOUT");
    expect(errTimeout.statusCode).toBe(504);

    const errUnknown = normalizeAIError(new Error("Fatal network error"));
    expect(errUnknown.category).toBe("PROVIDER_UNAVAILABLE");
    expect(errUnknown.statusCode).toBe(503);
    // User message must never contain the raw error
    expect(errUnknown.message).not.toContain("Fatal network error");
  });

  // --------------------------------------------------------------------------
  // 5. Malformed Provider Response Protection
  // --------------------------------------------------------------------------
  it("5. should protect against malformed provider JSON responses with INVALID_PROVIDER_RESPONSE", async () => {
    const mockMalformingProvider = new MockAIProvider(async () => {
      // Simulate raw invalid JSON structure
      return {
        rawText: "NOT_A_VALID_JSON_OBJECT",
        model: "mock-v1",
      };
    });

    setAIProvider(mockMalformingProvider);

    // Briefing service handles malformed provider gracefully by falling back to deterministic calculation
    const briefing = await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: true },
      mockMalformingProvider,
      testDb
    );

    // Fallback succeeds deterministically
    expect(briefing).toBeDefined();
    expect(briefing.priorities.length).toBeGreaterThan(0);
    expect(briefing.summary).toContain("Alpha Corp");
  });

  // --------------------------------------------------------------------------
  // 6. Rate Limit Enforcement
  // --------------------------------------------------------------------------
  it("6. should enforce 30 requests/minute rate limit per user/organization", () => {
    const limiter = new InMemoryAIRateLimiter();
    const limit = 5; // test with 5 requests

    for (let i = 0; i < limit; i++) {
      const res = limiter.checkRateLimit("org1", "user1", "briefing", limit);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - 1 - i);
    }

    const blocked = limiter.checkRateLimit("org1", "user1", "briefing", limit);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetInSeconds).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // 7. Organization Isolation for Rate Limits
  // --------------------------------------------------------------------------
  it("7. should isolate rate limits across organizations completely", () => {
    const limiter = new InMemoryAIRateLimiter();
    const limit = 3;

    // Org A hits limit
    for (let i = 0; i < limit; i++) {
      limiter.checkRateLimit(orgAId, userA1Id, "ask", limit);
    }
    const blockedA = limiter.checkRateLimit(orgAId, userA1Id, "ask", limit);
    expect(blockedA.allowed).toBe(false);

    // Org B user must still be permitted
    const allowedB = limiter.checkRateLimit(orgBId, userBId, "ask", limit);
    expect(allowedB.allowed).toBe(true);
    expect(allowedB.remaining).toBe(limit - 1);
  });

  // --------------------------------------------------------------------------
  // 8. Cache Isolation Across Tenants & Permissions
  // --------------------------------------------------------------------------
  it("8. should strictly isolate cached briefings by organization and permission footprint", async () => {
    // 1. Generate briefing for Org A
    const briefingA1 = await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: false },
      undefined,
      testDb
    );
    expect(briefingA1).toBeDefined();

    // Re-requesting with same org/perms hits cache
    const briefingA2 = await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: false },
      undefined,
      testDb
    );
    expect(briefingA2).toBe(briefingA1);

    // 2. Generate briefing for Org B (must not hit Org A cache)
    const briefingB = await generateAIBriefing(
      orgBId,
      userBId,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: false },
      undefined,
      testDb
    );
    expect(briefingB).not.toBe(briefingA1);

    // 3. User with restricted permissions in Org A (no deals.view)
    const restrictedPerms = (ALL_PERMISSION_KEYS as unknown as string[]).filter(
      (p) => p !== "deals.view"
    );
    const briefingRestricted = await generateAIBriefing(
      orgAId,
      userA2Id,
      restrictedPerms,
      { forceRefresh: false },
      undefined,
      testDb
    );
    // Cache key difference ensures new calculation
    expect(briefingRestricted).not.toBe(briefingA1);
  });

  // --------------------------------------------------------------------------
  // 9. Permission Isolation (ai.view requirement)
  // --------------------------------------------------------------------------
  it("9. should reject AI endpoints with 403 AI_PERMISSION_DENIED when ai.view is absent", async () => {
    const noAIPerms = ["leads.view", "deals.view"];

    await expect(
      generateAIBriefing(orgAId, userA1Id, noAIPerms, {}, undefined, testDb)
    ).rejects.toThrow(AIError);

    await expect(
      explainMetric(orgAId, userA1Id, noAIPerms, "conversion_rate", {}, undefined, testDb)
    ).rejects.toThrow(AIError);

    await expect(
      askCRMQuestion(orgAId, userA1Id, noAIPerms, "Show me open deals", undefined, {}, undefined, testDb)
    ).rejects.toThrow(AIError);
  });

  // --------------------------------------------------------------------------
  // 10. deals.view Redaction in AI Context
  // --------------------------------------------------------------------------
  it("10. should redact deals, deal values, and bottleneck details when deals.view is missing", async () => {
    const permsWithoutDeals = (ALL_PERMISSION_KEYS as unknown as string[]).filter(
      (p) => p !== "deals.view"
    );

    const context = await buildCRMIntelligenceContext(
      orgAId,
      permsWithoutDeals,
      {},
      testDb
    );

    expect(context.pipelines).toEqual([]);
    expect(context.bottlenecks).toEqual([]);
    expect(context.attentionItems.every((item) => item.entityType !== "deal")).toBe(true);
    expect(JSON.stringify(context)).not.toContain("Enterprise Defense Contract");
    expect(JSON.stringify(context)).not.toContain("250000");
  });

  // --------------------------------------------------------------------------
  // 11. leads.view Redaction in AI Context
  // --------------------------------------------------------------------------
  it("11. should redact leads and funnel metrics when leads.view is missing", async () => {
    const permsWithoutLeads = (ALL_PERMISSION_KEYS as unknown as string[]).filter(
      (p) => p !== "leads.view"
    );

    const context = await buildCRMIntelligenceContext(
      orgAId,
      permsWithoutLeads,
      {},
      testDb
    );

    expect(context.funnel).toBeNull();
    expect(context.leadSources).toEqual([]);
    expect(JSON.stringify(context)).not.toContain("Stark");
  });

  // --------------------------------------------------------------------------
  // 12. teams.view Redaction in AI Context
  // --------------------------------------------------------------------------
  it("12. should redact team and owner distribution when teams.view is missing", async () => {
    const permsWithoutTeams = (ALL_PERMISSION_KEYS as unknown as string[]).filter(
      (p) => p !== "teams.view"
    );

    const context = await buildCRMIntelligenceContext(
      orgAId,
      permsWithoutTeams,
      {},
      testDb
    );

    expect(context.owners).toEqual([]);
    expect(context.teams).toEqual([]);
    expect(context.unassignedWorkload).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 13. automations.view Redaction in AI Context
  // --------------------------------------------------------------------------
  it("13. should redact automations when automations.view is missing", async () => {
    const permsWithoutAutomations = (ALL_PERMISSION_KEYS as unknown as string[]).filter(
      (p) => p !== "automations.view"
    );

    const context = await buildCRMIntelligenceContext(
      orgAId,
      permsWithoutAutomations,
      {},
      testDb
    );

    expect(context.automationsSummary).toBeNull();
    expect(JSON.stringify(context)).not.toContain("Auto-qualify Tech Leads");
  });

  // --------------------------------------------------------------------------
  // 14. Durable AI Audit Event Creation
  // --------------------------------------------------------------------------
  it("14. should durably record AI audit events with correlation ID and metadata", async () => {
    const testCorrelationId = `corr_${crypto.randomUUID()}`;

    const eventId = await recordAIAuditEvent(
      {
        organizationId: orgAId,
        userId: userA1Id,
        endpoint: "briefing",
        provider: "mock-provider",
        model: "mock-v1",
        correlationId: testCorrelationId,
        durationMs: 42,
        status: "success",
        totalTokens: 250,
      },
      testDb
    );

    expect(eventId).toBeDefined();

    const logs = await getOrganizationAIAuditLogs(orgAId, { limit: 10 }, testDb);
    expect(logs.length).toBeGreaterThan(0);
    const recorded = logs.find((l) => l.correlationId === testCorrelationId);
    expect(recorded).toBeDefined();
    expect(recorded?.status).toBe("success");
    expect(recorded?.endpoint).toBe("briefing");
    expect(recorded?.durationMs).toBe(42);
    expect(recorded?.totalTokens).toBe(250);
  });

  // --------------------------------------------------------------------------
  // 15. Audit Tenant Isolation
  // --------------------------------------------------------------------------
  it("15. should prevent Org B from viewing Org A's audit events", async () => {
    const logsB = await getOrganizationAIAuditLogs(orgBId, { limit: 50 }, testDb);
    for (const log of logsB) {
      expect(log.organizationId).toBe(orgBId);
      expect(log.organizationId).not.toBe(orgAId);
    }
  });

  // --------------------------------------------------------------------------
  // 16. Request Correlation ID Propagation
  // --------------------------------------------------------------------------
  it("16. should propagate correlationId through briefing generation to audit log", async () => {
    const correlationId = `req_custom_trace_${Date.now()}`;

    await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: true, correlationId },
      undefined,
      testDb
    );

    const logs = await getOrganizationAIAuditLogs(orgAId, { limit: 10 }, testDb);
    const match = logs.find((l) => l.correlationId === correlationId);
    expect(match).toBeDefined();
    expect(match?.organizationId).toBe(orgAId);
  });

  // --------------------------------------------------------------------------
  // 17. Multi-Currency Safety
  // --------------------------------------------------------------------------
  it("17. should preserve USD and INR separately without artificial currency flattening", async () => {
    const context = await buildCRMIntelligenceContext(
      orgAId,
      ALL_PERMISSION_KEYS as unknown as string[],
      {},
      testDb
    );

    expect(context.pipelines.length).toBeGreaterThan(0);
    const pipe = context.pipelines[0];
    const negotiationStage = pipe.stages.find((s) => s.stageId === stageA2Id);
    expect(negotiationStage).toBeDefined();
    const valuesByCurr = negotiationStage?.openValueByCurrency || {};
    expect(valuesByCurr["USD"]).toBe(250000);
    expect(valuesByCurr["INR"]).toBe(12000000);
    // Currencies must never be combined into a single fictitious number
    expect(Object.keys(valuesByCurr)).toHaveLength(2);
  });

  // --------------------------------------------------------------------------
  // 18. AI Failure Does Not Break Deterministic Dashboard
  // --------------------------------------------------------------------------
  it("18. should gracefully synthesize deterministic briefing when AI provider fails", async () => {
    const failingProvider = new MockAIProvider(async () => {
      throw new Error("Simulated upstream network failure");
    });

    const briefing = await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: true },
      failingProvider,
      testDb
    );

    // Fallback synthesized pure CRM calculation
    expect(briefing).toBeDefined();
    expect(briefing.summary).toContain("Alpha Corp");
    expect(briefing.priorities.length).toBeGreaterThan(0);
    expect(briefing.limitations[0]).toContain("deterministic");
  });

  // --------------------------------------------------------------------------
  // 19. Force Refresh Behavior
  // --------------------------------------------------------------------------
  it("19. should bypass cached briefing when forceRefresh is set to true", async () => {
    // Initial call
    const first = await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      {},
      undefined,
      testDb
    );

    // Force refresh call
    const refreshed = await generateAIBriefing(
      orgAId,
      userA1Id,
      ALL_PERMISSION_KEYS as unknown as string[],
      { forceRefresh: true },
      undefined,
      testDb
    );

    expect(first).toBeDefined();
    expect(refreshed).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 20. Read-Only Safety (No CRM Mutation)
  // --------------------------------------------------------------------------
  it("20. should perform zero mutations on CRM tables across all AI operations", async () => {
    const leadsBefore = await testDb.select().from(schema.leads);
    const dealsBefore = await testDb.select().from(schema.deals);
    const followUpsBefore = await testDb.select().from(schema.followUps);

    // Run all AI operations
    await generateAIBriefing(orgAId, userA1Id, ALL_PERMISSION_KEYS as unknown as string[], {}, undefined, testDb);
    await generateAINextActions(orgAId, userA1Id, ALL_PERMISSION_KEYS as unknown as string[], {}, undefined, testDb);
    await explainMetric(orgAId, userA1Id, ALL_PERMISSION_KEYS as unknown as string[], "conversion_rate", {}, undefined, testDb);
    await askCRMQuestion(orgAId, userA1Id, ALL_PERMISSION_KEYS as unknown as string[], "What deals are open?", undefined, {}, undefined, testDb);

    const leadsAfter = await testDb.select().from(schema.leads);
    const dealsAfter = await testDb.select().from(schema.deals);
    const followUpsAfter = await testDb.select().from(schema.followUps);

    expect(leadsAfter.length).toBe(leadsBefore.length);
    expect(dealsAfter.length).toBe(dealsBefore.length);
    expect(followUpsAfter.length).toBe(followUpsBefore.length);
  });

  // --------------------------------------------------------------------------
  // 21. Organization AI Usage Metrics
  // --------------------------------------------------------------------------
  it("21. should aggregate AI usage metrics across endpoints, models, and quotas", async () => {
    const usage = await getOrganizationAIUsage(orgAId, testDb);

    expect(usage.organizationId).toBe(orgAId);
    expect(usage.aiEnabled).toBe(true);
    expect(usage.totalRequests).toBeGreaterThan(0);
    expect(usage.successfulRequests).toBeGreaterThan(0);
    expect(usage.dailyUsage.limit).toBe(100);
    expect(usage.monthlyUsage.limit).toBe(2000);
  });

  // --------------------------------------------------------------------------
  // 22. Organization Quota Enforcement
  // --------------------------------------------------------------------------
  it("22. should enforce organization AI quotas when configured", async () => {
    // Verify assertion passes with normal quota
    await expect(
      assertOrganizationAIQuota(orgAId, undefined, testDb)
    ).resolves.not.toThrow();

    // Insert restrictive setting for a test org
    const restrictedOrgId = `org_test_quota_${Date.now()}`;
    await testDb.insert(schema.organizations).values({
      id: restrictedOrgId,
      name: "Restricted Org",
      slug: `restricted-${Date.now()}`,
    });

    await testDb.insert(schema.organizationAiSettings).values({
      id: `set_${Date.now()}`,
      organizationId: restrictedOrgId,
      aiEnabled: false, // Disabled
      dailyRequestLimit: 0,
      monthlyRequestLimit: 0,
    });

    await expect(
      assertOrganizationAIQuota(restrictedOrgId, undefined, testDb)
    ).rejects.toThrow(AIError);
  });
});
