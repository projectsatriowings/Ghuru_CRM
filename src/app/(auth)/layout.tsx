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
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-[#F1F5F9]">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden flex flex-col lg:flex-row min-h-[620px]">
        {/* Left deep navy brand panel */}
        <AuthSidePanel />

        {/* Right white interactive form area */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}
