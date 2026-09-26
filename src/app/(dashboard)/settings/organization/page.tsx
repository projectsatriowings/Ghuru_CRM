import { requirePermission } from "@/lib/context/organization-context";
import { OrgSettingsForm } from "@/components/organization/org-settings-form";

export const metadata = {
  title: "Organization Settings - Ghuru CRM",
  description: "Manage organization profile and details",
};

export default async function OrganizationSettingsPage() {
  const ctx = await requirePermission("organization.view");

  return (
    <div className="space-y-6">
      <OrgSettingsForm
        organization={ctx.organization}
        canUpdate={ctx.hasPermission("organization.update")}
      />
    </div>
  );
}
