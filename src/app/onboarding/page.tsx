import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/context/organization-context";
import { getUserOrganizations } from "@/lib/services/organization.service";
import { CreateOrganizationForm } from "@/components/organization/create-org-form";
import { AuthSidePanel } from "@/components/auth/auth-side-panel";

export const metadata = {
  title: "Create Your Workspace — Ghuru CRM",
  description: "Set up your organization to get started with Ghuru CRM",
};

export default async function OnboardingPage() {
  let user;
  try {
    const authSession = await requireAuth();
    user = authSession.user;
  } catch {
    redirect("/login");
  }

  const userOrgs = await getUserOrganizations(user.id);
  if (userOrgs.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F7F9FC]">
      {/* Left 40% Deep Navy Brand & Stepper Panel */}
      <AuthSidePanel currentStep={1} className="w-full lg:w-[40%] xl:w-[38%] min-h-screen" />

      {/* Right 60% Form Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-20 overflow-y-auto">
        <div className="w-full max-w-lg my-auto">
          <CreateOrganizationForm />
        </div>
      </div>
    </div>
  );
}
