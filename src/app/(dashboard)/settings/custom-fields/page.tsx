import { requirePermission } from "@/lib/context/organization-context";
import { getCustomFields } from "@/lib/services/custom-field.service";
import { CustomFieldsTable } from "@/components/custom-fields/custom-fields-table";

export const metadata = {
  title: "Custom Fields - Ghuru CRM",
  description: "Configure custom fields for your CRM entities",
};

export default async function CustomFieldsSettingsPage() {
  const ctx = await requirePermission("custom_fields.view");
  const fields = await getCustomFields(ctx.organization.id);

  return (
    <div className="space-y-6">
      <CustomFieldsTable
        fields={fields}
        canCreate={ctx.hasPermission("custom_fields.create")}
        canUpdate={ctx.hasPermission("custom_fields.update")}
        canDelete={ctx.hasPermission("custom_fields.delete")}
      />
    </div>
  );
}
