import { redirect } from "next/navigation";
import {
  requireAuth,
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
    const authSession = await requireAuth();
    user = authSession.user;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw error;
  }

  // Fetch user memberships and organization context concurrently
  const [userOrgsResult, ctxResult] = await Promise.allSettled([
    getUserOrganizations(user.id),
    requireOrganization(),
  ]);

  const userOrgs =
    userOrgsResult.status === "fulfilled" ? userOrgsResult.value : [];

  if (userOrgs.length === 0) {
    redirect("/onboarding");
  }

  let ctx;
  if (ctxResult.status === "fulfilled") {
    ctx = ctxResult.value;
  } else {
    const error = ctxResult.reason;
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      ctx = await requireOrganization(userOrgs[0].organizationId);
    } else {
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar permissions={ctx.permissionKeys} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentOrg={ctx.organization}
          user={ctx.user}
          roleName={ctx.role.name}
          userOrgs={userOrgs}
        />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  );
}
