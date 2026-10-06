import { requireOrganization } from "@/lib/context/organization-context";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getPipelines } from "@/lib/services/pipeline.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ForbiddenError } from "@/lib/errors";

export const metadata = {
  title: "CRM Dashboard - Ghuru CRM",
  description: "Operational CRM Dashboard & Intelligence",
};

export default async function DashboardPage() {
  const ctx = await requireOrganization();

  // Validate permission (dashboard.view or organization.view)
  if (
    !ctx.hasPermission("dashboard.view") &&
    !ctx.hasPermission("organization.view")
  ) {
    throw new ForbiddenError(
      "Forbidden: You do not have the required permission [dashboard.view] to view the CRM dashboard."
    );
  }

  // Fetch initial dashboard data, members, and pipelines in parallel
  const [initialData, members, pipelines] = await Promise.all([
    getDashboardData(ctx.organization.id, ctx.user.id, {}),
    getOrganizationMembers(ctx.organization.id),
    getPipelines(ctx.organization.id),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CRM Operations & Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time pipeline progression, active follow-ups, and operational workload for{" "}
            <span className="font-semibold text-slate-700">{ctx.organization.name}</span>
          </p>
        </div>
      </div>

      {/* Main Interactive Dashboard Shell */}
      <DashboardShell
        initialData={initialData}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name || m.email,
          email: m.email,
        }))}
        pipelines={pipelines.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
        currentUserId={ctx.user.id}
        roleName={ctx.role.name}
        canViewAI={ctx.hasPermission("ai.view")}
      />
    </div>
  );
}
