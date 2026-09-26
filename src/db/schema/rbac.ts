import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, organizationMembers } from "./organizations";

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
  ]
);

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organizationId],
    references: [organizations.id],
  }),
  rolePermissions: many(rolePermissions),
  members: many(organizationMembers),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));
