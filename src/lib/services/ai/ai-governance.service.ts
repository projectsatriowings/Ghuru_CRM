import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import { aiAuditEvents } from "@/db/schema/ai-audit";
import { users } from "@/db/schema/users";
import { getSafePublicAIConfig } from "./ai-config";
import {
  getOrganizationAISettings,
  getOrganizationAIUsage,
  updateOrganizationAISettings,
} from "./ai-quota.service";
import {
  AIGovernanceSummary,
  AIGovernanceProviderStatus,
  AIErrorSummaryItem,
  AIEndpointUsageItem,
  AIUserUsageItem,
  PaginatedAIAuditLogs,
  AIAuditLogItem,
} from "@/lib/types/ai-governance";

export interface FilterAuditLogsOptions {
  page?: number;
  pageSize?: number;
  endpoint?: string;
  status?: "success" | "failure";
  errorCategory?: string;
  provider?: string;
  userId?: string;
  correlationId?: string;
  from?: string;
  to?: string;
}

/**
 * Retrieves paginated, filtered audit logs for an organization.
 * Strictly tenant isolated by organizationId.
 * Left-joins the users table to display user name/email.
 * NEVER returns raw prompts, completions, system prompts, or CRM record details.
 */
export async function getOrganizationAIAuditLogsPaginated(
  organizationId: string,
  options: FilterAuditLogsOptions = {},
  dbInstance: DbClient = db as DbClient
): Promise<PaginatedAIAuditLogs> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(Math.max(1, options.pageSize || 50), 100);
  const offset = (page - 1) * pageSize;

  const conditions = [eq(aiAuditEvents.organizationId, organizationId)];

  if (options.endpoint) {
    conditions.push(eq(aiAuditEvents.endpoint, options.endpoint));
  }
  if (options.status) {
    conditions.push(eq(aiAuditEvents.status, options.status));
  }
  if (options.errorCategory) {
    conditions.push(eq(aiAuditEvents.errorCategory, options.errorCategory));
  }
  if (options.provider) {
    conditions.push(eq(aiAuditEvents.provider, options.provider));
  }
  if (options.userId) {
    conditions.push(eq(aiAuditEvents.userId, options.userId));
  }
  if (options.correlationId) {
    conditions.push(eq(aiAuditEvents.correlationId, options.correlationId));
  }
  if (options.from) {
    const fromDate = new Date(options.from);
    if (!isNaN(fromDate.getTime())) {
      conditions.push(gte(aiAuditEvents.createdAt, fromDate));
    }
  }
  if (options.to) {
    const toDate = new Date(options.to);
    if (!isNaN(toDate.getTime())) {
      conditions.push(lte(aiAuditEvents.createdAt, toDate));
    }
  }

  const whereClause = and(...conditions);

  // Total count for pagination
  const [countResult] = await dbInstance
    .select({ total: count() })
    .from(aiAuditEvents)
    .where(whereClause);

  const totalCount = Number(countResult?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Fetch paginated rows with user info
  const rows = await dbInstance
    .select({
      id: aiAuditEvents.id,
      organizationId: aiAuditEvents.organizationId,
      userId: aiAuditEvents.userId,
      userName: users.name,
      userEmail: users.email,
      endpoint: aiAuditEvents.endpoint,
      provider: aiAuditEvents.provider,
      model: aiAuditEvents.model,
      correlationId: aiAuditEvents.correlationId,
      durationMs: aiAuditEvents.durationMs,
      status: aiAuditEvents.status,
      errorCategory: aiAuditEvents.errorCategory,
      promptTokens: aiAuditEvents.promptTokens,
      completionTokens: aiAuditEvents.completionTokens,
      totalTokens: aiAuditEvents.totalTokens,
      createdAt: aiAuditEvents.createdAt,
    })
    .from(aiAuditEvents)
    .leftJoin(users, eq(aiAuditEvents.userId, users.id))
    .where(whereClause)
    .orderBy(desc(aiAuditEvents.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: AIAuditLogItem[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    userId: r.userId,
    userName: r.userName || r.userEmail || "Unknown Member",
    userEmail: r.userEmail || "",
    endpoint: r.endpoint,
    provider: r.provider,
    model: r.model,
    correlationId: r.correlationId,
    durationMs: r.durationMs,
    status: r.status as "success" | "failure",
    errorCategory: r.errorCategory || null,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    items,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Summarizes deterministic error categories for an organization's AI failures.
 */
export async function getAIErrorSummary(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AIErrorSummaryItem[]> {
  try {
    const errorEvents = await dbInstance
      .select({
        errorCategory: aiAuditEvents.errorCategory,
        endpoint: aiAuditEvents.endpoint,
        createdAt: aiAuditEvents.createdAt,
      })
      .from(aiAuditEvents)
      .where(
        and(
          eq(aiAuditEvents.organizationId, organizationId),
          eq(aiAuditEvents.status, "failure")
        )
      )
      .orderBy(desc(aiAuditEvents.createdAt));

    const map = new Map<
      string,
      { count: number; lastOccurredAt: Date; endpoints: Set<string> }
    >();

    for (const ev of errorEvents) {
      const category = ev.errorCategory || "UNKNOWN_ERROR";
      const existing = map.get(category);
      if (!existing) {
        map.set(category, {
          count: 1,
          lastOccurredAt: ev.createdAt,
          endpoints: new Set([ev.endpoint]),
        });
      } else {
        existing.count += 1;
        existing.endpoints.add(ev.endpoint);
        if (ev.createdAt > existing.lastOccurredAt) {
          existing.lastOccurredAt = ev.createdAt;
        }
      }
    }

    return Array.from(map.entries())
      .map(([errorCategory, data]) => ({
        errorCategory,
        count: data.count,
        lastOccurredAt: data.lastOccurredAt.toISOString(),
        affectedEndpoints: Array.from(data.endpoints),
      }))
      .sort((a, b) => b.count - a.count);
  } catch (err) {
    console.warn("[AIGovernance] Failed to fetch error summary:", err);
    return [];
  }
}

/**
 * Summarizes AI usage by endpoint for an organization.
 */
export async function getAIUsageByEndpoint(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AIEndpointUsageItem[]> {
  try {
    const events = await dbInstance
      .select({
        endpoint: aiAuditEvents.endpoint,
        status: aiAuditEvents.status,
        totalTokens: aiAuditEvents.totalTokens,
      })
      .from(aiAuditEvents)
      .where(eq(aiAuditEvents.organizationId, organizationId));

    const map = new Map<
      string,
      { total: number; successful: number; failed: number; tokens: number }
    >();

    for (const ev of events) {
      const ep = ev.endpoint;
      const existing = map.get(ep) || {
        total: 0,
        successful: 0,
        failed: 0,
        tokens: 0,
      };
      existing.total += 1;
      if (ev.status === "success") {
        existing.successful += 1;
      } else {
        existing.failed += 1;
      }
      if (ev.totalTokens) {
        existing.tokens += ev.totalTokens;
      }
      map.set(ep, existing);
    }

    return Array.from(map.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        totalRequests: data.total,
        successfulRequests: data.successful,
        failedRequests: data.failed,
        totalTokens: data.tokens,
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  } catch (err) {
    console.warn("[AIGovernance] Failed to fetch endpoint usage:", err);
    return [];
  }
}

/**
 * Summarizes operational AI usage by member/user for an organization.
 * Used for operational governance, not employee scoring or surveillance.
 */
export async function getAIUsageByUser(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AIUserUsageItem[]> {
  try {
    const events = await dbInstance
      .select({
        userId: aiAuditEvents.userId,
        userName: users.name,
        userEmail: users.email,
        status: aiAuditEvents.status,
        totalTokens: aiAuditEvents.totalTokens,
        createdAt: aiAuditEvents.createdAt,
      })
      .from(aiAuditEvents)
      .leftJoin(users, eq(aiAuditEvents.userId, users.id))
      .where(eq(aiAuditEvents.organizationId, organizationId));

    const map = new Map<
      string,
      {
        userName: string;
        userEmail: string;
        total: number;
        successful: number;
        failed: number;
        tokens: number;
        lastActiveAt: Date;
      }
    >();

    for (const ev of events) {
      const uid = ev.userId;
      const existing = map.get(uid);
      const isSuccess = ev.status === "success";
      const tokenCount = ev.totalTokens || 0;

      if (!existing) {
        map.set(uid, {
          userName: ev.userName || ev.userEmail || "Unknown Member",
          userEmail: ev.userEmail || "",
          total: 1,
          successful: isSuccess ? 1 : 0,
          failed: isSuccess ? 0 : 1,
          tokens: tokenCount,
          lastActiveAt: ev.createdAt,
        });
      } else {
        existing.total += 1;
        if (isSuccess) {
          existing.successful += 1;
        } else {
          existing.failed += 1;
        }
        existing.tokens += tokenCount;
        if (ev.createdAt > existing.lastActiveAt) {
          existing.lastActiveAt = ev.createdAt;
        }
      }
    }

    return Array.from(map.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        userEmail: data.userEmail,
        totalRequests: data.total,
        successfulRequests: data.successful,
        failedRequests: data.failed,
        totalTokens: data.tokens,
        lastActiveAt: data.lastActiveAt.toISOString(),
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  } catch (err) {
    console.warn("[AIGovernance] Failed to fetch user usage:", err);
    return [];
  }
}

/**
 * Centralized summary aggregator for administrator AI Governance overview.
 */
export async function getAIGovernanceSummary(
  organizationId: string,
  dbInstance: DbClient = db as DbClient
): Promise<AIGovernanceSummary> {
  const safeConfig = getSafePublicAIConfig();
  const settings = await getOrganizationAISettings(organizationId, dbInstance);
  const rawUsage = await getOrganizationAIUsage(organizationId, dbInstance);

  // Determine availability status
  let availability: "available" | "not_configured" | "disabled" = "available";
  if (!settings.aiEnabled) {
    availability = "disabled";
  } else if (!safeConfig.isConfigured) {
    availability = "not_configured";
  }

  // Get most recent activity timestamp if available
  let lastActiveAt: string | null = null;
  try {
    const [latest] = await dbInstance
      .select({ createdAt: aiAuditEvents.createdAt })
      .from(aiAuditEvents)
      .where(eq(aiAuditEvents.organizationId, organizationId))
      .orderBy(desc(aiAuditEvents.createdAt))
      .limit(1);

    if (latest) {
      lastActiveAt = latest.createdAt.toISOString();
    }
  } catch (err) {
    console.warn("[AIGovernance] Failed to fetch latest audit timestamp:", err);
  }

  const providerStatus: AIGovernanceProviderStatus = {
    ...safeConfig,
    availability,
    lastActiveAt,
  };

  const dailyPercentage =
    settings.dailyRequestLimit > 0
      ? Math.min(
          100,
          Math.round((rawUsage.dailyUsage.used / settings.dailyRequestLimit) * 100)
        )
      : 0;

  const monthlyPercentage =
    settings.monthlyRequestLimit > 0
      ? Math.min(
          100,
          Math.round(
            (rawUsage.monthlyUsage.used / settings.monthlyRequestLimit) * 100
          )
        )
      : 0;

  const usage = {
    totalRequests: rawUsage.totalRequests,
    successfulRequests: rawUsage.successfulRequests,
    failedRequests: rawUsage.failedRequests,
    totalTokensConsumed: rawUsage.totalTokensConsumed,
    dailyUsage: {
      used: rawUsage.dailyUsage.used,
      limit: rawUsage.dailyUsage.limit,
      remaining: rawUsage.dailyUsage.remaining,
      percentage: dailyPercentage,
    },
    monthlyUsage: {
      used: rawUsage.monthlyUsage.used,
      limit: rawUsage.monthlyUsage.limit,
      remaining: rawUsage.monthlyUsage.remaining,
      percentage: monthlyPercentage,
    },
  };

  const [errors, endpointUsage, userUsage] = await Promise.all([
    getAIErrorSummary(organizationId, dbInstance),
    getAIUsageByEndpoint(organizationId, dbInstance),
    getAIUsageByUser(organizationId, dbInstance),
  ]);

  return {
    organizationId,
    providerStatus,
    settings,
    usage,
    errors,
    endpointUsage,
    userUsage,
  };
}

export { updateOrganizationAISettings };
