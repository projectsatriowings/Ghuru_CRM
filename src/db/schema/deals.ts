import {
  pgTable,
  text,
  timestamp,
  index,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { pipelines, pipelineStages } from "./pipelines";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { leads } from "./leads";

export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "restrict" }),
    pipelineStageId: text("pipeline_stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    value: numeric("value", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    status: text("status").notNull().default("open"),
    probability: integer("probability"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("deals_org_idx").on(table.organizationId),
    index("deals_org_status_idx").on(table.organizationId, table.status),
    index("deals_org_pipeline_idx").on(
      table.organizationId,
      table.pipelineId
    ),
    index("deals_org_stage_idx").on(
      table.organizationId,
      table.pipelineStageId
    ),
    index("deals_org_owner_idx").on(
      table.organizationId,
      table.ownerUserId
    ),
    index("deals_org_lead_idx").on(table.organizationId, table.leadId),
    index("deals_org_contact_idx").on(table.organizationId, table.contactId),
    index("deals_org_company_idx").on(table.organizationId, table.companyId),
    index("deals_org_created_idx").on(table.organizationId, table.createdAt),
    index("deals_org_archived_idx").on(table.organizationId, table.archivedAt),
    index("deals_org_expected_close_idx").on(
      table.organizationId,
      table.expectedCloseDate
    ),
    index("deals_lead_idx").on(table.leadId),
    index("deals_contact_idx").on(table.contactId),
    index("deals_company_idx").on(table.companyId),
    index("deals_pipeline_idx").on(table.pipelineId),
    index("deals_stage_idx").on(table.pipelineStageId),
  ]
);

export const dealsRelations = relations(deals, ({ one }) => ({
  organization: one(organizations, {
    fields: [deals.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [deals.ownerUserId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [deals.leadId],
    references: [leads.id],
  }),
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.pipelineStageId],
    references: [pipelineStages.id],
  }),
}));
