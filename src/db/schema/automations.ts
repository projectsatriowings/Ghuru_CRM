import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import {
  AUTOMATION_ENTITY_TYPES,
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_EXECUTION_STATUSES,
  type AutomationEntityType,
  type AutomationTriggerType,
  type AutomationExecutionStatus,
  type AutomationConditionGroup,
  type AutomationActionConfig,
} from "@/lib/types/automations";

export {
  AUTOMATION_ENTITY_TYPES,
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_EXECUTION_STATUSES,
  type AutomationEntityType,
  type AutomationTriggerType,
  type AutomationExecutionStatus,
};

export const automations = pgTable(
  "automations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    entityType: text("entity_type").notNull(),
    triggerType: text("trigger_type").notNull(),
    conditions: jsonb("conditions")
      .$type<AutomationConditionGroup[]>()
      .notNull()
      .default([]),
    actions: jsonb("actions")
      .$type<AutomationActionConfig[]>()
      .notNull()
      .default([]),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("automations_org_idx").on(table.organizationId),
    index("automations_org_active_idx").on(table.organizationId, table.active),
    index("automations_org_entity_idx").on(
      table.organizationId,
      table.entityType
    ),
    index("automations_org_trigger_idx").on(
      table.organizationId,
      table.triggerType
    ),
    index("automations_org_archived_idx").on(
      table.organizationId,
      table.archivedAt
    ),
  ]
);

export const automationExecutions = pgTable(
  "automation_executions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("auto_exec_org_idx").on(table.organizationId),
    index("auto_exec_auto_idx").on(table.automationId),
    index("auto_exec_org_auto_idx").on(
      table.organizationId,
      table.automationId
    ),
    index("auto_exec_org_started_idx").on(
      table.organizationId,
      table.startedAt
    ),
    index("auto_exec_entity_idx").on(table.entityType, table.entityId),
    index("auto_exec_status_idx").on(table.status),
  ]
);

export const automationsRelations = relations(automations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [automations.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [automations.createdByUserId],
    references: [users.id],
  }),
  executions: many(automationExecutions),
}));

export const automationExecutionsRelations = relations(
  automationExecutions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [automationExecutions.organizationId],
      references: [organizations.id],
    }),
    automation: one(automations, {
      fields: [automationExecutions.automationId],
      references: [automations.id],
    }),
  })
);
