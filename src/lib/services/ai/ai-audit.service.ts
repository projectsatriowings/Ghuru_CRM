import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import { aiAuditEvents } from "@/db/schema/ai-audit";
import { recordAIObservabilityLog } from "./ai-observability";

export interface RecordAuditEventInput {
  organizationId: string;
  userId: string;
  endpoint: "briefing" | "next-actions" | "explain" | "ask";
  provider: string;
  model: string;
  correlationId: string;
  durationMs: number;
  status: "success" | "failure";
  errorCategory?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIAuditLogRecord {
  id: string;
  organizationId: string;
  userId: string;
  endpoint: string;
  provider: string;
  model: string;
  correlationId: string;
  durationMs: number;
  status: "success" | "failure";
  errorCategory?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  createdAt: string;
}

/**
 * Persists an AI audit event durably in the database while maintaining
 * the fast in-memory observability buffer. Fail-safe: database write errors
 * are caught and logged so that audit failures NEVER disrupt the AI request flow.
 */
export async function recordAIAuditEvent(
  input: RecordAuditEventInput,
  dbInstance: DbClient = db as DbClient
): Promise<string> {
  const eventId = `audit_${crypto.randomUUID()}`;

  // Always keep in-memory observability buffer updated
  recordAIObservabilityLog({
    organizationId: input.organizationId,
    userId: input.userId,
    requestType: input.endpoint === "next-actions" ? "next_actions" : input.endpoint,
    durationMs: input.durationMs,
    success: input.status === "success",
    model: input.model,
    tokenUsage: input.totalTokens
      ? {
          promptTokens: input.promptTokens || 0,
          completionTokens: input.completionTokens || 0,
          totalTokens: input.totalTokens,
        }
      : undefined,
    errorMessage: input.errorCategory,
  });

  try {
    await dbInstance.insert(aiAuditEvents).values({
      id: eventId,
      organizationId: input.organizationId,
      userId: input.userId,
      endpoint: input.endpoint,
      provider: input.provider,
      model: input.model,
      correlationId: input.correlationId,
      durationMs: input.durationMs,
      status: input.status,
      errorCategory: input.errorCategory || null,
      promptTokens: input.promptTokens || null,
      completionTokens: input.completionTokens || null,
      totalTokens: input.totalTokens || null,
      createdAt: new Date(),
    });
  } catch (err) {
    // Audit failure must never crash user requests
    console.warn("[AIAudit] Failed to persist audit event durably:", err);
  }

  return eventId;
}

/**
 * Retrieves audit logs for an organization with strict tenant isolation.
 */
export async function getOrganizationAIAuditLogs(
  organizationId: string,
  options: {
    limit?: number;
    endpoint?: string;
    status?: "success" | "failure";
  } = {},
  dbInstance: DbClient = db as DbClient
): Promise<AIAuditLogRecord[]> {
  const limit = Math.min(options.limit || 50, 100);

  const conditions = [eq(aiAuditEvents.organizationId, organizationId)];
  if (options.endpoint) {
    conditions.push(eq(aiAuditEvents.endpoint, options.endpoint));
  }
  if (options.status) {
    conditions.push(eq(aiAuditEvents.status, options.status));
  }

  const rows = await dbInstance
    .select()
    .from(aiAuditEvents)
    .where(and(...conditions))
    .orderBy(desc(aiAuditEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    userId: r.userId,
    endpoint: r.endpoint,
    provider: r.provider,
    model: r.model,
    correlationId: r.correlationId,
    durationMs: r.durationMs,
    status: r.status as "success" | "failure",
    errorCategory: r.errorCategory,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.totalTokens,
    createdAt: r.createdAt.toISOString(),
  }));
}
