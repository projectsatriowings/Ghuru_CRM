import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { CreateOrganizationForm } from "@/components/organization/create-org-form";
import { Logo } from "@/components/brand/logo";

export const metadata = {
  title: "Create Organization - Ghuru CRM",
  description: "Set up your organization in Ghuru CRM",
};

export default async function OnboardingPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto py-4 flex items-center justify-between">
        <Logo variant="light" size="md" />
        <span className="text-xs text-slate-500 font-medium">
          Step 1 of 3
        </span>
      </header>

      {/* Main Stepper Card */}
      <main className="w-full my-auto py-8">
        <CreateOrganizationForm />
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 text-xs text-slate-400">
        Ghuru CRM &bull; Smarter Business. Stronger Growth.
      </footer>
    </div>
  );
}
