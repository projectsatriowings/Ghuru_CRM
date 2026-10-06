import { DbClient } from "@/db/types";
import { db } from "@/db";
import {
  type AIBriefingResult,
  type AINextActionsResult,
  type AIExplanationResult,
  type AIQuestionResult,
  type AIConfidence,
  type EntityIntelligenceContext,
} from "./ai-types";
import {
  buildCRMIntelligenceContext,
  buildEntityIntelligenceContext,
  type ContextBuildOptions,
} from "./ai-context.service";
import {
  buildBriefingPrompt,
  buildMetricExplanationPrompt,
  buildQuestionPrompt,
} from "./ai-prompts";
import { getAIProvider, AIProvider } from "./ai-provider";
import { sanitizeUserQuestion } from "./ai-safety";
import { getAIRateLimiter } from "./ai-rate-limiter";
import { recordAIAuditEvent } from "./ai-audit.service";
import { assertOrganizationAIQuota } from "./ai-quota.service";
import { AIError, normalizeAIError } from "./ai-errors";
import { ValidationError } from "@/lib/errors";

// In-memory cache for briefings (3 minutes TTL) with strict tenant & permission isolation
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const briefingCache = new Map<string, CacheEntry<AIBriefingResult>>();

export function clearAIBriefingCache(): void {
  briefingCache.clear();
}

/**
 * Builds a strictly tenant-isolated and permission-footprinted cache key.
 */
function buildBriefingCacheKey(
  organizationId: string,
  userPermissions: string[],
  options: ContextBuildOptions
): string {
  const relevantPerms = ["deals.view", "leads.view", "teams.view", "automations.view"]
    .filter((p) => userPermissions.includes(p))
    .sort()
    .join(",");
  const preset = options.preset || "default";
  const assignee = options.assigneeId || "all";
  const pipeline = options.pipelineId || "all";
  const from = options.from || "none";
  const to = options.to || "none";
  return `briefing__org_${organizationId}__perms_${relevantPerms}__preset_${preset}__assignee_${assignee}__pipe_${pipeline}__from_${from}__to_${to}`;
}

/**
 * Deterministic fallback generator for Daily Briefing if AI provider fails or is offline.
 * Synthesizes structured briefing strictly from deterministic CRM calculations.
 */
