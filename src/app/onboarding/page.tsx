import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { CreateOrganizationForm } from "@/components/organization/create-org-form";

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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-lg">
        <CreateOrganizationForm />
      </div>
    </div>
  );
}
