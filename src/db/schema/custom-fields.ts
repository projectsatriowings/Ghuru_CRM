import {
  pgTable,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    fieldType: text("field_type").notNull(),
    required: boolean("required").notNull().default(false),
    active: boolean("active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("custom_fields_org_entity_key_idx").on(
      table.organizationId,
      table.entityType,
      table.key
    ),
    index("custom_fields_org_id_idx").on(table.organizationId),
    index("custom_fields_org_entity_idx").on(table.organizationId, table.entityType),
    index("custom_fields_org_entity_active_idx").on(
      table.organizationId,
      table.entityType,
      table.active
    ),
  ]
);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fieldDefinitionId: text("field_definition_id")
      .notNull()
      .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    value: jsonb("value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("custom_field_values_org_entity_record_field_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.fieldDefinitionId
    ),
    index("custom_field_values_org_entity_record_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId
    ),
    index("custom_field_values_field_def_idx").on(table.fieldDefinitionId),
  ]
);

export const customFieldDefinitionsRelations = relations(
  customFieldDefinitions,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [customFieldDefinitions.organizationId],
      references: [organizations.id],
    }),
    values: many(customFieldValues),
  })
);

export const customFieldValuesRelations = relations(
  customFieldValues,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [customFieldValues.organizationId],
      references: [organizations.id],
    }),
    fieldDefinition: one(customFieldDefinitions, {
      fields: [customFieldValues.fieldDefinitionId],
      references: [customFieldDefinitions.id],
    }),
  })
);