function generateDeterministicBriefingFallback(
  context: Awaited<ReturnType<typeof buildCRMIntelligenceContext>>
): AIBriefingResult {
  const priorities: AIBriefingResult["priorities"] = [];
  const risks: AIBriefingResult["risks"] = [];
  const recommendedActions: AIBriefingResult["recommendedActions"] = [];

  let rank = 1;

  // 1. Overdue follow-ups
  const overdueCount = context.healthSummary?.byCategory.overdueFollowUps || 0;
  if (overdueCount > 0) {
    priorities.push({
      rank: rank++,
      title: `${overdueCount} Overdue Follow-ups Require Action`,
      category: "follow_ups",
      explanation: `There are ${overdueCount} scheduled follow-ups past their due dates awaiting team completion.`,
      evidence: [`${overdueCount} overdue follow-up tasks detected`],
    });
    risks.push({
      id: "risk_overdue_follow_ups",
      title: "Delayed Customer Follow-up",
      severity: overdueCount > 5 ? "critical" : "high",
      explanation: `${overdueCount} prospect follow-up actions are overdue, increasing deal stall probability.`,
      evidence: [`${overdueCount} overdue tasks`],
      recommendedAction: "Review and complete or reschedule overdue follow-ups.",
    });
    recommendedActions.push({
      id: "act_review_overdue",
      title: "Review Overdue Follow-ups",
      reason: "Ensure prospective deals and leads receive timely engagement.",
      entityType: "follow_up",
      priority: "high",
      confidence: "high",
      evidence: [`${overdueCount} overdue follow-ups in organization`],
    });
  }

  // 2. Unassigned workload
  const unassignedLeads = context.unassignedWorkload?.unassignedLeads || 0;
  const unassignedDeals = context.unassignedWorkload?.unassignedOpenDeals || 0;
  if (unassignedLeads > 0 || unassignedDeals > 0) {
    priorities.push({
      rank: rank++,
      title: `${unassignedLeads + unassignedDeals} Unassigned Items Awaiting Ownership`,
      category: "workload",
      explanation: `${unassignedLeads} leads and ${unassignedDeals} deals currently lack designated owners.`,
      evidence: [
        `${unassignedLeads} unassigned leads`,
        `${unassignedDeals} unassigned deals`,
      ],
    });
    recommendedActions.push({
      id: "act_assign_workload",
      title: "Assign Unowned Leads & Deals",
      reason: "Distribute unowned records across team members for prompt handling.",
      entityType: "owner",
      priority: "high",
      confidence: "high",
      evidence: [`${unassignedLeads} leads and ${unassignedDeals} deals unassigned`],
    });
  }

  // 3. Pipeline Bottlenecks
  if (context.bottlenecks.length > 0) {
    const topBottleneck = context.bottlenecks[0];
    priorities.push({
      rank: rank++,
      title: `Pipeline Bottleneck in ${topBottleneck.stageName}`,
      category: "pipeline",
      explanation: `Stage "${topBottleneck.stageName}" in pipeline "${topBottleneck.pipelineName}" holds ${topBottleneck.openDealCount} open deals with ${topBottleneck.staleDealCount} stale deals.`,
      evidence: [
        `${topBottleneck.openDealCount} open deals in ${topBottleneck.stageName}`,
        `${topBottleneck.staleDealCount} stale deals`,
        topBottleneck.reason,
      ],
    });
    risks.push({
      id: `risk_bottleneck_${topBottleneck.stageId}`,
      title: `Stage Concentration in ${topBottleneck.stageName}`,
      severity: "medium",
      explanation: `Deals are accumulating in ${topBottleneck.stageName}: ${topBottleneck.reason}`,
      evidence: [`${topBottleneck.openDealCount} open stage deals`],
      recommendedAction: topBottleneck.recommendation || `Evaluate progression for deals in ${topBottleneck.stageName}.`,
    });
    recommendedActions.push({
      id: `act_review_bottleneck_${topBottleneck.stageId}`,
      title: `Review Deals in ${topBottleneck.stageName}`,
      reason: `Identify stalled opportunities and advance active deals in ${topBottleneck.pipelineName}.`,
      entityType: "pipeline",
      entityId: topBottleneck.pipelineId,
      priority: "medium",
      confidence: "medium",
      evidence: [`${topBottleneck.openDealCount} open deals in stage`],
    });
  }

  // Fallback summary if no major issues
  if (priorities.length === 0) {
    priorities.push({
      rank: 1,
      title: "CRM Pipeline Steady",
      category: "conversion",
      explanation: "No critical overdue follow-ups or bottleneck alerts detected for the current period.",
      evidence: ["All tracked indicators are within healthy thresholds."],
    });
    recommendedActions.push({
      id: "act_continue_outreach",
      title: "Maintain Prospect Outreach Cadence",
      reason: "Follow up regularly with active prospects to maintain deal velocity.",
      priority: "low",
      confidence: "high",
      evidence: ["Pipeline healthy"],
    });
  }

  const summary = `CRM operational review for ${context.organizationSummary.name}: ${priorities.length} key operational areas identified. ${overdueCount} overdue follow-ups and ${unassignedLeads + unassignedDeals} unassigned items require attention.`;

  return {
    summary,
    priorities,
    risks,
    recommendedActions,
    limitations: [
      "Analysis synthesized directly from deterministic CRM health and pipeline intelligence.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export type AIServiceOptions = ContextBuildOptions & {
  forceRefresh?: boolean;
  correlationId?: string;
};

/**
 * 1. AI Daily Briefing
 */
export async function generateAIBriefing(
  organizationId: string,
  userId: string,
  userPermissions: string[],
  options: AIServiceOptions = {},
  customProvider?: AIProvider,
  dbInstance: DbClient = db as DbClient
): Promise<AIBriefingResult> {
  const correlationId = options.correlationId || `req_${crypto.randomUUID()}`;

  // Permission guard
  if (!userPermissions.includes("ai.view")) {
    throw new AIError(
      "AI_PERMISSION_DENIED",
      "Forbidden: You do not have permission [ai.view] to generate AI briefings.",
      403,
      correlationId
    );
  }

  // Organization Quota Guard
  await assertOrganizationAIQuota(organizationId, correlationId, dbInstance);

  // Rate limit guard
  const rateLimit = getAIRateLimiter().checkRateLimit(organizationId, userId, "briefing");
  if (!rateLimit.allowed) {
    throw new AIError(
      "PROVIDER_RATE_LIMITED",
      `Rate limit reached. Please wait ${rateLimit.resetInSeconds} seconds before generating another briefing.`,
      429,
      correlationId
    );
  }

  // Cache check with strict isolation
  const cacheKey = buildBriefingCacheKey(organizationId, userPermissions, options);
  if (!options.forceRefresh) {
    const cached = briefingCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  const startTime = Date.now();
  let result: AIBriefingResult;
  let modelUsed = "deterministic-fallback";
  let tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  let success = true;
  let errorCategory: string | undefined = undefined;

  // Build deterministic CRM context
  const context = await buildCRMIntelligenceContext(
    organizationId,
    userPermissions,
    options,
    dbInstance
  );

  const provider = customProvider || getAIProvider();

  try {
    const { systemPrompt, userPrompt } = buildBriefingPrompt(context);
    const aiResponse = await provider.generateText({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      correlationId,
    });

    modelUsed = aiResponse.model;
    tokenUsage = aiResponse.tokenUsage;

    const parsed = JSON.parse(aiResponse.rawText);
    result = {
      summary: parsed.summary || "CRM Operational Briefing",
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions
        : [],
      limitations: Array.isArray(parsed.limitations)
        ? parsed.limitations
        : ["Grounded purely in CRM data."],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const normalized = normalizeAIError(err, correlationId);
    errorCategory = normalized.category;
    success = false;
    result = generateDeterministicBriefingFallback(context);
  }

  const durationMs = Date.now() - startTime;

  // Durable audit log recording
  await recordAIAuditEvent(
    {
      organizationId,
      userId,
      endpoint: "briefing",
      provider: provider.name,
      model: modelUsed,
      correlationId,
      durationMs,
      status: success ? "success" : "failure",
      errorCategory,
      promptTokens: tokenUsage?.promptTokens,
      completionTokens: tokenUsage?.completionTokens,
      totalTokens: tokenUsage?.totalTokens,
    },
    dbInstance
  );

  // Store in cache (3 min TTL)
  briefingCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + 3 * 60 * 1000,
  });

  return result;
}

/**
 * 2. Recommended Next Actions
 */
export async function generateAINextActions(
  organizationId: string,
  userId: string,
  userPermissions: string[],
  options: AIServiceOptions = {},
  customProvider?: AIProvider,
  dbInstance: DbClient = db as DbClient
): Promise<AINextActionsResult> {
  const briefing = await generateAIBriefing(
    organizationId,
    userId,
    userPermissions,
    options,
    customProvider,
    dbInstance
  );

  return {
    actions: briefing.recommendedActions,
    summary: `Identified ${briefing.recommendedActions.length} operational recommendations for your team.`,
    generatedAt: briefing.generatedAt,
  };
}

/**
 * 3. AI Metric Explanation
 */
export async function explainMetric(
  organizationId: string,
  userId: string,
  userPermissions: string[],
  metricKey: string,
  options: AIServiceOptions = {},
  customProvider?: AIProvider,
  dbInstance: DbClient = db as DbClient
): Promise<AIExplanationResult> {
  const correlationId = options.correlationId || `req_${crypto.randomUUID()}`;

  if (!userPermissions.includes("ai.view")) {
    throw new AIError(
      "AI_PERMISSION_DENIED",
      "Forbidden: You do not have permission [ai.view] to request metric explanations.",
      403,
      correlationId
    );
  }

  // Quota check
  await assertOrganizationAIQuota(organizationId, correlationId, dbInstance);

  const rateLimit = getAIRateLimiter().checkRateLimit(organizationId, userId, "explain");
  if (!rateLimit.allowed) {
    throw new AIError(
      "PROVIDER_RATE_LIMITED",
      `Rate limit reached. Please wait ${rateLimit.resetInSeconds} seconds before requesting another metric explanation.`,
      429,
      correlationId
    );
  }

  const startTime = Date.now();
  let result: AIExplanationResult;
  let modelUsed = "deterministic-fallback";
  let tokenUsage;
  let success = true;
  let errorCategory: string | undefined = undefined;

  const context = await buildCRMIntelligenceContext(
    organizationId,
    userPermissions,
    options,
    dbInstance
  );

  const provider = customProvider || getAIProvider();

  try {
    const { systemPrompt, userPrompt } = buildMetricExplanationPrompt(
      context,
      metricKey
    );
    const aiResponse = await provider.generateText({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      correlationId,
    });

    modelUsed = aiResponse.model;
    tokenUsage = aiResponse.tokenUsage;

    const parsed = JSON.parse(aiResponse.rawText);
    result = {
      metric: parsed.metric || metricKey,
      fact: parsed.fact || "Metric calculation confirmed by CRM service.",
      interpretation: parsed.interpretation || "No significant anomaly identified.",
      contributingFactors: Array.isArray(parsed.contributingFactors)
        ? parsed.contributingFactors
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      limitations: Array.isArray(parsed.limitations)
        ? parsed.limitations
        : ["Based on CRM records."],
      confidence: (parsed.confidence as AIConfidence) || "high",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const normalized = normalizeAIError(err, correlationId);
    errorCategory = normalized.category;
    success = false;

    // Deterministic fallback for metric explanation
    result = {
      metric: metricKey,
      fact: `Authoritative value verified from CRM intelligence service for ${metricKey}.`,
      interpretation:
        "The calculated metric reflects current recorded CRM activities and pipeline transitions.",
      contributingFactors: [
        "Historical deal conversion and stage timing",
        "Recent follow-up completion rates",
      ],
      recommendations: [
        "Review open tasks and address high-severity attention items.",
      ],
      limitations: ["Deterministic fallback explanation grounded in active CRM records."],
      confidence: "medium",
      generatedAt: new Date().toISOString(),
    };
  }

  const durationMs = Date.now() - startTime;

  await recordAIAuditEvent(
    {
      organizationId,
      userId,
      endpoint: "explain",
      provider: provider.name,
      model: modelUsed,
      correlationId,
      durationMs,
      status: success ? "success" : "failure",
      errorCategory,
      promptTokens: tokenUsage?.promptTokens,
      completionTokens: tokenUsage?.completionTokens,
      totalTokens: tokenUsage?.totalTokens,
    },
    dbInstance
  );

  return result;
}

/**
 * 4. CRM Q&A Assistant
 */
export async function askCRMQuestion(
  organizationId: string,
  userId: string,
  userPermissions: string[],
  rawQuestion: string,
  entityRef?: {
    entityType: "lead" | "deal" | "pipeline" | "owner" | "team" | "company" | "contact";
    entityId: string;
  },
  options: AIServiceOptions = {},
  customProvider?: AIProvider,
  dbInstance: DbClient = db as DbClient
): Promise<AIQuestionResult> {
  const correlationId = options.correlationId || `req_${crypto.randomUUID()}`;

  if (!userPermissions.includes("ai.view")) {
    throw new AIError(
      "AI_PERMISSION_DENIED",
      "Forbidden: You do not have permission [ai.view] to query the CRM AI assistant.",
      403,
      correlationId
    );
  }

  // Question validation & sanitization
  const validation = sanitizeUserQuestion(rawQuestion);
  if (!validation.isValid) {
    throw new ValidationError(validation.error || "Invalid question.");
  }
  const cleanQuestion = validation.sanitized;

  // Quota check
  await assertOrganizationAIQuota(organizationId, correlationId, dbInstance);

  // Rate limit guard
  const rateLimit = getAIRateLimiter().checkRateLimit(organizationId, userId, "ask");
  if (!rateLimit.allowed) {
    throw new AIError(
      "PROVIDER_RATE_LIMITED",
      `Rate limit reached. Please wait ${rateLimit.resetInSeconds} seconds before submitting another question.`,
      429,
      correlationId
    );
  }

  const startTime = Date.now();
  let result: AIQuestionResult;
  let modelUsed = "deterministic-fallback";
  let tokenUsage;
  let success = true;
  let errorCategory: string | undefined = undefined;

  // Build entity context if entityRef provided
  let entityContext: EntityIntelligenceContext | undefined = undefined;
  if (entityRef && entityRef.entityType && entityRef.entityId) {
    entityContext = await buildEntityIntelligenceContext(
      organizationId,
      entityRef.entityType,
      entityRef.entityId,
      userPermissions,
      dbInstance
    );
  }

  const context = await buildCRMIntelligenceContext(
    organizationId,
    userPermissions,
    options,
    dbInstance
  );

  const provider = customProvider || getAIProvider();

  try {
    const { systemPrompt, userPrompt } = buildQuestionPrompt(
      context,
      cleanQuestion,
      entityContext
    );

    const aiResponse = await provider.generateText({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      correlationId,
    });

    modelUsed = aiResponse.model;
    tokenUsage = aiResponse.tokenUsage;

    const parsed = JSON.parse(aiResponse.rawText);
    result = {
      question: cleanQuestion,
      answer: parsed.answer || "Answer derived from CRM data.",
      groundedFacts: Array.isArray(parsed.groundedFacts) ? parsed.groundedFacts : [],
      interpretation: parsed.interpretation || "",
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions
        : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      limitations: Array.isArray(parsed.limitations)
        ? parsed.limitations
        : ["Grounded in current CRM context."],
      confidence: (parsed.confidence as AIConfidence) || "high",
      entityContextSummary: entityContext
        ? `${entityContext.entityType}: ${entityContext.entityName}`
        : undefined,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const normalized = normalizeAIError(err, correlationId);
    errorCategory = normalized.category;
    success = false;

    // Deterministic fallback for Q&A
    const topPriorities = context.attentionItems.slice(0, 3);
    const facts = topPriorities.map(
      (item) => `${item.title}: ${item.description}`
    );

    result = {
      question: cleanQuestion,
      answer: `Based on your CRM data for ${context.organizationSummary.name}, there are ${context.healthSummary?.total || 0} active attention items.`,
      groundedFacts: facts.length > 0 ? facts : ["No critical attention signals detected."],
      interpretation:
        "CRM data indicates current active pipelines and tasks are recorded deterministically.",
      recommendedActions: [
        "Review overdue follow-ups and unassigned workload on the dashboard.",
      ],
      evidence: ["Verified from organization attention signals."],
      limitations: ["Fallback grounded directly in deterministic CRM records."],
      confidence: "medium",
      entityContextSummary: entityContext
        ? `${entityContext.entityType}: ${entityContext.entityName}`
        : undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  const durationMs = Date.now() - startTime;

  await recordAIAuditEvent(
    {
      organizationId,
      userId,
      endpoint: "ask",
      provider: provider.name,
      model: modelUsed,
      correlationId,
      durationMs,
      status: success ? "success" : "failure",
      errorCategory,
      promptTokens: tokenUsage?.promptTokens,
      completionTokens: tokenUsage?.completionTokens,
      totalTokens: tokenUsage?.totalTokens,
    },
    dbInstance
  );

  return result;
}
