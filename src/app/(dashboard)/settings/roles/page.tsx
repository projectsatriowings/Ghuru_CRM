import { requirePermission } from "@/lib/context/organization-context";
import {
  getOrganizationRoles,
  getAllSystemPermissions,
} from "@/lib/services/role.service";
import { RolesList } from "@/components/roles/roles-list";

export const metadata = {
  title: "Roles & Permissions - Ghuru CRM",
  description: "Manage custom roles and configure permissions",
};

export default async function RolesSettingsPage() {
  const ctx = await requirePermission("roles.view");
  const [roles, systemPermissions] = await Promise.all([
    getOrganizationRoles(ctx.organization.id),
    getAllSystemPermissions(),
  ]);

  return (
    <div className="space-y-6">
      <RolesList
        roles={roles}
        systemPermissions={systemPermissions}
        canCreate={ctx.hasPermission("roles.create")}
        canUpdate={ctx.hasPermission("roles.update")}
        canDelete={ctx.hasPermission("roles.delete")}
      />
    </div>
  );
}
