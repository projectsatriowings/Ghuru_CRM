import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { leads } from "./leads";
import { deals } from "./deals";
import { users } from "./users";

export const FOLLOW_UP_STATUSES = ["pending", "completed", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const followUps = pgTable(
  "follow_ups",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "cascade",
    }),
    dealId: text("deal_id").references(() => deals.id, {
      onDelete: "cascade",
    }),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: text("due_date").notNull(),
    dueTime: text("due_time"),
    status: text("status").notNull().default("pending"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("follow_ups_org_idx").on(table.organizationId),
    index("follow_ups_lead_idx").on(table.leadId),
    index("follow_ups_org_lead_idx").on(table.organizationId, table.leadId),
    index("follow_ups_deal_idx").on(table.dealId),
    index("follow_ups_org_deal_idx").on(table.organizationId, table.dealId),
    index("follow_ups_status_idx").on(table.status),
    index("follow_ups_due_date_idx").on(table.dueDate),
    index("follow_ups_org_status_due_idx").on(
      table.organizationId,
      table.status,
      table.dueDate
    ),
    index("follow_ups_assigned_idx").on(table.assignedToUserId),
    index("follow_ups_created_idx").on(table.createdAt),
    index("follow_ups_org_archived_idx").on(
      table.organizationId,
      table.archivedAt
    ),
  ]
);

export const followUpsRelations = relations(followUps, ({ one }) => ({
  organization: one(organizations, {
    fields: [followUps.organizationId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [followUps.leadId],
    references: [leads.id],
  }),
  deal: one(deals, {
    fields: [followUps.dealId],
    references: [deals.id],
  }),
  assignedToUser: one(users, {
    fields: [followUps.assignedToUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [followUps.createdByUserId],
    references: [users.id],
  }),
}));
