import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * Durable AI Audit Events table for multi-tenant governance.
 * Stores only safe operational metadata — NEVER raw API keys, secrets, or sensitive CRM bodies.
 */
export const aiAuditEvents = pgTable(
  "ai_audit_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(), // 'briefing' | 'next-actions' | 'explain' | 'ask'
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    correlationId: text("correlation_id").notNull(),
    durationMs: integer("duration_ms").notNull(),
    status: text("status").notNull(), // 'success' | 'failure'
    errorCategory: text("error_category"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_audit_org_idx").on(table.organizationId),
    index("ai_audit_user_idx").on(table.userId),
    index("ai_audit_org_created_idx").on(table.organizationId, table.createdAt),
    index("ai_audit_org_endpoint_idx").on(table.organizationId, table.endpoint),
    index("ai_audit_org_status_idx").on(table.organizationId, table.status),
    index("ai_audit_correlation_idx").on(table.correlationId),
  ]
);

/**
 * Organization-level AI governance and usage quotas.
 */
export const organizationAiSettings = pgTable(
  "organization_ai_settings",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: "cascade" }),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    dailyRequestLimit: integer("daily_request_limit").notNull().default(100),
    monthlyRequestLimit: integer("monthly_request_limit").notNull().default(2000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("org_ai_settings_org_idx").on(table.organizationId),
  ]
);

export const aiAuditEventsRelations = relations(aiAuditEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiAuditEvents.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [aiAuditEvents.userId],
    references: [users.id],
  }),
}));

export const organizationAiSettingsRelations = relations(organizationAiSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationAiSettings.organizationId],
    references: [organizations.id],
  }),
}));
