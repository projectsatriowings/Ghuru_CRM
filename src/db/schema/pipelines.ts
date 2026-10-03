import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";

export const pipelines = pgTable(
  "pipelines",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("pipelines_org_idx").on(table.organizationId),
    index("pipelines_org_active_idx").on(table.organizationId, table.active),
    index("pipelines_org_is_default_idx").on(
      table.organizationId,
      table.isDefault
    ),
    index("pipelines_org_archived_idx").on(
      table.organizationId,
      table.archivedAt
    ),
  ]
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("pipeline_stages_org_idx").on(table.organizationId),
    index("pipeline_stages_pipeline_idx").on(table.pipelineId),
    index("pipeline_stages_org_pipeline_idx").on(
      table.organizationId,
      table.pipelineId
    ),
    index("pipeline_stages_pipeline_order_idx").on(
      table.pipelineId,
      table.displayOrder
    ),
    index("pipeline_stages_pipeline_archived_idx").on(
      table.pipelineId,
      table.archivedAt
    ),
  ]
);

export const pipelinesRelations = relations(pipelines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pipelines.organizationId],
    references: [organizations.id],
  }),
  stages: many(pipelineStages),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineStages.pipelineId],
    references: [pipelines.id],
  }),
  organization: one(organizations, {
    fields: [pipelineStages.organizationId],
    references: [organizations.id],
  }),
}));
