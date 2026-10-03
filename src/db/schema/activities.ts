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
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    index("activities_created_idx").on(table.createdAt),
    index("activities_org_lead_created_idx").on(
      table.organizationId,
      table.leadId,
      table.createdAt
    ),
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
  createdByUser: one(users, {
    fields: [activities.createdByUserId],
    references: [users.id],
  }),
}));
