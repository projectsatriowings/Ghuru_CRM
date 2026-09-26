import { requireOrganization } from "@/lib/context/organization-context";
import { getOrganizationMembers } from "@/lib/services/user.service";
import { getOrganizationRoles } from "@/lib/services/role.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Shield,
  Server,
  Lock,
  Layers,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Dashboard - Ghuru CRM",
  description: "Ghuru CRM SaaS Foundation Dashboard",
};

export default async function DashboardPage() {
  const ctx = await requireOrganization();
  const members = await getOrganizationMembers(ctx.organization.id);
  const roles = await getOrganizationRoles(ctx.organization.id);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Organization Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome to <span className="font-semibold text-foreground">{ctx.organization.name}</span>. This is your multi-tenant SaaS foundation workspace.
        </p>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Organization Card */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{ctx.organization.name}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              slug: {ctx.organization.slug}
            </p>
          </CardContent>
        </Card>

        {/* Current User Card */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current User</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{ctx.user.name}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {ctx.user.email}
            </p>
          </CardContent>
        </Card>

        {/* Role Card */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{ctx.role.name}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {ctx.permissionKeys.length} permissions granted
            </p>
          </CardContent>
        </Card>

        {/* Members Count Card */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {roles.length} roles configured
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Organization Info & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Organization Details */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Tenant Information</CardTitle>
            <CardDescription>
              Details about the active organization workspace and server-side context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60">
                <span className="text-xs text-muted-foreground block font-medium">
                  Internal Tenant ID
                </span>
                <span className="font-mono text-xs font-semibold text-foreground break-all">
                  {ctx.organization.id}
                </span>
              </div>
              <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60">
                <span className="text-xs text-muted-foreground block font-medium">
                  Public Slug Identifier
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {ctx.organization.slug}
                </span>
              </div>
              <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60">
                <span className="text-xs text-muted-foreground block font-medium">
                  Created Date
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {new Date(ctx.organization.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60">
                <span className="text-xs text-muted-foreground block font-medium">
                  Membership Record ID
                </span>
                <span className="font-mono text-xs font-semibold text-foreground break-all">
                  {ctx.membership.id}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-sm font-semibold mb-2">Assigned Permissions</h4>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {ctx.permissionKeys.map((perm) => (
                  <span
                    key={perm}
                    className="font-mono text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded border border-border"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: SaaS Foundation System Status */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
            <CardDescription>
              SaaS foundation baseline health and architectural integrity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded border border-border/60">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium">Tenant Isolation</span>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] border-emerald-200">
                  Enforced
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded border border-border/60">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium">Role-Based Access</span>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] border-emerald-200">
                  Active
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded border border-border/60">
                <div className="flex items-center gap-2.5">
                  <Server className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium">Neon PostgreSQL</span>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] border-emerald-200">
                  Connected
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded border border-border/60">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium">Better Auth Session</span>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] border-emerald-200">
                  Verified
                </Badge>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Architecture ready for modular CRM extension (Pipelines, Contacts, Integrations) in future milestones.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Foundation Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/settings/organization"
          className="p-4 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors flex items-start gap-3"
        >
          <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-foreground">Organization Settings</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage organization name, slug, and general tenant profile.
            </p>
          </div>
        </Link>

        <Link
          href="/settings/users"
          className="p-4 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors flex items-start gap-3"
        >
          <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-foreground">User Management</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add new members, reassign roles, and manage permissions.
            </p>
          </div>
        </Link>

        <Link
          href="/settings/roles"
          className="p-4 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors flex items-start gap-3"
        >
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-foreground">Roles & Permissions</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create custom roles and configure granular system permissions.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
