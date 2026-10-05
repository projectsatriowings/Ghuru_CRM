import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { leads } from "./leads";
import { users } from "./users";

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
  "task",
  "follow_up",
  "status_change",
  "assignment_change",
  "conversion",
  "relationship_change",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CRM_ENTITY_TYPES = ["lead", "contact", "company", "deal"] as const;
export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number];

export const ACTIVITY_STATUSES = ["pending", "completed", "cancelled"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().default("lead"),
    entityId: text("entity_id").notNull(),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("completed"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("activities_org_idx").on(table.organizationId),
    index("activities_lead_idx").on(table.leadId),
    index("activities_org_lead_idx").on(table.organizationId, table.leadId),
    index("activities_org_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId
    ),
    index("activities_org_entity_created_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index("activities_status_idx").on(table.status),
    index("activities_assigned_idx").on(table.assignedToUserId),
    index("activities_created_idx").on(table.createdAt),
    index("activities_org_archived_idx").on(table.organizationId, table.archivedAt),
  ]
);

export const activitiesRelations = relations(activities, ({ one }) => ({
  organization: one(organizations, {
    fields: [activities.organizationId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
  assignedToUser: one(users, {
    fields: [activities.assignedToUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [activities.createdByUserId],
    references: [users.id],
  }),
}));
