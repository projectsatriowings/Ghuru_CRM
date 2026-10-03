import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    email: text("email"),
    phone: text("phone"),
    industry: text("industry"),
    companySize: text("company_size"),
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
    index("companies_org_idx").on(table.organizationId),
    index("companies_org_archived_idx").on(table.organizationId, table.archivedAt),
    index("companies_org_owner_idx").on(table.organizationId, table.ownerUserId),
    index("companies_org_created_idx").on(table.organizationId, table.createdAt),
    index("companies_created_at_idx").on(table.createdAt),
    index("companies_updated_at_idx").on(table.updatedAt),
  ]
);

export const companiesRelations = relations(companies, ({ one }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [companies.ownerUserId],
    references: [users.id],
  }),
}));
