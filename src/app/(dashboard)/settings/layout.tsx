import { requireOrganization } from "@/lib/context/organization-context";
import { SettingsNav } from "@/components/layout/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireOrganization();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organization settings, team members, and role-based permissions.
        </p>
      </div>

      <SettingsNav permissions={ctx.permissionKeys} />

      <div className="pt-2">{children}</div>
    </div>
  );
}
