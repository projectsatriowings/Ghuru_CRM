import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  requireOrganization,
} from "@/lib/context/organization-context";
import { getUserOrganizations } from "@/lib/services/organization.service";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/lib/errors";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user) {
      redirect("/login");
    }
    user = session.user;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw error;
  }

  // Check user memberships
  const userOrgs = await getUserOrganizations(user.id);
  if (userOrgs.length === 0) {
    redirect("/onboarding");
  }

  let ctx;
  try {
    ctx = await requireOrganization();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      // If active org was invalid or no org selected, pick first valid org
      if (userOrgs.length > 0) {
        ctx = await requireOrganization(userOrgs[0].organizationId);
      } else {
        redirect("/onboarding");
      }
    } else {
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar permissions={ctx.permissionKeys} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentOrg={ctx.organization}
          user={ctx.user}
          roleName={ctx.role.name}
          userOrgs={userOrgs}
        />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-muted/10">
          {children}
        </main>
      </div>
    </div>
  );
}
