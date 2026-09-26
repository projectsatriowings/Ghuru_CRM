import { requirePermission } from "@/lib/context/organization-context";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getOrganizationRoles } from "@/lib/services/role.service";
import { UsersTable } from "@/components/users/users-table";

export const metadata = {
  title: "User Management - Ghuru CRM",
  description: "Manage organization members and assign roles",
};

export default async function UsersSettingsPage() {
  const ctx = await requirePermission("users.view");
  const [members, roles] = await Promise.all([
    getOrganizationMembers(ctx.organization.id),
    getOrganizationRoles(ctx.organization.id),
  ]);

  return (
    <div className="space-y-6">
      <UsersTable
        members={members}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        currentUserId={ctx.user.id}
        canCreate={ctx.hasPermission("users.create")}
        canUpdate={ctx.hasPermission("users.update")}
        canDelete={ctx.hasPermission("users.delete")}
      />
    </div>
  );
}
