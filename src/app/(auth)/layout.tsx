import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserOrganizations } from "@/lib/services/organization.service";
import { AuthSidePanel } from "@/components/auth/auth-side-panel";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (session?.user) {
    const userOrgs = await getUserOrganizations(session.user.id);
    if (userOrgs.length > 0) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F7F9FC]">
      {/* Left 40% Brand Panel */}
      <AuthSidePanel className="w-full lg:w-[40%] xl:w-[38%] min-h-screen" />

      {/* Right 60% Form Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-20 overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
