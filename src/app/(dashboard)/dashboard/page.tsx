import { requireOrganization } from "@/lib/context/organization-context";
import { getOrganizationCounts } from "@/lib/services/organization.service";
import { Building2, Link2, Users, ShieldCheck, Database, KeyRound, Lock, Shield } from "lucide-react";

export const metadata = {
  title: "Dashboard - Ghuru CRM",
  description: "Ghuru CRM SaaS Foundation Dashboard",
};

export default async function DashboardPage() {
  const ctx = await requireOrganization();
  const counts = await getOrganizationCounts(ctx.organization.id);

  // Formatted date
  const createdDate = new Date(ctx.organization.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome to your organization workspace.
        </p>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Organization */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-3">
            <p className="text-xs font-medium text-slate-400">Organization</p>
            <p className="text-base font-bold text-slate-900 truncate">
              {ctx.organization.name}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Slug */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-3">
            <p className="text-xs font-medium text-slate-400">Slug</p>
            <p className="text-base font-mono font-bold text-slate-900 truncate">
              {ctx.organization.slug}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Total Users */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-3">
            <p className="text-xs font-medium text-slate-400">Total Users</p>
            <p className="text-2xl font-bold text-slate-900">
              {counts.totalUsers}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Active Roles */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-3">
            <p className="text-xs font-medium text-slate-400">Active Roles</p>
            <p className="text-2xl font-bold text-slate-900">
              {counts.activeRoles}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2 Main Information Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Organization Information */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-5">
            Organization Information
          </h2>

          <div className="divide-y divide-slate-100">
            <div className="py-3.5 flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs font-medium">Name</span>
              <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                {ctx.organization.name}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs font-medium">Slug</span>
              <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
                {ctx.organization.slug}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs font-medium">Created At</span>
              <span className="text-slate-700 text-xs font-medium">
                {createdDate}
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs font-medium">Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Panel 2: System Status */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-5">
            System Status
          </h2>

          <div className="divide-y divide-slate-100">
            <div className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <Database className="h-4 w-4 text-blue-600" />
                <span className="text-slate-700 text-xs font-medium">Database</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-blue-600" />
                <span className="text-slate-700 text-xs font-medium">Authentication</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-blue-600" />
                <span className="text-slate-700 text-xs font-medium">Tenant Isolation</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Enabled
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-slate-700 text-xs font-medium">RBAC</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
