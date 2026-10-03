import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { pipelines, pipelineStages } from "./pipelines";
import { companies } from "./companies";

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    source: text("source").notNull().default("other"),
    status: text("status").notNull().default("new"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    pipelineId: text("pipeline_id").references(() => pipelines.id, {
      onDelete: "set null",
    }),
    stageId: text("stage_id").references(() => pipelineStages.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("leads_org_idx").on(table.organizationId),
    index("leads_org_status_idx").on(table.organizationId, table.status),
    index("leads_org_source_idx").on(table.organizationId, table.source),
    index("leads_org_assigned_idx").on(
      table.organizationId,
      table.assignedToUserId
    ),
    index("leads_org_pipeline_idx").on(
      table.organizationId,
      table.pipelineId
    ),
    index("leads_org_stage_idx").on(
      table.organizationId,
      table.stageId
    ),
    index("leads_pipeline_idx").on(table.pipelineId),
    index("leads_stage_idx").on(table.stageId),
    index("leads_org_created_idx").on(table.organizationId, table.createdAt),
    index("leads_org_archived_idx").on(table.organizationId, table.archivedAt),
    index("leads_org_company_idx").on(table.organizationId, table.companyId),
    index("leads_company_idx").on(table.companyId),
  ]
);

export const leadsRelations = relations(leads, ({ one }) => ({
  organization: one(organizations, {
    fields: [leads.organizationId],
    references: [organizations.id],
  }),
  assignedToUser: one(users, {
    fields: [leads.assignedToUserId],
    references: [users.id],
  }),
  pipeline: one(pipelines, {
    fields: [leads.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [leads.stageId],
    references: [pipelineStages.id],
  }),
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
}));
