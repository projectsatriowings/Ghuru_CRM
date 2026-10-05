import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { companies } from "./companies";
import { deals } from "./deals";

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    ownerUserId: text("owner_user_id").references(() => users.id, {
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
    index("contacts_org_idx").on(table.organizationId),
    index("contacts_org_archived_idx").on(table.organizationId, table.archivedAt),
    index("contacts_org_owner_idx").on(table.organizationId, table.ownerUserId),
    index("contacts_org_created_idx").on(table.organizationId, table.createdAt),
    index("contacts_created_at_idx").on(table.createdAt),
    index("contacts_updated_at_idx").on(table.updatedAt),
    index("contacts_org_company_idx").on(table.organizationId, table.companyId),
    index("contacts_company_idx").on(table.companyId),
    uniqueIndex("contacts_company_primary_idx")
      .on(table.companyId)
      .where(sql`${table.isPrimaryContact} = true AND ${table.companyId} IS NOT NULL`),
  ]
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [contacts.ownerUserId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  deals: many(deals),
}));
