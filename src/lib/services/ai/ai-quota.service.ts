import { eq, and, gte } from "drizzle-orm";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import { aiAuditEvents, organizationAiSettings } from "@/db/schema/ai-audit";
import { AIError } from "./ai-errors";

export interface OrganizationAIUsageSummary {
  organizationId: string;
  aiEnabled: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensConsumed: number;
  byEndpoint: Record<string, number>;
  byModel: Record<string, number>;
  dailyUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
  monthlyUsage: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface OrganizationAISettingsRecord {
  organizationId: string;
  aiEnabled: boolean;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
}

const DEFAULT_DAILY_LIMIT = 100;
const DEFAULT_MONTHLY_LIMIT = 2000;

/**
 * Retrieves the organization's configured AI governance settings,
 * falling back to secure defaults if not customized.
 */
export async function getOrganizationAISettings(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationAISettingsRecord> {
  try {
    const [settings] = await dbInstance
      .select()
      .from(organizationAiSettings)
      .where(eq(organizationAiSettings.organizationId, organizationId))
      .limit(1);

    if (settings) {
      return {
        organizationId: settings.organizationId,
        aiEnabled: settings.aiEnabled,
        dailyRequestLimit: settings.dailyRequestLimit,
        monthlyRequestLimit: settings.monthlyRequestLimit,
      };
    }
  } catch (err) {
    // If table not present or transient error, use defaults
    console.warn("[AIQuota] Failed to read organization settings:", err);
  }

  return {
    organizationId,
    aiEnabled: true,
    dailyRequestLimit: DEFAULT_DAILY_LIMIT,
    monthlyRequestLimit: DEFAULT_MONTHLY_LIMIT,
  };
}

/**
 * Validates that an organization is permitted to make an AI request
 * under its current daily and monthly quotas.
 */
export async function assertOrganizationAIQuota(
  organizationId: string,
  correlationId?: string,
  dbInstance: DbClient = db as DbClient
): Promise<void> {
  const settings = await getOrganizationAISettings(organizationId, dbInstance);

  if (!settings.aiEnabled) {
    throw new AIError(
      "AI_REQUEST_LIMIT_EXCEEDED",
      "AI intelligence is disabled for this organization by administrative policy.",
      403,
      correlationId
    );
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    // Check daily usage
    const dailyEvents = await dbInstance
      .select({ id: aiAuditEvents.id })
      .from(aiAuditEvents)
      .where(
        and(
          eq(aiAuditEvents.organizationId, organizationId),
          gte(aiAuditEvents.createdAt, startOfDay)
        )
      );

    if (dailyEvents.length >= settings.dailyRequestLimit) {
      throw new AIError(
        "AI_REQUEST_LIMIT_EXCEEDED",
        `Daily AI request quota reached for this organization (${dailyEvents.length}/${settings.dailyRequestLimit}).`,
        429,
        correlationId
      );
    }

    // Check monthly usage
    const monthlyEvents = await dbInstance
      .select({ id: aiAuditEvents.id })
      .from(aiAuditEvents)
      .where(
        and(
          eq(aiAuditEvents.organizationId, organizationId),
          gte(aiAuditEvents.createdAt, startOfMonth)
        )
      );

    if (monthlyEvents.length >= settings.monthlyRequestLimit) {
      throw new AIError(
        "AI_REQUEST_LIMIT_EXCEEDED",
        `Monthly AI request quota reached for this organization (${monthlyEvents.length}/${settings.monthlyRequestLimit}).`,
        429,
        correlationId
      );
    }
  } catch (err) {
    if (err instanceof AIError) {
      throw err;
    }
    // Fail-open on database query errors to avoid breaking the core CRM
    console.warn("[AIQuota] Could not verify audit quota count, failing open:", err);
  }
}

/**
 * Summarizes AI usage metrics for an organization across endpoints, models, and quotas.
 */
export async function getOrganizationAIUsage(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<OrganizationAIUsageSummary> {
  const settings = await getOrganizationAISettings(organizationId, dbInstance);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let events: Array<{
    endpoint: string;
    model: string;
    status: string;
    totalTokens: number | null;
    createdAt: Date;
  }> = [];

  try {
    events = await dbInstance
      .select({
        endpoint: aiAuditEvents.endpoint,
        model: aiAuditEvents.model,
        status: aiAuditEvents.status,
        totalTokens: aiAuditEvents.totalTokens,
        createdAt: aiAuditEvents.createdAt,
      })
      .from(aiAuditEvents)
      .where(eq(aiAuditEvents.organizationId, organizationId));
  } catch (err) {
    console.warn("[AIQuota] Could not fetch audit events for usage summary:", err);
  }

  let successfulRequests = 0;
  let failedRequests = 0;
  let totalTokensConsumed = 0;
  const byEndpoint: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  let dailyUsed = 0;
  let monthlyUsed = 0;

  for (const event of events) {
    if (event.status === "success") {
      successfulRequests += 1;
    } else {
      failedRequests += 1;
    }

    if (event.totalTokens) {
      totalTokensConsumed += event.totalTokens;
    }

    byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;
    byModel[event.model] = (byModel[event.model] || 0) + 1;

    if (event.createdAt >= startOfDay) {
      dailyUsed += 1;
    }
    if (event.createdAt >= startOfMonth) {
      monthlyUsed += 1;
    }
  }

  return {
    organizationId,
    aiEnabled: settings.aiEnabled,
    totalRequests: events.length,
    successfulRequests,
    failedRequests,
    totalTokensConsumed,
    byEndpoint,
    byModel,
    dailyUsage: {
      used: dailyUsed,
      limit: settings.dailyRequestLimit,
      remaining: Math.max(0, settings.dailyRequestLimit - dailyUsed),
    },
    monthlyUsage: {
      used: monthlyUsed,
      limit: settings.monthlyRequestLimit,
      remaining: Math.max(0, settings.monthlyRequestLimit - monthlyUsed),
    },
  };
}
